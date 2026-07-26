// china-map 组件的 config(对应 spec §4.1 ComponentConfig)。
//
// 注释约定:
//   - id / name 与 SFC 文件名保持一致,方便 manifest 扫描器按 id 索引
//   - route.path 须以 /components/ 开头 —— 见 eslint rules/no-card-loader.js
//   - mount.kind = 'vue' 决定 showcase 详情页用 VueMountAdapter 挂载
//   - isolation.mode = 'shadow-dom' 与 mount-adapters/ShadowRootHost 对齐
//   - 主题:本组件是数据可视化,使用硬编码暗色 (#0E2152 背景) 不消费 sl-token,
//     因此 theme.requiredTokens 留空。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'china-map',
  name: 'ChinaMap',
  title: '中国地图可视化',
  description:
    '基于 ECharts 的交互式中国地图,支持散点标记、飞线动画、省份高亮与热力图模式。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '数据可视化',
  category: '地图',
  tags: ['echarts', 'map', 'china', 'visualization', 'interactive'],
  status: 'stable',
  route: { path: '/components/china-map', title: '中国地图', keepAlive: false },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'container' },
  dependencies: [{ name: 'echarts', version: '^5.5.0', sharing: 'host' }],
} satisfies ComponentConfig;