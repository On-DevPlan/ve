# ShadowRoot 同步 CSS 注入设计

- 日期:2026-08-06
- 主题:消除详情页组件"DOM 先到、CSS 后到"的 FOUC(Flash of Unstyled Content)
- 状态:已批准,待写实现计划
- 影响范围:`packages/mount-adapters`、`packages/component-contract`、`packages/manifest-generator`、`apps/showcase/src/registry`、`apps/showcase/src/pages/DetailPage.vue`

## 1. 背景与问题

详情页(`DetailPage.vue`)把每个组件挂载进一个 ShadowRoot,由 `VueMountAdapter` / `ReactMountAdapter` 调 `createApp().mount()` / `createRoot().render()` 渲染。组件 CSS 当前由 `mount-adapters/style-adoption.ts` 的 `adoptStylesInto(shadowRoot)` 处理:扫描 `document.head` 的 `<style>` 与 `<link rel="stylesheet">`,克隆进 ShadowRoot。

**问题**:组件首次渲染时,DOM 已出现但样式未应用,出现"只有 DOM"的空窗。

## 2. 根因分析

`adapter.mount()` 现有顺序为「先 `adoptStylesInto()` 同步快照 head,再 `render()`」。问题在两个层面:

1. **prod 下 `<link rel="stylesheet">` 异步**:Vite 把组件 CSS 提成独立 chunk,用 `<link>` 注入 head。`adoptStylesInto` 把该 `<link>` 克隆进 ShadowRoot,但 link 需重新异步下载/解析;而 `render()` / `app.mount()` 是同步开始的。DOM 先落地、样式一帧后才应用 → FOUC。

2. **dev 下 `<style>`** 虽然 import 求值前已进 head,但浏览器应用 style 仍可能滞后一帧,且 head 快照会把**所有组件 + 宿主**的样式一并克隆进 shadow(轻微污染)。

**本质**:CSS 是"事后异步补救",不是"render 前置条件"。

### 为什么 Vite 自带的 FOUC 保护没生效

Vite 文档原文:*"the async chunk is guaranteed to only be evaluated after the CSS is loaded to avoid FOUC"*。该保证只对 **light DOM** 成立——CSS 进了 `document.head`,但组件跑在 ShadowRoot 内,head 的样式**跨不进 shadow boundary**。所以本问题是 ShadowRoot 专属:CSS 已就绪,只是进错了文档位置。

### Vue scoped 的真实失效原因(论据修正)

scoped CSS 选择器 `.foo[data-v-xxx]` 依赖组件 DOM 上的 `data-v-xxx` 属性。组件 DOM 在 ShadowRoot 内(mount 到 `portalTarget`),`data-v-xxx` 属性**也在 shadow 内的 DOM 上**——并非在 light DOM。scoped 失效的真正原因是 CSS 文本在 `document.head` 而不在 ShadowRoot。把 scoped CSS 文本注入 ShadowRoot 后,`.foo[data-v-xxx]` 在 shadow 内**能正常匹配**。结论:scoped 在 shadow 内依然有效,无需放弃 scoped。

## 3. 设计目标

- render / app.mount 之前,CSS 必须已在 ShadowRoot 内应用,消除任何肉眼可见的空窗。
- dev / prod 行为同构,不出现"dev 正常、prod 闪烁"。
- 不破坏现有契约的向后兼容(`MountContext` 新字段可选)。
- 不破坏"加组件 = 写两个文件"的零配置理念(React/Vue CSS 自动收集)。
- 顺手修掉 `adoptStylesInto` 两个老毛病:时序竞态、克隆全量 head 的污染。

## 4. 方案选择(决策记录)

经评估三案,选定 **方案 A:CSS 文本前置注入**。

| 方案 | 取舍 | 结论 |
|---|---|---|
| **A. CSS 文本前置注入** | 构建期把组件 CSS 编译成同步文本字符串,render 前以 `<style>文本</style>` 注入 ShadowRoot。严格同步、零网络、dev/prod 同构 | ✅ 选定 |
| B. URL + `<link>` + await load | `?url` 拿 CSS URL,render 前 `await link.onload` | 仍夹一个 link 加载异步环节;产物体积更优但时序保证弱于 A |
| C. 手动 config 声明 stylesheets | `component.config.ts` 加 `stylesheets:string[]`,构建期内联 | 破坏零配置理念;Vue 多 SFC 子组件需逐个声明 |

**CSS 取取形态:A vs B**:A(文本)对"render 前就绪"是严格同步保证,B(URL+link)依赖 `await link.onload` 的异步事件。选定 **A(文本注入)**。

> 关于 `mod.__cssModules` / `mod.__viteCss`:经 Vite 文档核实,这是 **webpack vue-loader** 的概念,Vite **不**在动态 import 的模块对象上暴露关联 CSS——CSS 加载是 chunk 求值的副作用,不经过模块 exports。故不能从 `import()` 返回值读 CSS,必须用 `?inline`(文本)或 `?url`(URL)。

