# Spec: hoist user/kv API to host + cross-framework auth store

**Status**: design complete, pending user review
**Date**: 2026-08-03
**Scope**: `apps/showcase/src/api/`, `apps/showcase/src/shared/`, `packages/react-components/src/shortcut-library/`

## 1. 问题

`shortcut-library` 当前在组件内部自实现 `authClient.ts` / `userKvClient.ts`,
直接 `fetch(baseUrl + '/api/v1/user/...')` 共 7 个端点。这导致:

- **没走 API 网关规范**:`apps/showcase/src/api/registry.ts` 是 dev/prod 路由的唯一事实源,
  组件却绕开它自己拼 baseUrl。registry 里没有 `/api/v1/auth` / `/api/v1/kv` 条目,
  路径只在源码里硬编码,后端改路径时不会 fail-fast。
- **未复用 `shared/request.ts`**:重复实现 `call<T> / 解包络 / 401 处理`,
  跟 `api.get/post` 行为分叉(后者 throw ApiError,前者返回 `Result<T, ApiError>`)。
- **认证状态被组件私有化**:JWT 写入 localStorage (`sl-userkv:v1:token`),
  状态机(登录/登出/续期)藏在 `userKvStore.ts` 里。
  后续其它组件需要同一身份时会被迫重写。
- **鉴权方式与 host 规范不一致**:`shared/request.ts` 走 httpOnly cookie,
  `authClient.ts` 走 Bearer JWT。两者目标后端相同,行为却不一致。

## 2. 目标

1. `shortcut-library` 改成所有 HTTP 走 `apps/showcase/src/api/services/<id>/` 业务封装,
   进而是 `api.get/post` + registry 路由。
2. 认证状态(login / JWT / userInfo)由 Vue host 拥有,通过 Pinia `authStore` 暴露,
   并提供跨框架 hook `useAuth()` 供 React 组件订阅。
3. `shared/request.ts` 升级为支持 Bearer JWT 注入(以 user/kv 为准),
   后续其它自带 token 的后端也能复用。
4. `shortcut-library` 不再持有 `authClient.ts` / `userKvClient.ts`,
   也不再直接管 JWT 落盘 / 401 信号(转交 authStore)。

## 3. 非目标

- 不动后端。后端 `/api/v1/user/*` / `/api/v1/kv/*` 路径不变。
- 不重构 `auth.ts` (cookie/Self-auth 路径) — 保留现有 cookie 路径作为并行方案。
- 不迁移其它组件(notion / gitlab / weather service) — 那些走 cookie,不在本次范围。
- 不重写 LoginModal UI — 先写一个能用的,SPA-friendly。后续可能再次设计。

## 4. 架构

