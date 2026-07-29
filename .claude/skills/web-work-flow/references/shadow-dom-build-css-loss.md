---
domain: wb-showcase
tags: [build, shadow-dom, css, vite, mount-adapters]
updated: 2026-07-26
---
# Build 产物 Shadow DOM 样式丢失

## 问题

`adoptStylesInto` (mount-adapters) 在 build 模式下不克隆 `<link rel="stylesheet">` 进 Shadow DOM，导致生产环境组件没有样式。

## 原因

Vite dev 模式把组件 CSS 内联为 `<style>` 标签，build 模式把 CSS 拆成外部 `.css` 文件，通过 `<link rel="stylesheet">` 加载。

`adoptStylesInto` 只扫描了 `document.head.querySelectorAll('style')`，build 产物直接跳过不处理，ShadowRoot 得不到样式。

## 修复

在 `packages/mount-adapters/src/style-adoption.ts` 增加对 `<link>` 的处理：

```typescript
const linkEls = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
for (const link of linkEls) {
  const href = link.getAttribute('href') ?? '';
  if (!href) continue;
  const fp = styleFingerprint(href);
  if (seen.has(fp)) continue;
  seen.add(fp);
  if (shadowRoot.querySelector(`link[data-sl-clone="${fp}"]`)) continue;
  const cloned = document.createElement('link');
  cloned.setAttribute('rel', 'stylesheet');
  cloned.setAttribute('href', href);
  cloned.setAttribute('data-sl-clone', fp);
  shadowRoot.appendChild(cloned);
}
```

## 关键认知

| 环境 | Vite CSS 加载方式 | 适配器需要 |
|------|------------------|------------|
| dev (`vite`) | `<style>` 内联 | `adoptStylesInto` 扫 style 标签 |
| build (`vite build`) | `<link rel="stylesheet">` 外置 | `adoptStylesInto` 扫 link 标签 |
| 组件 scoped CSS | `[data-v-xxx]` 选择器 | Shadow DOM 自身继承无需额外处理 |
| 外部 CSS (如 tabler-icons) | `@import` 在组件 CSS 内 | `adoptStylesInto` 扫 link 标签即可 |

## Docker 构建注意事项

回顾了 COPY 顺序问题 —— 当 `.dockerignore` 只忽略根 `node_modules` 不忽略嵌套 `apps/showcase/node_modules` 时，主机上的空符号链接目录会覆盖容器中 `pnpm install` 装好的 `node_modules`。

## 下次排查方向

build 产物样式异常时优先检查：
1. index.html 中 `<link rel="stylesheet">` 是否存在且路径正确
2. 组件 JS chunk 中的 CSS 引用是否链对
3. `component-manifest.json` 中 `assets.cssChunks` 是否正确
4. `adoptStylesInto` 是否覆盖了 link 模式
