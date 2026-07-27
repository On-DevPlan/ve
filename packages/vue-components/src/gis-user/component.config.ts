// gis-user —— 用户侧旅行日记地图组件(简化版)。
// 复刻自 ve 仓库 src/components/huang/gis_usr,只保留用户视图行为。
// 视觉主题为蓝色 (#4da4ff)。本组件通过 host 共享 `ol` 依赖。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'gis-user',
  name: 'GisTravelDiaryUser',
  title: '演唱会巡演路线(用户端)',
  description:
    '基于 OpenLayers 的演唱会巡演路线地图,展示路线、演出站点、播放巡演动画与查看站点详情。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '数据可视化',
  category: '地图',
  tags: ['ol', 'openlayers', 'map', 'travel', 'concert', '用户', '巡演'],
  platform: 'pc',
  status: 'stable',
  route: { path: '/components/gis-user', title: '演唱会巡演路线(用户端)' },
  mount: { kind: 'vue', propsMode: 'default' },
  // 蓝色主题面板,需要 :deep() 注入 ol 控件样式 —— 选 css-module 允许穿透
  isolation: { mode: 'css-module' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'viewport' },
  dependencies: [{ name: 'ol', version: '^9.0.0', sharing: 'host' }],
} satisfies ComponentConfig;
