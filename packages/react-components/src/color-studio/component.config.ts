// packages/react-components/src/color-studio/component.config.ts
// 走 how-to-add-component §2 模板。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'color-studio',
  name: 'ColorStudio',
  title: '色彩管理工作台',
  description: 'HSB 圆盘 + 取色 + 调色板 + 和声派生 + JSON 整体读写。',
  version: '0.1.0',
  framework: 'react',
  entry: './index.tsx',
  platform: 'both',
  group: '设计',
  category: '色彩管理',
  tags: ['color', 'picker', 'palette', 'harmony'],
  status: 'experimental',
  route: { path: '/components/color-studio', title: '色彩管理工作台' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { fullscreen: true, fullscreenMode: 'viewport', resizable: false },
} satisfies ComponentConfig;
