# @style-library/ve

基于 **Vue 3 + Vite** 的 Vue-host + **React-compatible 微前端**组件演示系统。
组件由 `component.config.ts` 描述,build 时由 Vite 插件扫盘生成 manifest,
showcase 应用自动发现、注册、产出路由 —— 加组件 = 写两个文件。

## 仓库结构(pnpm workspace monorepo)

```
.
├── apps/
│   └── showcase/              # 唯一宿主 app:Vue 3 + Vite,同时承载 React 组件
│                              #   (React 走 packages/mount-adapters 桥接进 ShadowRoot)
├── packages/
│   ├── vue-components/        # 全部 Vue 组件 demo,每个 demo 一个目录
│   ├── react-components/      # 全部 React 组件 demo,每个 demo 一个目录
│   ├── manifest-generator/    # Vite 插件:扫 component.config.ts → ComponentManifest
│   ├── mount-adapters/        # Vue/React mount 适配 + ShadowRoot 隔离
│   └── component-contract/    # TypeScript 类型 + JSON schema("组件协议")
├── eslint/                    # ESLint 9 flat config 分层:base / vue / react / node / rules
├── scripts/                   # 原子脚本:lint-fix / lint-summary / lint-loop / commit-lint-clean
├── docs/                      # architecture / mobile-designs / superpowers / workflow-canvas
├── .github/workflows/         # lint.yml(PR 触发,3 个并行 job:lint / build / test)
└── .husky/                    # git hook(pre-commit → lint-staged → eslint)
```

## 架构骨架

```
                ┌──────────────────────────────────────────┐
                │ apps/showcase (Vue 3 + Vite, host SPA)   │
                │                                          │
   build 期:    │  vite build                              │
                │   └─ plugin: @style-library/             │
                │         manifest-generator               │
                │   └─ 扫 packages/**/component.config.ts  │
                │   └─ 产出 ComponentManifest(注入 window) │
                │                                          │
   runtime:     │  components/registry      (refs + 列表)  │
                │  router/RouterRegistrar   (自动注册路由) │
                │  SearchIndex              (search 模块)  │
                │                                          │
                │  组件挂载:                                │
                │   ├─ Vue  组件 → VueMountAdapter         │
                │   └─ React 组件 → ReactMountAdapter       │
                │             → ShadowRootHost(隔离样式)   │
                └──────────────────────────────────────────┘
                        ▲                          ▲
                        │ 协议(component-contract)│
                        │ ComponentConfig 类型 +  │
                        │ manifest / route /     │
                        │ mount / isolation /    │
                        │ theme 字段             │
                        │                          │
   ┌────────────────────┴──────┐         ┌─────────┴────────┐
   │  packages/vue-components/  │         │ packages/react-  │
   │  各 demo 目录:              │         │  components/     │
   │   component.config.ts      │         │  各 demo 目录:    │
   │   index.vue                │         │   component.config.ts │
   │                            │         │   index.tsx              │
   └────────────────────────────┘         └─────────────────────┘
```

## 快速开始

> 需要 **Node ≥ 22** + **pnpm ≥ 9**(锁文件 `packageManager` 字段已钉)。

```bash
pnpm install            # 同时会触发 "prepare" 脚本装 husky 的 hooks
pnpm dev                # 启动 showcase(app 在 5173,Vite 默认)
pnpm build              # 产出 apps/showcase/dist
pnpm preview            # 预览生产构建
```

