import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'gis',
  name: 'Gis',
  title: '旅行地图(GIS)',
  description: '基于 Vue 3 + OpenLayers 的旅行日记:地点标注、路线绘制、照片记录、轨迹回放。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '地图可视化',
  category: '旅行记录',
  tags: ['travel', 'ol', 'openlayers', 'map', 'gis'],
  platform: 'pc',
  status: 'experimental',
  route: { path: '/components/gis', title: '旅行地图(GIS)' },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: {
    resizable: true,
    fullscreen: true,
    fullscreenMode: 'viewport',
  },
  dependencies: [
    { name: 'ol', version: '^9.0.0', sharing: 'host' },
  ],
} satisfies ComponentConfig;