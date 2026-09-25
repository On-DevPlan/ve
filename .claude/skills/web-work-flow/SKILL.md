---
name: web-work-flow
description: Use when working on the ve project (this repository) — a Vue-host + React-compatible micro-frontend showcase. Trigger on questions about architecture / how to add or delete components / fixing lint / debugging manifest issues / dev server setup / component-level dev dependencies / backend API routing in dev or production / nginx route generation / troubleshooting a broken component / authoring a new ESLint rule. Loads the right reference doc on demand instead of dumping everything upfront.
---
# web-work-flow

`ve` 项目入口 skill。**KV 映射**——按主题路由到具体 reference。

> 渐进式披露:先读 SKILL.md 找 key,再按需加载对应 ref。

## 序列总览(先读这里)

ref 按读者意图分四个序列。先记「字母 = 读者意图」,再到路由表按行找具体 ref。

| 代号 | 类别(读者意图)             | 成员                                                                                                                                             |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | 理解与机制(为什么这样设计) | A01 架构与设计哲学 / A02 组件协议 / A03 shared 层 / A04 manifest-loader 对账 / A05 CSS 同步注入 / A06 首屏骨架 / A07 组件级 API 代理(已废弃档案) |
| B    | 组件开发(动手加东西)       | B01 加/删组件 / B02 大组件布局 / B03 组件消费 API / B04 有状态+AI 提示词组件范式                                        |
| C    | 排查修复(出问题了)         | C01 故障决策树(排查总入口) / C02 dev server watcher / C03 build 样式丢失 / C04 lint 修复循环                                                     |
| D    | ESLint 专项(写自定义规则)  | D01 ajv vs ESLint 选型 / D02 规则样板 / D03 规则测试 / D04 扩展现有规则                                                                          |

## 路由表

| 代号 | 你在做什么                                                                                                                         | 读                                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | 想理解整体架构(为什么 Vue 当 host / 跨框架机制 / Vite 角色 / 样式 adoption)                                                        | [[A01-architecture-and-design-philosophy]]                                                                                                                                                                                                                                                |
| A02  | 想理解组件协议全貌(ComponentConfig / ManifestEntry 字段状态 / 哪些已闭合、哪些是遗留)                                              | [[A02-protocol]]                                                                                                                                                                                                                                                |
| B01  | 新增 / 删除一个 Vue 或 React 组件                                                                                                  | [[B01-how-to-add-component]]                                                                                                                                                                                                                                                |
| B02  | 组件目录比较大(`index.{vue,tsx}` > 300 行),需要拆分子目录布局                                                                    | [[B02-large-component-layout]]                                                                                                                                                                                                                                                |
| A02  | 组件需要后端 API(dev 代理 / 生产 nginx 路由 / 跨设备 API)                                                                          | 在`apps/showcase/src/api/registry.ts` 的 `apiPaths` 加一行 + 加 entry,写 `apps/showcase/src/api/services/<id>/index.ts` + `types.ts`(继承 `HttpService`,`BASE = apiPaths.<id>`),组件用 `import ... from '@api'` 引用。详见 [[A02-protocol]] §4.4 |
| B03  | 组件应用层怎么读登录态 / 调后端 / 新增业务封装(组件 ↔ host 跨包引用)                                                              | [[B03-how-to-consume-api]]                                                                                                                                                                                                                                                |
| B04  | 新增「有状态 + AI 提示词导入」类组件(单 key KV blob 持久化 / TOML 导入 / 格式提示词 / 提示词开关)                                 | [[B04-stateful-ai-prompt-component]]                                                                                                                                                                                                                                                |
| A03  | 消费 / 新增「Vue 树与 React 树共用」的共享组件(shared/components / SharedMount / FileDropZone / 样式注入 / 相关分包与 vitest 约束) | 载入 skill`shared-component-system`(独立 skill,含 references:作者侧 / 消费侧 / 构建测试约束)。shared 层整体分层见 [[A03-shared-layer]]                                                                                                                            |
| A03  | `apps/showcase/src/shared` 层是什么 / 怎么用 / 跟 api 分层怎么划                                                                 | [[A03-shared-layer]]                                                                                                                                                                                                                                                |
| —   | 线上 405 / 404 / 502,但本地正常 —— API 路由在 prod 没生效                                                                        | 检查`vite build` 是否触发 gen-nginx 插件(生成 `nginx/api-locations/generated.conf`);检查 `default.conf` 是否 include `/etc/nginx/api-locations/*.conf`                                                                                  |
| C01  | 组件不显示 / "No loader registered" / ShadowRoot 没样式 / mount 抛错 / 路由 404 / ESLint 报错——按决策树排查                      | [[C01-component-decision-tree]]                                                                                                                                                                                                                                                |
| C02  | 加/删组件后 dev server 行为不对(manifest 没更新 / 浏览器没刷新)                                                                    | [[C02-dev-server-watcher]]                                                                                                                                                                                                                                                |
| A04  | 想了解 Manifest ↔ Loader 对账机制的实现细节(loader-inventory / reconcile / 错误信息)                                              | [[A04-manifest-loader-reconciliation]]                                                                                                                                                                                                                                                |
| C04  | lint 报错 / 自动修复 / 提交前清理                                                                                                  | [[C04-fix-lint-loop]]                                                                                                                                                                                                                                                |
| C03  | build 产物 Shadow DOM 样式丢失(常见冷门坑)                                                                                         | [[C03-shadow-dom-build-css-loss]]                                                                                                                                                                                                                                                |
| A06  | 组件首屏白屏感,首次会话看不到骨架过渡                                                                                              | [[A06-loading-skeleton-first-session]]                                                                                                                                                                                                                                                |
| A05  | 组件 mount 后首帧没样式(FOUC)/ 想懂 CSS 怎么同步落进 ShadowRoot                                                                    | [[A05-shadow-root-css-sync-mount]]                                                                                                                                                                                                                                                |
| D01  | 决定新约束用 ajv schema 还是 ESLint 规则                                                                                           | [[D01-when-eslint-vs-ajv]]                                                                                                                                                                                                                                                |
| D02  | 写自定义 ESLint 规则(AST / filename / 字面量提取样板)                                                                              | [[D02-eslint-pattern-recipes]]                                                                                                                                                                                                                                                |
| D03  | 写自定义规则的测试(RuleTester + ts parser)                                                                                         | [[D03-eslint-testing-pattern]]                                                                                                                                                                                                                                                |
| D04  | 给现有`valid-component-config` 加新 messageId                                                                                    | [[D04-eslint-extending-existing]]                                                                                                                                                                                                                                                |

