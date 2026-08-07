---
domain: ve-showcase
tags: [css, shadow-dom, css-ready, vue, react, mount-adapters]
updated: 2026-08-07
---

# 组件 CSS 同步注入(消除 FOUC)

## 问题

详情页组件 mount 到 ShadowRoot,但 CSS 默认在 `document.head` 跨不进 shadow boundary,导致**首帧只有 DOM 没有样式**(FOUC)。v1 阶段 `adoptStylesInto` 同步快照 head 克隆进 shadow;prod 下 `<link>` 异步加载产生时序竞态。

## 架构(v2, feat/shadow-css-sync)

```
DetailPage.mount(entry)
  ├─ Promise.all([loader(), collectCss(entry)])       ← CSS 文本也是并行产物(同步字符串)
  ├─ session.host.injectCss(cssTexts)                  ← 同步 append <style> 进 ShadowRoot
  ├─ adapter.mount({ ..., cssReady: host.cssReady })    ← adapter 等 cssReady 微 task
  └─ await cssReady → render()                         ← DOM 与 CSS 同帧落地
```

**核心不变量**:`cssTexts` 是构建期同步字符串(`?inline` 产物或 Vite CSS 管线输出),`injectCss` 同步,`cssReady` 立即 resolve → render 与 DOM 仍在同一帧。

## 关键文件

| 文件 | 职责 |
|---|---|
| `packages/component-contract/src/types.ts` | `MountContext.cssReady?: Promise<void>` |
| `packages/mount-adapters/src/style-adoption.ts` | `adoptCssTexts(root, cssTexts)` + `adoptStylesInto(root)`(远程兜底)|
| `packages/mount-adapters/src/ShadowRootHost.ts` | `injectCss(texts)` + `cssReady` + `failCss(err)` |
| `packages/mount-adapters/src/ensure-css.ts` | `ensureCss(ctx)` 公共前置,await cssReady,失败降级 |
| `apps/showcase/src/registry/css-maps.ts` | React glob `?inline` 懒加载;Vue `virtual:vue-styles` |
| `apps/showcase/src/registry/css-collector.ts` | `async collectCss(entry, maps): Promise<string[]>` |
| `apps/showcase/src/registry/vue-style-collector.ts` | Vite 插件:扫 SFC `<style>` + `<script>` 内 `import '*.css'`,生成懒加载 loader |
| `apps/showcase/plugins/scoped-id.ts` | `computeScopedId` 复刻 plugin-vue 算法 |
| `apps/showcase/plugins/scoped-id-guard.ts` | build 期 transform 拦截 `__scopeId` 漂移 |
| `apps/showcase/src/pages/DetailPage.vue` | 接线:`Promise.all.all` + `injectCss` + `cssReady` 传入;`loaderUrl` 走 undefined |

## Vue scoped CSS 接入 Vite CSS 管线

`vue-style-collector` 不自写 scoped 编译,而是**产伪 `.css` 路径**让 Vite CSS 接管:

```
/abs/packages/vue-components/src/china-map/__vscoped__index.0.css?inline
                                       ↑ 同目录,扩展名 .css → → isCSSRequest 命中
```

`load()` 返回 `compileStyle` 编译后的 raw scoped CSS(含 `data-v-xxx`),`?inline` 让 vite CSS 插件包成 `export default "..."`。**postcss / url() / @import / preprocessor 全部由 Vite 处理**。

scopedId 算法(`computeScopedId`):
```ts
sha256(normalizePath(path.relative(root, filename)) + (isProduction ? source : ''))
  .hex.substring(0, 8)
```
必须与 `@vitejs/plugin-vue@5.2.4` 的 `descriptor.id` **字节级一致**。`scoped-id-guard` 在 build 期 transform 比对 `__scopeId`,不等 `this.error()`。**pin `@vitejs/plugin-vue` 精确版本**,不锁 `^`。

## 远程组件兜底(`loaderUrl`)

`collectCss` 对 `entry.loaderUrl` 返回 `[]`,DetailPage **不传** `cssReady`;adapter 走 `ensureCss` 的 else 分支 → `adoptStylesInto(ctx.shadowRoot)`(等 head link load → 收集 `document.styleSheets` cssRules → `adoptCssTexts`)。