## 5. 架构

把"组件 CSS 文本"提升为 loader 的**并行同步产物**,在 render 之前同步注入 ShadowRoot。CSS 文本是构建期 eager glob / virtual module 的同步字符串,无网络、无 `<link>` 异步。

```
构建期:
  vite 插件 vue-style-collector(transform) → virtual:vue-styles (Record<id,string[]>)
  import.meta.glob('.../index.css?inline', eager) → React CSS 文本 map

运行时 DetailPage.mount(entry):
  ① Promise.all([ loader(entry)→module, collectCss(entry)→string[] ])   ← 并行,均同步就绪
  ② session = new MountSession(...)        // createShadowRootHost
  ③ session.host.injectCss(cssTexts)       // <style> 同步 append 进 ShadowRoot
  ④ adapter.mount(module, { ..., cssReady: session.host.ready })
  ⑤ adapter 内:await cssReady → createRoot().render() / app.mount()
                                              ↑ DOM 落地时 CSS 已同帧应用,无 FOUC
```

## 6. 改动点清单

| 文件 | 改动 |
|---|---|
| `component-contract/src/types.ts` | `MountContext` 增 `cssReady?: Promise<void>`(可选,向后兼容) |
| `mount-adapters/src/ShadowRootHost.ts` | 增 `injectCss(texts:string[]):void`(去重 append `<style>`,复用 djb2 指纹)+ `ready: Promise<void>`;废弃旧 `stylesheetUrls` 选项 |
| `mount-adapters/src/VueMountAdapter.ts` | `mount()` 开头 `if(ctx.cssReady) await ctx.cssReady`;`adoptStylesInto` 调用降级为无 `cssReady` 时的兜底 |
| `mount-adapters/src/ReactMountAdapter.ts` | 同上 |
| `apps/showcase/src/registry/css-collector.ts`(新) | `collectCss(entry):string[]`——React 走 glob `?inline`,Vue 走 `virtual:vue-styles`,远程组件(`loaderUrl`)返回 `[]` |
| `apps/showcase/src/registry/loaders.ts` | 无需改动。CSS 收集由独立的 `collectCss` 承载,`DetailPage` 直接调用,`LoadersMap` 签名不变(仍只管 module 的 `import()`) |
| `packages/manifest-generator/src/vue-style-collector.ts`(新 vite 插件) | transform 收集每个 `packages/vue-components/src/<id>/` 下所有 `.vue` 的 `<style scoped>` 编译文本 → 聚合为 `virtual:vue-styles` 模块 |
| `apps/showcase/vite.config.ts` | 注册 `vue-style-collector` 插件 |
| `apps/showcase/src/pages/DetailPage.vue` | `MountSession` 内 `loader()` 与 `collectCss()` 并行;`host.injectCss` 后把 `host.ready` 作为 `ctx.cssReady` 传入 adapter |
| `mount-adapters/src/style-adoption.ts` | 降级为**远程组件兜底**(adapter 在无 `cssReady` 时调用),本地组件不再走它 |

## 7. 数据流(详细)

### 构建期

**React CSS 文本**(`css-collector.ts` 内,静态 glob):
```ts
// eager + ?inline + import default → Record<path, cssText>
const reactCss = import.meta.glob(
  '../../../../packages/react-components/src/*/index.css?inline',
  { eager: true, import: 'default' },
) as Record<string, string>;
```
按路径提取组件 id(`src/<id>/index.css`)建模块级 `reactCssMap: Record<id, string>`。Vite 文档确认 `?inline` 返回处理后的 CSS 文本,`import.meta.glob` 支持 `query/import/eager`。

**Vue CSS 文本**(vite 插件 `vue-style-collector`):
- transform 阶段拦截/解析 `packages/vue-components/src/<id>/**/*.vue` 的 `<style>` 块,复用 `@vue/compiler-sfc` + postcss scope 处理(保证 `data-v-xxx` 与组件 DOM 对齐)。
- 按目录归类到组件 id,聚合为 virtual module `virtual:vue-styles`,default export `Record<id, string[]>`。
- `css-collector.ts` 内 `import vueStylesMap from 'virtual:vue-styles'`(eager,同步),作为模块级 `vueStylesMap`。

### 运行时 `collectCss(entry)`

```ts
export function collectCss(entry: ManifestEntry): string[] {
  if (entry.loaderUrl) return [];        // 远程组件,glob/virtual 收集不到
  if (entry.framework === 'react') return reactCssMap[entry.loaderKey] ? [reactCssMap[entry.loaderKey]] : [];
  if (entry.framework === 'vue')  return vueStylesMap[entry.loaderKey] ?? [];
  return [];
}
```
返回同步字符串数组(无 Promise、无 await、无网络)。

### 运行时 `DetailPage.mount`

