---
ref: how-to-consume-api
parent: web-work-flow
---

# 组件应用层引用 API 的工作流

讲清楚一个 micro-frontend 组件(如 `shortcut-library`)怎么从 `packages/*-components/`
跨到 host(`apps/showcase/`)读登录态、调后端、新增业务封装。**组件自身不持有任何
HTTP / JWT / token 逻辑** —— 全部由 host 侧提供,组件只引用。

---

## 1. 三条 import 通道

组件包(`packages/react-components/src/<id>/`、`packages/vue-components/src/<id>/`)
能 import host 的哪些东西,取决于路径别名(见 §3)。实际有三条通道:

| 通道 | 例子 | 用途 |
|---|---|---|
| `@/shared/*` | `import { useJwtAuth } from '@/shared/auth-store'` | 读 host 共享状态 / hook(登录态、登录入口开关、主题等) |
| `@api` | `import { kvV1Service, type UserInfo } from '@api'` | 直接调 HTTP service / 引后端类型(一般经业务封装,不直接用) |
| `@api/components/<id>/*` | `import { createShortcutStore } from '@api/components/shortcut-library/createShortcutStore'` | **组件自己的业务封装**(host 侧实现,`api/components/<id>/`) |

**约定**:组件尽量只走 `@/shared/*`(读状态/hook)和 `@api/components/<id>/*`(业务封装),
不直接碰 `@api` 的 service 实例 —— 业务封装层负责把 `kvV1Service` 等拼成组件语义的 API。

## 2. 组件读登录态 / 触发登录

host 提供两个跨框架 hook,组件在 `src/hooks/` 里 **re-export**(不重实现):

```ts
// packages/react-components/src/<id>/src/hooks/useAuth.ts
export { useJwtAuth, getJwtAuthSnapshot, jwtAuth } from '@/shared/auth-store';
export type { JwtAuthStatus } from '@/shared/auth-store';
```

```ts
// .../src/hooks/useLoginModal.ts
import { useSyncExternalStore } from 'react';
import { subscribeLoginModal, getLoginModalSnapshot, openLoginModal, closeLoginModal } from '@/shared/useLoginModal';

export function useLoginModal() {
  const isOpen = useSyncExternalStore(subscribeLoginModal, getLoginModalSnapshot, getLoginModalSnapshot);
  return { isOpen, open: openLoginModal, close: closeLoginModal };
}
```

组件消费:

```tsx
const auth = useJwtAuth();                 // { jwtAuthState, jwtUser, token, lastError }
const { open } = useLoginModal();          // open() = router.push('/login')(路由式)
if (!auth.token) return <button onClick={open}>登录</button>;
```

- 登录态:来自 host 的 `jwtAuth` 单例(Bearer JWT,存 localStorage)。
- 登录 UI:路由页 `pages/login/LoginPage.vue`(`/login`),组件只调 `open()`(内部 router.push)。
- 401:host `request.ts` 自动清 JWT 降级游客,组件无需感知。

## 3. 别名配置(缺一处 = `Cannot find module`)

跨包 import 靠路径别名,三处必须同步:

| 配置 | `@/shared/*` | `@api` / `@api/*` |
|---|---|---|
| `apps/showcase/tsconfig.json` | `@/*` → `src/*` | `@api` → `src/api/index`、`@api/*` → `src/api/*` |
| `packages/react-components/tsconfig.json` | `@/*` → `../../apps/showcase/src/*` | 同上(前缀 `../../apps/showcase`) |
| `apps/showcase/vite.config.ts` | `@` → `src` | `@api` → `src/api` |
| `vitest.workspace.ts`(showcase + react-components 两个 block) | `@` → `apps/showcase/src` | `@api` → `apps/showcase/src/api` |

**加别名时四处都要加**(tsconfig × 2 + vite + vitest × 2),否则 build / test / 编辑器各自报错。

## 4. 新增一个"组件业务 API"的完整步骤

场景:组件需要一组新的后端交互(如 shortcut-library 的云同步)。遵循分层:

```
services/              ← HTTP wrapper(按后端路径),已有则复用
  └── kvV1/index.ts    ← KvV1Service extends HttpService,BASE = apiPaths.kvV1
components/            ← 组件业务封装(host 侧,组件语义)
  └── shortcut-library/
      ├── index.ts
      ├── types.ts     ← Group / Shortcut 等组件域类型
      └── createShortcutStore.ts  ← 拼 kvV1Service + jwtAuth,导出 load/save
```

步骤:

1. **后端路径**:在 `apps/showcase/src/api/registry.ts` 的 `apiPaths` 加一行 + 加 entry
   (若该后端 HTTP wrapper 已存在则跳过)。
2. **HTTP wrapper**:写 `apps/showcase/src/api/services/<id>/index.ts`(extends `HttpService`,
   `BASE = apiPaths.<id>`) + `types.ts`。见 `services/kvV1/` 样板。
   `HttpService` 基类(`../base`)内部走 `../http/request`(fetch 客户端在 `api/http/`,
   **不在 shared/**,也不经 `@api` 桶)。
3. **业务封装**:建 `apps/showcase/src/api/components/<id>/index.ts` + `createShortcutStore.ts`。
   **目录内部 import 一律相对路径**(如 `import { kvV1Service } from '../../services'`),
   **不要** `import ... from '@api'` —— `@api` 解析到 `api/index.ts`,而 index 又
   `export * from './components'`,形成 self-cycle(index → components → store → index),
   求值顺序取决于谁先被 import,`@api` 只留给 `src/api/` **外部**调用方。
   `jwtAuth` 等全局状态从 `@/shared/auth-store` 引,方向合法。
4. **组件消费**:在 `packages/*-components/src/<id>/src/hooks/` 写或改 hook,
   `import { createShortcutStore } from '@api/components/<id>/...'`。
5. **测试**:host 侧 `apps/showcase/__tests__/<id>-store.test.ts`(mock `global.fetch`
   验证 service 调用);组件侧 hook 测试(mock `@api` 模块 / 全局 fetch)。

## 5. 为什么分层

- `services/` 按**后端路径**命名(`userV1` / `kvV1`)——基础设施概念,可被任意组件复用。
- `components/` 按**组件名**命名(`shortcut-library`)——应用概念,只服务某个 mfe。
- 依赖单向:`components/ → services/`,禁止反向。
- 好处:加新组件不清污染 services;加新后端不改组件层。