```
┌─────────────────────────────────────────────────────────────┐
│ Vue host (apps/showcase)                                     │
│                                                              │
│  shared/                                                     │
│  ├── auth-store.ts          Pinia + cross-fw imperative getter│
│  │   ├── bearerAuth()       注入 Bearer header 给 api client │
│  │   ├── login/register/sendCode 业务入口                    │
│  │   └── useAuth()          React 端 hook,订阅 store         │
│  ├── request.ts             升级:支持 Bearer provider         │
│  └── login-modal.vue        新写,host 顶层组件                │
│                                                              │
│  api/                                                        │
│  ├── registry.ts            BackendId 加 'userV1' | 'kvV1'   │
│  ├── services/                                                │
│  │   ├── auth.ts            (现有,保留 cookie 路径)           │
│  │   ├── userV1.ts          user/* 后端接口                          │
│  │   ├── kvV1.ts            kv/* 后端接口                            │
│  │   └── shortcut-library/  store 实例化,JWT 注入、debounce 控制 │
│  │       ├── createShortcutAuthService()                     │
│  │       └── createShortcutKvStore()                         │
│  ├── normalize.ts           (现有,不变)                       │
│  ├── to-vite-proxy.ts       (现有,不变)                       │
│  └── gen-nginx.ts           (现有,不变)                       │
│                                                              │
│  pages/DetectPage/router   (注册 <LoginModal/> 到 host)       │
└─────────────────────────────────────────────────────────────┘
          │ mount adapter 通过 prop 注 getState/setState
          ▼
┌─────────────────────────────────────────────────────────────┐
│ React component (packages/.../shortcut-library)              │
│                                                              │
│  index.tsx                只组合 + 读 useAuth()              │
│  src/hooks/useShortcuts   改 import 路径,逻辑不走 fetch       │
│  src/engine/              store.ts 保留,userKvStore.ts 保留 LS│
│  ⓧ authClient.ts          删除(迁到 host services/userV1)    │
│  ⓧ userKvClient.ts        删除(迁到 host services/kvV1)      │
│  ⓧ import-parser.ts ...   保留(纯逻辑)                       │
│                                                              │
│  Pages 改为只读 useAuth().token,不创建 client                │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 关键边界

- **Registry 唯一事实源**:path 前缀 / dev+prod target 只能出现在 `registry.ts`。
  组件代码里**零** `baseUrl`、**零** path 拼接。
- **Service 模板**:与 `auth.ts` 同构,`BASE = '/api/v1/auth' as const satisfies ApiPathLiteral`。
- **Store 实例化在 host**:`userKvStore.ts` 保留(debounce / LS 降级),
  但**只 host 注入 `client`**,组件不创建。
- **JWT 持久化位置**:authStore 拥有 localStorage(`sl-userkv:v1:token`),
  组件不读不写。

## 5. 设计决策

### D1:registry 拆分

`BackendId` 字面量联合扩展:

```ts
export type BackendId = 'auth' | 'notion' | 'gitlab' | 'weather' | 'userV1' | 'kvV1';
```

添加两个 entry,路径不含 `v1/...` 后的具体端点(由 service 拼):

```ts
const registry: ApiRegistry = {
  // ... existing
  userV1: {
    target: { dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' },
    routes: ['/api/v1/auth'],
  },
  kvV1: {
    target: { dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' },
    routes: ['/api/v1/kv'],
  },
};
```

`apiPaths` 派生加两条:

```ts
export const apiPaths = {
  auth: '/api/auth',
  userV1: '/api/v1/auth',
  kvV1: '/api/v1/kv',
  // ...
} as const;
```

`apiGateway`(`to-vite-proxy.ts:70`)按最长前缀匹配,`/api/v1/auth/*` 会
精确命中新加的 `'userV1'` entry(因为注册的是 `/api/v1/auth` 而不是 `/api/auth`),
到达后端时仍带 `/api/v1/auth/*` 路径,与后端预期一致。
`'auth' /api/auth` 与 `'/api/v1/auth'` **不重叠**(registry 校验按"完全相等 / 互为前缀"判断),
两条路径独立走各自的 target 类型。

### D2:shared/request.ts 升级

新增 Bearer 注入点:

```ts
type BearerProvider = () => string | null;
let bearerProvider: BearerProvider = () => null;

export function setBearerProvider(fn: BearerProvider): void {
  bearerProvider = fn;
}

// call() 中:
if (token) headers['Authorization'] = `Bearer ${token}`;
```

默认 `bearerProvider = () => null` 保留现有 cookie 行为。
authStore 调用 `setBearerProvider(() => authStore.token)` 激活。

### D3:shared/auth-store.ts 设计

Pinia store + 跨框架 imperative getter:

```ts
import { defineStore } from 'pinia';

export interface AuthState {
  authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
  user: UserInfo | null;
  token: string | null;
  lastError: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ ... }),
  actions: {
    async login(email: string, password: string) { ... },
    async register(args) { ... },
    async sendCode(email: string) { ... },
    async init() { ... },        // 启动期 token 恢复
    logout() { ... },
    async regenerateInvitation() { ... },
  },
});

// 跨框架 imperative getter(React 组件用)
export function getAuthSnapshot(): AuthState {
  return useAuthStore();
}

// React 订阅 hook
export function useAuth(): AuthState {
  // useSyncExternalStore 订阅 Pinia store
  // ...
}
```

主体文件 `apps/showcase/src/shared/auth-store.ts` (现有),扩展为 Pinia。
React 组件从 `packages/react-components/src/shortcut-library/src/hooks/useAuth.ts`
重新 export host 的 `useAuth()`(避免反向依赖)。

### D3.1:LoginModal UI 范围(完全复刻)

参考:`apps/showcase/temp/moebius-login (11).html`(52KB, 单文件设计稿)。
视效为 **Mœbius / Cirrus · 云上入口** 极简风格 —— 白色画布 + 鼠标墨迹 + 云形卷积
(`#scene` 2D canvas + 自实现 ink engine)、手写 CSS 变量(`--white / --soft / --ink / --blue`)。
完全复刻意味着:

- **保留**:`#scene` canvas + 自实现 ink engine(云形动画)+ grain + vignette + custom cursor
  + form(`kicker / h1 / sub / email / password(eye toggle) / remember / forgot / submit / welcome`)
- **删除**:`divider/alt` 区块(Google / GitHub 按钮)—— 后端未支持 OAuth,service 无对应实现
- **保留**:`welcome` 二次页(成功动画 + "返回登录" ghost button)
- **保留**:`#cursor` 自定义光标 + 拖拽交互(`#scene.dragging { cursor: grabbing }`)
- **保留**:strength 进度条(密码强度可视化)

参考中关键 CSS 变量见 §5.1.1,实现细节:Vue 3 SFC (`<template>` 不引入额外组件库) +
`<style scoped>` 内联 css 变量 + `<script setup>` 内 canvas 引擎代码从原 HTML 移植。

宿主:`apps/showcase/src/shared/login-modal.vue` + `apps/showcase/src/shared/login-modal.css`(如果 Vue SFC 体积超 800 行,按 [[how-to-add-component]] 拆 `particles/` 目录)。

### D3.2:现成 CSS 变量

```css
:root {
  --white: #FFFFFF;
  --soft: #F9F8F7;
  --surface: #F0EFED;
  --border: #E6E5E3;
  --ink: #2C2C2B;
  --ink-2: #7D7A75;
  --blue: #2783DE;
}
```

由 host 全局 `:root` 提供,所有组件继承。

## 5.1 关键边界

- **Registry 唯一事实源**:path 前缀 / dev+prod target 只能出现在 `registry.ts`。
  组件代码里**零** `baseUrl`、**零** path 拼接。
- **Service 模板**:与 `auth.ts` 同构,`BASE = '/api/v1/auth' as const satisfies ApiPathLiteral`。
- **Store 实例化在 host**:`userKvStore.ts` 保留(debounce / LS 降级),
  但**只 host 注入 `client`**,组件不创建。
- **JWT 持久化位置**:authStore 拥有 localStorage(`sl-userkv:v1:token`),
  组件不读不写。
- **LoginModal UI 边界**:Vue host 拥有,React 组件不能直接 import `.vue` 文件。
  React 端通过 `useAuth()` 读状态 + `openLoginModal()` 触发显示。

### D4:删除旧 client

`packages/react-components/src/shortcut-library/src/engine/authClient.ts` 删除。
`packages/react-components/src/shortcut-library/src/engine/userKvClient.ts` 删除。

`userKvStore.ts` 保留,但构造参数由 `baseUrl: string` 改为 `client: UserV1Service` +
`kvClient: KvV1Service`,由 host 在 `services/shortcut-library/` 里组装。

### D5:shortcut-library 改动

- `index.tsx`:删 `useAuth()` 以外的 fetch 相关 import
- `src/hooks/useAuth.ts`:新,导自 host `useAuth()`
- `src/hooks/useShortcuts.ts`:使用 host 实例化的 store
- `src/pages/SettingsPanel.tsx`:删 login 表单,改为 "点击 logo 跳转 host 登录 / 点击退出调 authStore.logout()"
- `src/pages/ImportModal.tsx` / `src/pages/CapturePopover.tsx` / `src/pages/ShortcutTable.tsx` 等:不需要改动

## 6. 数据流

### 6.1 登录

```
User 点击 Login → host 打开 <LoginModal/> 
                → userV1.sendCode(email) → userV1.register(args) → userV1.login(args)
                → 成功:token 写入 localStorage + authStore.token
                → authStore.authState = 'logged-in'
                → Pinia 通知所有订阅者
                → React 端 useAuth() 触发重渲染
                → shortcut-library userKvStore.save() 走通(有 token)
```

### 6.2 React 订阅

```tsx
const auth = useAuth();
if (auth.authState === 'logged-out') return <button onClick={openLoginModal}>登录</button>;
```

### 6.3 KV 同步

```
shortcut-library useShortcuts.ts
  ├─ useEffect(() => {
  │   const store = createShortcutKvStore({ auth, ... });
  │   store.init();
  │   ...
  │ }, []);
  └─ 调用 store.save(groups) → 走 host services/kvV1.set
                              → api.post('/api/v1/kv', ...)
                              → 自动带 Bearer header
```

## 7. 错误处理

| 场景 | 处理 |
|---|---|
| 网络断 / 502 | `api.post` 抛 `ApiError(0, 'network: ...')` → service 层 catch → `Result<T, ApiError>` `{ok: false, error: {...}}` |
| 401 | `shared/request.ts` 接 401 → `authStore.markRequiresLogin()` → 状态变 `'logged-out'` |
| 业务 code≠0 | `api` 抛 `ApiError(code, message)` → service 转为 `Result<T, ApiError>` |
| 重复调用累积 | 组件层 `useShortcuts` 自带 debounce / 冲突重试 |
| Token 过期 | 401 触发 → authStore 清 token + 通知订阅者 → React 端自动重渲染到未登录状态 |

### 7.1 Login 接口不走 401 拦截

`userV1.login` / `userV1.register` 是拿 token 的入口,调用时**没有** token,
也不会 401,所以不需要 `skipUnauthorized` 开关。401 拦截由 authStore 推动。

## 8. 测试

| 层 | 文件 | 验证 |
|---|---|---|
| `api/services/userV1.ts` | `apps/showcase/__tests__/userV1.test.ts` (新) | mock `global.fetch`,断言 URL / Bearer / body / 解包 |
| `api/services/kvV1.ts` | `apps/showcase/__tests__/kvV1.test.ts` (新) | 同上 |
| `api/services/shortcut-library/` | `apps/showcase/__tests__/shortcut-library-store.test.ts` (新) | store 实例 + Bearer 注入 + debounce |
| `shared/auth-store.ts` | `apps/showcase/__tests__/auth-store.test.ts` (扩展) | 状态机、401 信号、跨事件订阅 |
| `shortcut-library` 现有测试 | `packages/react-components/__tests__/shortcut-library*` | 保留,内部 import 路径须更新 |
| 整体 smoke | `pnpm exec vitest run` | 全绿 |

## 9. 迁移步骤

1. **前置**: git commit 当前 `shortcut-library` 拆目录重构
2. `registry.ts`:加 `userV1` / `kvV1` entry,扩 `BackendId` + `apiPaths`
3. `shared/request.ts`:加 `setBearerProvider()`
4. `shared/auth-store.ts`:Pinia 化 + 暴露 `useAuth()` hook
5. `api/services/userV1.ts`:5 个端点
6. `api/services/kvV1.ts`:4 个端点
7. `api/services/shortcut-library/createShortcutStore.ts`:组装 store
8. **复刻 LoginModal UI**(单独立 commit,含 UI 类型脚本):
   - `shared/login-modal.vue` + `shared/login-modal.css`(或拆 particles/ 子目录)
   - 把 `moebius-login (11).html` 的 canvas ink engine 移植到 `<script setup>`
   - `<style scoped>` 用原 CSS 变量
   - 删 `divider/alt` 区块,保留其余
   - 接入 `useAuthStore().login` —— submit 按钮 → `await login(email, pwd)`
   - 成功 → `welcome` 二次页动画
9. `apps/showcase/src/router/` + `pages/`:注册 `<LoginModal/>` 触发点
   (顶导 "<登录>" 按钮或 `useLoginModal()` 暴露全局 imperative)
10. `shortcut-library`:
    - 删 `authClient.ts` / `userKvClient.ts`
    - 改 `userKvStore.ts` 构造参数
    - 改 `useShortcuts.ts` import 路径
    - 改 `SettingsPanel.tsx` 删 login 表单,改为"未登录提示 + 调 `openLoginModal()`"
    - 新 `src/hooks/useAuth.ts` 从 host re-export
    - 新 `src/hooks/useLoginModal.ts` 跨框架调 host 的 imperative modal
11. 测试全部跑绿

## 10. 风险与回退

- **风险**:Pinia store 跨框架订阅可能有 event loop 顺序问题(register / react 同步激活 BearerProvider)。
  缓解:在 `authStore.init()` 同步调用 `setBearerProvider(() => this.token)`。
- **风险**:Vue host 集成 React 组件时,mount adapter 的 `props` 传 `useAuth` hook 阻塞组件启动。
  缓解:mount adapter 实例化时同步注入 `useAuth` 引用,组件只在 mount 时调用。
- **风险**:完全复刻 LoginModal —— canvas ink engine 在多浏览器兼容(headless / Safari / mobile)需
  重点验证 (`prefers-reduced-motion` / DPR 自适配 / touch 事件)。
  缓解:保留设计稿 `prefers-reduced-motion: reduce` 跳过动画分支;DPR 封顶 1.5 避免 retina 过载;
  `matchMedia('(hover:none)')` 隐藏 custom cursor。测试组 `@/shared/__tests__/login-modal.test.ts` 覆盖以上分支。
- **风险**:LoginModal 触发出口跨框架暴露给 React(`useLoginModal()` hook) —— host 端有可能
  Vue SFC 实例被卸载后,React 组件仍持有对 modal 引用导致 setState on unmounted 警告。
  缓解:`useLoginModal()` 返回 hook 内部用 `useRef` 缓存订阅;卸载时 unmount。
- **回退**:所有改动可以 git revert 单个 commit,迁移本身是 atomic commit 链。