⚠️ **KNOWN-LIMITATIONS**(远程路径,仓库 0 触发,推后):
- **P0 白屏**:link 在调用前已 error(如 404),`l.sheet===null` 但 load/error 已 fired → Promise 永不 settle → adapter.mount 永挂 → 白屏。修:Promise 加超时 race(如 5s 强制 resolve)。
- **P1 破隔离**:收集所有 `document.styleSheets`(含 host + 其它组件)→ dump 进 shadow → 选择器可能被 host CSS 意外匹配。修:限定可识别组件 CSS 白名单。
- **P2 静默缺样式**:link.sheet 已存在但 cssRules 解析中 → `Promise.resolve()` 早返 → 读空 cssRules → 注入空文本。修:load 后加 microtask 或验证 `cssRules.length`。

引入首个 `loaderUrl` 组件前必须修复。

## 第三方 CSS(`import 'ol/ol.css'` 等)

`vue-style-collector` 用 babelParse 扫 SFC `<script>`/`<script setup>` 内 `import '*.css'` 字面量,加入 cssMap 懒加载 loader(裸 npm CSS):
- 第三方 CSS **排在 SFC `<style>` 之前**(ol.css 定义 `:root` 变量,scoped CSS 可能引用)
- `resolveId` 用 `this.resolve(id, 真实 SFC, {skipSelf: true})` 把 npm CSS 从 vue-components 包而非 apps/showcase 解析

## `@import` 边界

`CSSStyleSheet.replaceSync()` **不允许 `@import`**(W3C 构造规则限制)。`adoptCssTexts` 检测 raw CSS 含 `@import`,**整体降级到 `<style data-sl-css>` clone 路径**(浏览器允许 `<style>` 内 `@import`)。损失:跨 shadowRoot sheetCache 共享,但仓库当前 0 个多 `@import` 组件,实际影响 0。

## LoadingSkeleton(首次会话首屏)

`apps/showcase/src/shared/LoadingSkeleton/`:
- `skeleton.ts` 框架无关核心:appear / fadeOut / destroy + 0.6s ease + 最小可见 500ms
- `host-vue.vue` / `host-react.tsx` 各适配 + `defineExpose` / `forwardRef` 暴露 handle
- `skeleton.css` 旋转 spinner(`@keyframes sl-skel-spin`) + "加载中…" + 占位 bar

sessionStorage key `sl-skel:visited`,**仅首次会话显**,后续路由跳变不显。

## 新增组件需要的 CSS

Vue 组件直接写 `<style scoped>`,Vite plugin 自动收集。**不要**写 `@import` 进 SFC(会被 vue plugin 处理,可能与 `<style>` 混冲突)。**不要**手动写 `import 'pkg/css'` 进 `.css`(`?inline` glob 不会自动覆盖 Vite chunk 策略)。

第三方 CSS 依赖(`import 'pkg/x.css'`)写在 SFC `<script>` 顶层 —— `vue-style-collector` 自动加入 cssMap。

## 修复决策树

| 症状 | 看 |
|---|---|
| dev 打开详情页,首帧裸渲染 | DevTools Elements → ShadowRoot → 是否有 `<style data-sl-css>`;Network → 是否有组件 CSS chunk 请求 |
| prod build 后样式丢失 | `dist/assets/vc-<id>-*.css` 是否存在;build 日志是否有 `cssCodeSplit` 警告 |
| Vue scoped 选择器不命中 | DevTools ShadowRoot → 组件 DOM 是否有 `data-v-xxx` 属性;`__scopeId` 与 CSS `[data-v-xxx]` 是否一致;build 是否有 `scoped-id-guard` error |
| 第三方 CSS(ol/echarts)裸渲染 | 该组件 dist CSS chunk 是否含第三方规则;`vue-style-collector` 是否扫到对应 import |
| dev 启动控制台 `@import rules are not allowed` | 该组件 CSS 含 `@import` → 已自动降级 `<style>` clone,**应不再报错**;若仍报,检查 `adoptCssTexts` 是否有 `@import` 检测 |
| 远程组件(`loaderUrl`)白屏 | 当前 0 个,若加后出现 → KNOWN-LIMITATION #0 触发,需引入前先修 |

## 不做(避免越界)

- **不要**改 `component.config.ts` 的 `api` 字段(已废弃,走 registry.ts)
- **不要**改 vite.config.ts 改 CSS 管线(已通过 vue-style-collector 伪 .css 路径接管)
- **不要**修改 plugin-vue 源码对齐 scopedId(算法已复刻;guard 兜底)
- **不要**为远程组件 path 加新端点(后端 KV 端点已用 default 解析)