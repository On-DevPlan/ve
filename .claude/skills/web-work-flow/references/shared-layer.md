---
ref: shared-layer
parent: web-work-flow
---

# shared 层(宿主共享能力)怎么用

`apps/showcase/src/shared/` 是**宿主横切层**——放与具体后端无关、可跨框架复用的能力。
它跟 `api/` 的分界:

```
apps/showcase/src/
├── api/      → 后端通信层(registry / services / components,按后端路径 + 组件分层)
└── shared/   → 宿主横切能力(认证状态、HTTP 客户端、登录弹窗、跨平台工具)
```

依赖方向:`api/ → shared/`(services/base → request;components → auth-store),**反向禁止**。

---

## 1. 目录清单 + 用法

| 文件 | 导出 | 怎么用 |
|---|---|---|
| `auth-store.ts` | `jwtAuth`(login/register/logout/init)、`useJwtAuth()`(React)、`subscribeJwtAuth`、`TOKEN_KEY` | **JWT 认证单例**。Vue:`jwtAuth.state` + computed;React:re-export `useJwtAuth()`;经 `setBearerProvider` 注入 `api/http/request` |
| `useLoginModal.ts` | `openLoginModal` / `closeLoginModal` / `useLoginModalState` / `subscribeLoginModal` + `getLoginModalSnapshot` | **登录入口(路由式)**。`openLoginModal()` = `router.push('/login')`(带 from query),React 端 `useLoginModal()` re-export;`isOpen` = `window.location.pathname === '/login'` |
| `canvas-engine.ts` | `startCanvas(canvas)` | `pages/login/LoginPage.vue` 的背景画布,一般不外调 |
| `router-accessor.ts` | `setRouter` / `getRouter` | shared 层拿 vue-router 实例的窗口(避免 shared 依赖 router 包);`main.ts` 启动时 `setRouter(router)` |
| `utils.ts` | `hasWindow()` | SSR/CSR 分流,给要碰 window/localStorage 的代码用 |

> **注意**:HTTP fetch 客户端**不在 shared/** —— 它在 `apps/showcase/src/api/http/request.ts`
> (`api.*`, `api.raw.*`, `setBearerProvider`, `setBearerUnauthorizedHandler`, `ApiError`)。
> 因为 request 不依赖任何框架/状态,归到 `api/` 传输层,401 handler 靠注入解环。
> 登录 UI 也不在 shared —— 在 `pages/login/LoginPage.vue`(路由页)。

## 2. 三类消费者的引用方式

**① 宿主页面 / Vue 组件**(`pages/`、`App.vue`、`main.ts`):
```ts
import { jwtAuth } from '@/shared/auth-store';
import { useLoginModalState } from '@/shared/useLoginModal';   // open() = router.push('/login')
// 登录页不是 shared 组件,是路由页: pages/login/LoginPage.vue(经 router)
```

**② api 层**(`api/`,单向依赖 shared 之外的传输层):
```ts
// services/base.ts —— HTTP 客户端在 api/http/request.ts(不进 shared)
import { api, ApiError } from '../http/request';
// components/shortcut-library/createShortcutStore.ts —— 目录内走相对路径,不 import @api
import { jwtAuth } from '@/shared/auth-store';
```

**③ React 组件**(跨包,re-export 不重实现):
```ts
// packages/react-components/src/<id>/src/hooks/useAuth.ts
export { useJwtAuth, getJwtAuthSnapshot, jwtAuth } from '@/shared/auth-store';
// .../src/hooks/useLoginModal.ts  →  re-export from '@/shared/useLoginModal'
```
React 组件不直接 import Vue SFC(登录页 `LoginPage.vue` 是 Vue 路由页,React 无法用)——只调 `useLoginModal().open()`(内部 router.push('/login'))。

跨包靠 `@/shared/*` 别名(指向 `apps/showcase/src`),三处配置同步:
`apps/showcase/tsconfig.json`、`packages/react-components/tsconfig.json`、`vitest.workspace.ts`(showcase + react-components 两个 block)。vite 运行时由 `@` 别名覆盖。

## 3. 新增一个 shared 模块的准则

放 `shared/` 的前提:**跨框架复用 + 与具体后端无关**。

| 你想放什么 | 放哪 |
|---|---|
| 认证 / HTTP 客户端 / 登录弹窗 / 跨平台工具 | `shared/`(本层) |
| 某组件专属的业务封装(如 `createShortcutStore`) | `api/components/<id>/` |
| 后端 HTTP wrapper(按路径 `userV1` / `kvV1`) | `api/services/<id>/` |

在 React 端可用 → 提供 React hook / `useSyncExternalStore` 桥(见 `useJwtAuth`、`useLoginModal`)。
SSR 安全 → 用 `hasWindow()` 分流,不在模块顶层碰 window。
