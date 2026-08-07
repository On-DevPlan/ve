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
| 组件需要后端 API(dev 代理 / 生产 nginx 路由 / 跨设备 API) | 在 `apps/showcase/src/api/registry.ts` 的 `apiPaths` 加一行 + 加 entry,写 `apps/showcase/src/api/services/<id>/index.ts` + `types.ts`(继承 `HttpService`,`BASE = apiPaths.<id>`),组件用 `import ... from '@api'` 引用。详见 [[protocol]] §4.4 |
| 组件应用层怎么读登录态 / 调后端 / 新增业务封装(组件 ↔ host 跨包引用) | [[how-to-consume-api]] |
| `apps/showcase/src/shared` 层是什么 / 怎么用 / 跟 api 分层怎么划 | [[shared-layer]] |
| 线上 405 / 404 / 502,但本地正常 —— API 路由在 prod 没生效 | 检查 `vite build` 是否触发 gen-nginx 插件(生成 `nginx/api-locations/generated.conf`);检查 `default.conf` 是否 include `/etc/nginx/api-locations/*.conf` |
| 组件不显示 / "No loader registered" / ShadowRoot 没样式 / mount 抛错 / 路由 404 / ESLint 报错——按决策树排查 | [[component-decision-tree]] |
| 加/删组件后 dev server 行为不对(manifest 没更新 / 浏览器没刷新) | [[dev-server-watcher]] |
| 想了解 Manifest ↔ Loader 对账机制的实现细节(loader-inventory / reconcile / 错误信息) | [[manifest-loader-reconciliation]] |
| lint 报错 / 自动修复 / 提交前清理 | [[fix-lint-loop]] |
| build 产物 Shadow DOM 样式丢失(常见冷门坑) | [[shadow-dom-build-css-loss]] |
| 组件首屏白屏感,首次会话看不到骨架过渡 | [[loading-skeleton-first-session]] |
| 决定新约束用 ajv schema 还是 ESLint 规则 | [[when-eslint-vs-ajv]] |
| 写自定义 ESLint 规则(AST / filename / 字面量提取样板) | [[eslint-pattern-recipes]] |
| 写自定义规则的测试(RuleTester + ts parser) | [[eslint-testing-pattern]] |
| 给现有 `valid-component-config` 加新 messageId | [[eslint-extending-existing]] |

## 仓库锚点

- Host: `apps/showcase/`
- 组件 loader 自动发现: `apps/showcase/src/registry/loaders.ts`
- 契约(类型 + JSON Schema): `packages/component-contract/`
- Manifest 扫描器 + Vite 插件: `packages/manifest-generator/`
- API 路径单一源: `apps/showcase/src/api/registry.ts`(`apiPaths` 字面量 + entry;`BackendId` 从 registry key 自动推导)
- API 统一收口: `apps/showcase/src/api/index.ts`(组件/宿主 `import ... from '@api'` 拿所有 service + 类型)
- 组件应用层跨包引用: 见 [[how-to-consume-api]](三条 import 通道 + 别名配置 + 新增业务封装步骤)
- service 分层: `apps/showcase/src/api/services/<id>/`(HTTP wrapper: `index.ts` + `types.ts`,继承 `HttpService`)+ `apps/showcase/src/api/components/<id>/`(组件业务封装,如 `createShortcutStore`)
- 生产 nginx 路由生成: `vite build` 内联插件(closeBundle 调 `genNginxOut()` 写 `nginx/api-locations/generated.conf`)
- nginx 站点配置(手写部分): `default.conf`(生成的 location 由它 include)
- 运行时挂载适配器(ShadowRoot + 样式 adoption): `packages/mount-adapters/`
- 组件 CSS 同步注入(`MountContext.cssReady` + `ShadowRootHost.injectCss` + `adoptCssTexts` + `ensureCss`):同帧落 ShadowRoot,消除 FOUC;远程组件 `loaderUrl` 走 `adoptStylesInto` 兜底
- Vue scoped CSS 接入 Vite CSS 管线(`vue-style-collector` + `scoped-id-guard`):伪 `.css` 路径让 vite CSS 接管 postcss / url / @import;插件扫 SFC `import '*.css'` 自动把 ol.css 等第三方 CSS 也进 ShadowRoot;`scopedId` 算法复刻 plugin-vue,guard 在 build 期拦截漂移
- 加载过渡(首次会话首屏骨架,0.6s ease):`apps/showcase/src/shared/LoadingSkeleton/`(框架无关核心 `skeleton.ts` + Vue/React 适配;sessionStorage 标记仅首次显)
- 自定义 ESLint 规则: `eslint/rules/valid-component-config.js`

## 常用命令

```bash
pnpm install
pnpm --filter @style-library/showcase dev        # 启动 showcase (5173)
pnpm --filter @style-library/showcase build      # 生产构建(同时生成 nginx/api-locations/generated.conf)
pnpm lint / lint:fix / lint:summary / lint:loop # lint 工具链
pnpm exec vitest run                             # 测试
```

## 约定

- 不改 main / master,所有变更走 feature 分支
- Conventional Commits,每个任务一个 atomic commit
- 加组件 = 写 `component.config.ts` + `index.{vue,tsx}`(零配置,详见 [[how-to-add-component]])
- 删组件 = 删整个目录(详见 [[dev-server-watcher]])
- 卡片列表不 import 组件实现 —— CardGrid 只读 metadata,实现走 dynamic import 分 chunk
- 组件需要后端 = 在 `apps/showcase/src/api/registry.ts` 的 `apiPaths` 加一行 + 加 entry,写 `services/<id>/index.ts` + `types.ts`(继承 `HttpService`,`BASE = apiPaths.<id>`),组件 `import ... from '@api'`;业务封装放 `api/components/<id>/`。dev `apiGateway()` + prod nginx(build 内联生成)共用 registry 归一化,**不要**改 `vite.config.ts` / 手写 `default.conf`;更不要回退到 `component.config.ts` 的 `api` 字段(已废弃)
- 自定义 ESLint 规则先看 [[when-eslint-vs-ajv]] 决定放 ajv 还是 ESLint