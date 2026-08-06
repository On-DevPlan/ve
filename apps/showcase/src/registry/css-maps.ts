// registry/css-maps.ts —— 构建期懒加载 CSS map(dev/prod 同构)。
//   - React:不带 eager 的 glob → 每个 CSS 独立 chunk,按需拉取(评审 #6)
//   - Vue:import virtual:vue-styles,后者导出懒加载 loader map
//
// 不带 eager 的意义:卡片层和单组件详情页都不会被其他组件的 CSS 拖累。
// loader 内部是字面量 import(),vite 静态分析可分包。

import vueStylesMap from 'virtual:vue-styles';
import type { CssMaps } from './css-collector';

// 不带 eager → 每个 CSS 独立 chunk,按需拉取(评审 #6)。
const reactCssLoaders = import.meta.glob(
  '../../../../packages/react-components/src/*/index.css',
  { query: '?inline', import: 'default' },
) as Record<string, () => Promise<string>>;

const react: Record<string, () => Promise<string[]>> = {};
for (const [path, loader] of Object.entries(reactCssLoaders)) {
  const id = path.match(/\/src\/([^/]+)\/index\.css/)?.[1];
  if (id) react[id] = () => loader().then((css) => [css]);
}

export const cssMaps: CssMaps = { react, vue: vueStylesMap };

export { collectCss } from './css-collector';
