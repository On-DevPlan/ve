---
domain: ve-showcase
tags: [loading-skeleton, first-session, vue, react, css-ready]
updated: 2026-08-07
---

# LoadingSkeleton(首次会话首屏骨架)

## 目的

首次进入 detail 路由时,组件 mount 前有几十~几百 ms 白屏(同步注入 CSS 后,React/Vue mount 异步)。骨架过渡保持体验连贯。**仅首次会话**(sessionStorage 标记),后续路由跳变不显。

## 文件

```
apps/showcase/src/shared/LoadingSkeleton/
├── skeleton.ts          # 框架无关核心:appear / fadeOut / destroy + 0.6s ease + 最小可见 500ms
├── host-vue.vue         # SFC + defineExpose handle
├── host-vue.ts          # re-export host-vue.vue(适配现有 import 风格)
├── host-react.tsx       # 函数组件 + useImperativeHandle handle
├── skeleton.css         # @keyframes sl-skel-spin + "加载中…" + 占位 bar
└── __tests__/           # 26 用例(核心 10 + vue 7 + react 7 + 2 个 min-visible)
```

## 触发

`DetailPage.vue` `mount(componentId)` 开头:

```ts
const SKELETON_VISITED_KEY = 'sl-skel:visited';
const isFirstVisit = !sessionStorage.getItem(SKELETON_VISITED_KEY);
sessionStorage.setItem(SKELETON_VISITED_KEY, '1');

const skel = isFirstVisit
  ? createLoadingSkeleton(session.host.portalTarget, { themeTokens: ... })
  : null;
if (skel) await skel.appear();
// ... loader + collectCss + injectCss + adapter.mount ...
if (skel) {
  void skel.fadeOut(() => skel.destroy());  // 不 await —— 与 mount 并行
}
```

sessionStorage **写在 try 之前** —— 即便 mount 之后抛错,visited flag 也生效,刷新不重复闪一次骨架。

## 接口

```ts
// skeleton.ts
export interface LoadingSkeletonHandle {
  readonly root: HTMLElement;
  appear(): Promise<void>;                           // opacity 0→1,0.6s ease,最少 500ms
  fadeOut(onFaded?: () => void): Promise<void>;    // 1→0,完成后回调
  destroy(): void;
}
export function createLoadingSkeleton(
  container: HTMLElement,
  opts?: { themeTokens?: Record<string, string>; className?: string }
): LoadingSkeletonHandle;
```

## 设计决策

- **0.6s ease + 最小可见 500ms**:用户原 0.3s 太快看不出,延长且加最小可见时长,避免"组件秒 ready 但骨架一闪就消"
- **CSS 旋转 spinner**(`@keyframes sl-skel-spin`,`0.9s linear infinite`,纯 transform 无依赖)
- **"加载中…" 文案** + 3 根占位 bar(`var(--sl-color-border)`)
- **themeTokens** 从 `document.documentElement` 读 `getComputedStyle(--sl-color-border)`,骨架元素在 ShadowRoot 内继承 `:host` 主题变量
- **`prefers-reduced-motion`** 未处理 — 浏览器会把 transition 时长压到 0,体感瞬时跳变,后续 a11y 要求严格时再 `@media (prefers-reduced-motion: reduce) { transition: none }`

## Vue 适配关键点

- `host-vue.vue`:SFC,`<template>` 含 `.sl-skel__spinner` + `.sl-skel__text` + `.sl-skel__bars`(含 `.sl-skel__bar--title` + 2 bar)
- `defineExpose` 暴露 appear / fadeOut / destroy,调用 `ref.value?.offsetHeight` 强制 reflow,避免连续 appear/fadeOut 跳变不触发 transition
- `setTimeout(onEnd, 650)` 兜底:transitionend 不触发时(浏览器降级/disabled)强制 resolve
- `host-vue.ts` 仅 `export { default } from './host-vue.vue'`(SFC 必须 .vue,re-export 适配 .ts import 风格)

## React 适配关键点

- `host-react.tsx`:`forwardRef<LoadingSkeletonRef, Props>`,`useImperativeHandle` 暴露
- `useState<number>(0)` 控制 opacity,`useRef` 闭包捕获 root
- `import * as React from 'react'` — `tsconfig.json` 是 `jsx: preserve`,classic JSX 需要 `React.createElement` 在作用域
- `destroyedRef = useRef(false)` 而非 `let destroyed` —— 跨 re-render 不丢状态
- 卸载时 React 自动 unmount root,无需手动 destroy

## 测试

`apps/showcase/__tests__/LoadingSkeleton/`:
- `skeleton.test.ts`:10 用例 — root shape / appear 1 / fadeOut + onFaded / destroy 幂等 / reflow 不叠加 / transitionend 重复触发不重复 resolve / themeTokens / className 选项
- `host-vue.test.ts`:7 用例 — `@vue/test-utils` mount + 验证暴露 handle 行为
- `host-react.test.ts`:7 用例 — `act()` + `createRoot` 验证 forwardRef handle
- 2 个 min-visible 用例:400ms 后 settled=false,500ms 后 settled=true

## 范围外

- 路由级骨架(HomePage 初次) — 未做
- 跨页面持久化(localStorage)— 用户明确 sessionStorage
- 每组件定制骨架 — 当前通用
- SSR/SSG 兼容 — 本项目为 SPA