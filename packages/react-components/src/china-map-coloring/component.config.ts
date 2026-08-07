// component.config.ts —— china-map-coloring 组件元数据
// 遵循 packages/component-contract 的 ComponentConfig 规范;id 必须与目录名一致。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'china-map-coloring',
  name: 'ChinaMapColoring',
  title: '中国地图涂色',
  description: '点击省份为地图上色:8 色调色板、hover 高亮、高级调试,canvas 手绘 GeoJSON。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '地图',
  tags: ['canvas', 'map', 'china', 'coloring', 'geojson', 'interactive'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/china-map-coloring', title: '中国地图涂色' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
