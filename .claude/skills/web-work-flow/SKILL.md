---
name: web-work-flow
description: Use when working on the ve project (D:\DevProjects\my\github\ve) — a Vue-host + React-compatible micro-frontend showcase. Trigger on questions about architecture / how to add or delete components / fixing lint / debugging manifest issues / dev server setup / component-level dev dependencies / backend API routing in dev or production / nginx route generation / troubleshooting a broken component / authoring a new ESLint rule. Loads the right reference doc on demand instead of dumping everything upfront.
---

# web-work-flow

`ve` 项目入口 skill。**KV 映射**——按主题路由到具体 reference。

> 渐进式披露:先读 SKILL.md 找 key,再按需加载对应 ref。

## 路由表

| 你在做什么 | 读 |
|---|---|
| 想理解整体架构(为什么 Vue 当 host / 跨框架机制 / Vite 角色 / 样式 adoption) | [[architecture-and-design-philosophy]] |
| 想理解组件协议全貌(ComponentConfig / ManifestEntry 字段状态 / 哪些已闭合、哪些是遗留) | [[protocol]] |
| 新增 / 删除一个 Vue 或 React 组件 | [[how-to-add-component]] |
| 组件目录比较大(`index.{vue,tsx}` > 300 行),需要拆分子目录布局 | [[large-component-layout]] |
| 组件需要后端 API(dev 代理 / 生产 nginx 路由 / 跨设备 API) | [[component-level-dev-proxy]] |
| 线上 405 / 404 / 502,但本地正常 —— API 路由在 prod 没生效 | [[component-level-dev-proxy]] |
| 组件不显示 / "No loader registered" / ShadowRoot 没样式 / mount 抛错 / 路由 404 / ESLint 报错——按决策树排查 | [[component-decision-tree]] |
| 加/删组件后 dev server 行为不对(manifest 没更新 / 浏览器没刷新) | [[dev-server-watcher]] |
| 想了解 Manifest ↔ Loader 对账机制的实现细节(loader-inventory / reconcile / 错误信息) | [[manifest-loader-reconciliation]] |
| lint 报错 / 自动修复 / 提交前清理 | [[fix-lint-loop]] |
| build 产物 Shadow DOM 样式丢失(常见冷门坑) | [[shadow-dom-build-css-loss]] |
| 决定新约束用 ajv schema 还是 ESLint 规则 | [[when-eslint-vs-ajv]] |
| 写自定义 ESLint 规则(AST / filename / 字面量提取样板) | [[eslint-pattern-recipes]] |
| 写自定义规则的测试(RuleTester + ts parser) | [[eslint-testing-pattern]] |
| 给现有 `valid-component-config` 加新 messageId | [[eslint-extending-existing]] |

## 仓库锚点

- Host: `apps/showcase/`
- 组件 loader 自动发现: `apps/showcase/src/registry/loaders.ts`
- 契约(类型 + JSON Schema): `packages/component-contract/`
- Manifest 扫描器 + Vite 插件: `packages/manifest-generator/`
- 生产 nginx 路由生成: `packages/manifest-generator/src/nginx-emit.ts` + `scripts/gen-nginx.mjs`
- nginx 站点配置(手写部分): `default.conf`(生成的 location 由它 include)
- 运行时挂载适配器(ShadowRoot + 样式 adoption): `packages/mount-adapters/`
- 自定义 ESLint 规则: `eslint/rules/valid-component-config.js`

## 常用命令

```bash
pnpm install
pnpm --filter @style-library/showcase dev        # 启动 showcase (5173)
pnpm --filter @style-library/showcase build      # 生产构建
pnpm gen:nginx                                   # 从 component.config.ts 的 api 生成 nginx location
pnpm lint / lint:fix / lint:summary / lint:loop # lint 工具链
pnpm exec vitest run                             # 测试
```

## 约定

- 不改 main / master,所有变更走 feature 分支
- Conventional Commits,每个任务一个 atomic commit
- 加组件 = 写 `component.config.ts` + `index.{vue,tsx}`(零配置,详见 [[how-to-add-component]])
- 删组件 = 删整个目录(详见 [[dev-server-watcher]])
- 卡片列表不 import 组件实现 —— CardGrid 只读 metadata,实现走 dynamic import 分 chunk
- 组件需要后端 = 在 `component.config.ts` 声明 `api`(dev 与 prod 的唯一事实源),**不要**改 `vite.config.ts` 或手写 `default.conf`
- 自定义 ESLint 规则先看 [[when-eslint-vs-ajv]] 决定放 ajv 还是 ESLint