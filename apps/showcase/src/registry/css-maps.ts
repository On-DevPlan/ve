// registry/css-maps.ts —— 构建期真实 CSS 文本 map(dev/prod 同构)。
//   - React:`?inline` eager glob,同步返回 CSS 文本(Vite 文档确认)
//   - Vue:import virtual:vue-styles(由 vue-style-collector 插件提供,Task 3)
//
// 为什么顶层 import.meta.glob 能同步:?inline 把 CSS 文本变成 JS 字符串,
// eager:true 在构建时内联进 chunk,运行时零异步、零网络。

import vueStylesMap from 'virtual:vue-styles';
import type { CssMaps } from './css-collector';

const reactCss = import.meta.glob(
  '../../../../packages/react-components/src/*/index.css?inline',
  { eager: true, import: 'default' },
) as Record<string, string>;

const react: Record<string, string> = {};
for (const [path, text] of Object.entries(reactCss)) {
  const id = path.match(/\/src\/([^/]+)\/index\.css/)?.[1];
  if (id) react[id] = text;
}

export const cssMaps: CssMaps = { react, vue: vueStylesMap };

export { collectCss } from './css-collector';