`pnpm install` 后,**pre-commit hook 已就绪** —— 之后每次 `git commit` 都会自动 lint,
详见 [开发与代码质量](#开发与代码质量)。

## 添加一个新组件 demo

> 适用:在 showcase 里加一个新卡片 + 路由。组件库已在 `packages/` 内提供,详见
> `apps/showcase/src/registry/` 与 `packages/manifest-generator/`。

挑一个目标框架的包,在 `packages/vue-components/src/<demo-id>/`
或 `packages/react-components/src/<demo-id>/` 下放两个文件即可:

```
packages/<vue|react>-components/src/<demo-id>/
├── component.config.ts        # 组件协议(必填,Vite 插件扫的是这个)
└── index.vue  或  index.tsx   # 你的实现
```

`component.config.ts` 形态参考 `packages/vue-components/src/mobile-nav-v5/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'demo-id',                       // 唯一 id,也是路由 path
  name: 'DemoComponent',               // 组件名(PascalCase)
  title: '演示标题',                    // 卡片与详情页标题
  description: '一句话描述',
  version: '1.0.0',
  framework: 'vue',                    // 或 'react'
  entry: './index.vue',                // 相对 component.config.ts
  group: '分类',                        // 卡片左侧分组
  category: '类型',                     // 卡片右侧类别
  tags: ['demo'],
  platform: 'both',                    // 'desktop' | 'mobile' | 'both'
  status: 'stable',                    // 'stable' | 'experimental' | 'wip'
  route: {
    path: '/components/demo-id',
    title: '演示标题',
  },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: false, fullscreenMode: 'container' },
} satisfies ComponentConfig;
```

字段的全部契约见 [`packages/component-contract/src/types.ts`](packages/component-contract/src/types.ts)
(spec §4 ComponentConfig / §5 Manifest)。

加完两个文件、跑 `pnpm dev`,showcase 会**自动发现**该组件,
首页出现新卡片、`/components/<demo-id>` 出现新详情页 —— 无需改 showcase 源码。

## 协议与构建产物

- **`@style-library/component-contract`** —— 组件配置的类型与 JSON schema 单一来源。
  调整字段 = 同时改这一处 + 必跑 `pnpm test`(generator / adapter / validator 都依赖)。
- **`@style-library/manifest-generator`** —— Vite 插件,扫 `component.config.ts` 输出 `ComponentManifest`。
- **`@style-library/mount-adapters`** —— `VueMountAdapter` / `ReactMountAdapter`、
  `ShadowRootHost`(隔离样式)、`AdapterFactory`(按 manifest.mount.kind 派发)。

## 技术栈

- **宿主**:Vue 3(Composition API)+ Vite 5
- **辅助栈**:Vue Router(自动生成)+ Lucide icons(@lucide/vue)
- **微前端能力**:React 19 组件可 mount 入 Vue host(`packages/mount-adapters`)
- **隔离**:ShadowRoot(`packages/mount-adapters` 的 `ShadowRootHost`)
- **协议**:TypeScript + JSON Schema,见 `packages/component-contract`
- **构建产物**:静态 SPA(容器化见 `Dockerfile`)

## 开发与代码质量

提交前、合并前各有一道闸门,且都为可被绕过的非强制护栏。

### Lint 三层防线

| 层 | 时机 | 工具 | 失败时 |
|---|---|---|---|
| **pre-commit hook** | `git commit` 时自动触发 | `husky` + `lint-staged` 只对 staged 的 `*.{ts,tsx,js,jsx,mjs,cjs,vue}` 跑 `eslint --max-warnings=0` | exit 1,**commit 被拒**,规则名 + 文件:行:列打印到终端 |
| **PR CI** | 任何 PR 触发,3 个 job 并行 | `pnpm exec eslint . --max-warnings=0` / `pnpm build` / `pnpm test` | 任意 job 红 → PR 不能合 |
| **`lint:summary:strict`** | 本地/CI 通用门禁 | `node scripts/lint-summary.mjs --self --strict` | errors>0 或 warnings>0 → exit 1 |

`pnpm install` 会通过 `prepare: husky` 自动设置 hooks,**clone 后无需手动配置**。

### 日常命令

```bash
pnpm lint                   # 全量 lint,严格(max-warnings=0),失败退出非零
pnpm lint:fix               # 全量 eslint --fix(Windows shell 兼容版)
pnpm lint:summary           # 只读摘要:按规则聚合打印,exit 0
pnpm lint:summary:strict    # 当门禁用:errors>0 或 warnings>0 即 exit 1
pnpm lint:loop              # fix → 重 lint → 打印 summary 的循环
pnpm test                   # vitest 全量跑
```

### 关于 `lint:summary` vs `lint:summary:strict`

`pnpm lint:summary` 设计上是**只读摘要**,无论 lint 干净或脏都 exit 0 —— 历史原因:`scripts/lint-loop.mjs` 和 `commit-lint-clean.mjs` 都按"summary 失败 = 脚本本身解析崩"来接驳,不该被"仓库 lint 脏"误伤。

如果你要把仓库 lint 状态当门禁(CI、自动化脚本),用 **`pnpm lint:summary:strict`** —— 它在 `--strict` 模式下,errors 或 warnings 任一 > 0 就 exit 1,且完整规则表照常打印到终端。

### 紧急逃生门

需要绕过 hook(比如合法 hotfix)时,只对当次提交使用:

```bash
git commit --no-verify -m "..."
```

**不应成为习惯。** 走 PR 时 CI 仍会拦下同样的问题。

## 参考

- [`packages/component-contract/src/types.ts`](packages/component-contract/src/types.ts) —— 组件协议类型源
- [`docs/architecture/framework-architecture-review.md`](docs/architecture/framework-architecture-review.md) —— 整体架构评审
- [`docs/architecture/manifest-loader-reconciliation.md`](docs/architecture/manifest-loader-reconciliation.md) —— manifest 与 loader 的对齐