## 仓库锚点

- Host: `apps/showcase/`
- 组件 loader 自动发现: `apps/showcase/src/registry/loaders.ts`
- 契约(类型 + JSON Schema): `packages/component-contract/`
- Manifest 扫描器 + Vite 插件: `packages/manifest-generator/`
- API 路径单一源: `apps/showcase/src/api/registry.ts`(`apiPaths` 字面量 + entry;`BackendId` 从 registry key 自动推导)
- API 统一收口: `apps/showcase/src/api/index.ts`(组件/宿主 `import ... from '@api'` 拿所有 service + 类型)
- 组件应用层跨包引用: 见 [[B03-how-to-consume-api]](三条 import 通道 + 别名配置 + 新增业务封装步骤)
- service 分层: `apps/showcase/src/api/services/<id>/`(HTTP wrapper: `index.ts` + `types.ts`,继承 `HttpService`)+ `apps/showcase/src/api/components/<id>/`(组件业务封装,如 `createShortcutStore`)
- 有状态+AI 提示词组件范式(单 key blob / TOML 导入 / FORMAT_PROMPT / prompt 开关,github-show / color-studio / shortcut-library 共性): 见 [[B04-stateful-ai-prompt-component]]
- 生产 nginx 路由生成: `vite build` 内联插件(closeBundle 调 `genNginxOut()` 写 `nginx/api-locations/generated.conf`)
- nginx 站点配置(手写部分): `default.conf`(生成的 location 由它 include)
- 运行时挂载适配器(ShadowRoot + 样式 adoption): `packages/mount-adapters/`
- 组件 CSS 同步注入(`MountContext.cssReady` + `ShadowRootHost.injectCss` + `adoptCssTexts` + `ensureCss`):同帧落 ShadowRoot,消除 FOUC;远程组件 `loaderUrl` 走 `adoptStylesInto` 兜底,机制详见 [[A05-shadow-root-css-sync-mount]]
- 跨框架共享组件白名单: `apps/showcase/src/shared/components/`(descriptor 契约 + SharedMount 壳。消费/扩展走 skill `shared-component-system`,别在该目录组件上依赖自动样式注入通道)
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
- 加组件 = 写 `component.config.ts` + `index.{vue,tsx}`(零配置,详见 [[B01-how-to-add-component]])
- 删组件 = 删整个目录(详见 [[C02-dev-server-watcher]])
- 卡片列表不 import 组件实现 —— CardGrid 只读 metadata,实现走 dynamic import 分 chunk
- 组件需要后端 = 在 `apps/showcase/src/api/registry.ts` 的 `apiPaths` 加一行 + 加 entry,写 `services/<id>/index.ts` + `types.ts`(继承 `HttpService`,`BASE = apiPaths.<id>`),组件 `import ... from '@api'`;业务封装放 `api/components/<id>/`。dev `apiGateway()` + prod nginx(build 内联生成)共用 registry 归一化,**不要**改 `vite.config.ts` / 手写 `default.conf`;更不要回退到 `component.config.ts` 的 `api` 字段(已废弃)
- 自定义 ESLint 规则先看 [[D01-when-eslint-vs-ajv]] 决定放 ajv 还是 ESLint

---

### 2026-09-25 key_board 操作教训

| 错误操作 | 实际后果 | 正确做法 |
|---------|---------|---------|
| A03 SOP Step 3 只提修正方括号链接(wikilink),但 ref 名还有另外两类触点:路径式引用(`references/xxx.md`,出现在 skill 外部 README)与 `__tests__` 硬编码文件清单 | 只改链接会漏掉外部路径引用与测试常量,后者直接挂 CI | 序列化重命名前额外 Grep `references/<旧名>` 路径形式 + 检查 skill 自带测试的文件名数组,三类触点一起改 |
| 改名前未对账 ref 数量 vs 路由表行数 | A05 shadow-root-css-sync-mount 是存量孤儿 ref(文件存在但路由表无行),改名时才暴露 | 重命名前先数:`ls references/` 条数 vs 路由表链接去重条数,不一致先补登记再改名 |
| 在主文档正文用双方括号字面量(如给 xxx 加双层方括号)指代"链接"这种写法 | `__tests__` 的 wikilink 存活测试把它当真实链接解析,断言 ref 文件存在而挂测试 | 正文要指代链接时写"方括号链接/wikilink"等纯文字,不写双层方括号字面量 |