在现有 `MountSession` 基础上:
1. `Promise.all([ loaders[entry.loaderKey](), Promise.resolve(collectCss(entry)) ])` → `{ mod, cssTexts }`。
2. `session = new MountSession(...)`(已含 `createShadowRootHost`)。
3. `session.host.injectCss(cssTexts)` —— 同步 append `<style>` 进 ShadowRoot。
4. 调 `adapter.mount(mod, { ..., cssReady: session.host.ready })`。
5. adapter `await cssReady` → render。

## 8. 时序保证

- `injectCss` 同步 `appendChild(<style>)`,文本是内存字符串,**零异步**。
- `host.ready` 对本地组件即 `Promise.resolve()`(保留 Promise 形态为未来动态/远程 CSS 留扩展口)。
- adapter `await cssReady`(一次 microtask)→ `render()`。同一渲染帧内:`<style>` 已在 shadow,DOM 紧随 render 产生,样式与 DOM 同帧应用。

## 9. 边界:远程组件(`loaderUrl`)

`loaderUrl`(CDN / 外部 npm 包)无法被 glob / virtual module 收集。`collectCss` 对它返回 `[]` 且 DetailPage **不传** `cssReady`。adapter 检测到 `ctx.cssReady` 缺失 → 回退调用 `adoptStylesInto(shadowRoot)`(扫 head,现状行为)。

即:远程组件保持现状,不享受新机制;本地组件全部走新机制。一个 adapter 兼容两种路径。

## 10. 错误处理

| 场景 | 行为 |
|---|---|
| 组件无 CSS(纯内联样式) | glob/virtual 查不到 → `collectCss` 返回 `[]` → `injectCss([])` no-op → `ready` 立即 resolve → 正常 render |
| Vue 插件 transform 失败 | 构建期 throw(构建闸门,阻断 dev/build) |
| 运行期 collectCss 异常 | 内部 try/catch → 降级返回 `[]` + `console.warn`,不阻断 render |
| 同组件重复 mount(keep-alive) | `injectCss` 用 djb2 指纹去重,幂等 |
| 远程组件 | 走 `adoptStylesInto` 兜底(现状) |

## 11. 测试策略

- **ShadowRootHost**:`injectCss(['a{}','b{}'])` 后 shadowRoot 含两个 `<style>`;同文本重复调用幂等(指纹去重);`ready` 为已 resolve 的 Promise。
- **css-collector**:React fixture 返回正确文本;Vue fixture 返回全部 style(含子组件多 block);远程组件(`loaderUrl` set)返回 `[]`;未知 id 返回 `[]`。
- **Vue/React adapter**:`await cssReady` resolve 之后才调用 `createRoot`/`createApp`(mock 断言调用时机);无 `cssReady` 时走 `adoptStylesInto` 兜底。
- **DetailPage 集成**:挂载后断言 shadowRoot 内 `<style>` 节点顺序先于组件 DOM 节点;切组件时旧 `<style>` 随 session.cleanup 销毁。
- **vue-style-collector 插件**:fixture SFC(含多 `<style>` + 子组件)→ virtual module 导出 `Record<id,string[]>` 含全部 style 文本;`data-v-xxx` 与组件 DOM 属性一致。

## 12. 风险与降级

**最高风险:`vue-style-collector` 插件的 scoped 编译一致性。**
transform 阶段需复刻 `@vitejs/plugin-vue` 的 scoped 编译(`data-v-xxx` 注入 + postcss scope),确保注入 ShadowRoot 的 scoped CSS 与组件 DOM 的 `data-v` 属性对齐。若复刻链路与 vue plugin 不一致,scoped 样式会失配。

**降级路径**:若复刻成本/一致性风险过高,降级为 glob `?vue&type=style&index=0&lang.css&inline`(单 style block,放弃多 block / 子组件 scoped)。降级下多 style block 的 Vue 组件样式不全——需在 plan 阶段实测后定夺。

## 13. 验收标准

1. 本地 Vue / React 组件详情页首次渲染无 FOUC(DOM 与 CSS 同帧出现)。
2. prod 构建产物下行为与 dev 一致(无"dev 正常、prod 闪烁")。
3. Vue scoped 组件样式在 ShadowRoot 内正确应用(`data-v-xxx` 匹配)。
4. 远程组件(`loaderUrl`)保持现状(adoptStylesInto 兜底),不回归。
5. 现有测试全绿;新增 ShadowRootHost / css-collector / adapter / 插件测试通过。
6. `pnpm lint` / `pnpm test` / `pnpm build` 全过。

## 14. 不在范围内

- 运行时动态插入的 CSS(组件运行中通过 JS 插 `<style>`):不在 `host.ready` 等待范围,由组件自身负责。
- CSS Modules / Tailwind 等非 SFC scoped 场景:本设计覆盖 SFC `<style>` 与显式 `import './x.css'`;其它形态按需后续扩展。
- 远程组件的 CSS 收集:明确降级为 adoptStylesInto 兜底。
