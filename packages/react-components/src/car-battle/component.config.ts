import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'car-battle',
  name: 'CarBattle',
  title: '双人碰碰车',
  description: '双人同屏竞技游戏 — WASD vs 方向键，在竞技场内互相撞击得分！',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '游戏娱乐',
  category: '双人竞技',
  tags: ['game', 'racing', 'multiplayer', 'canvas', 'car-battle', '2d'],
  platform: 'pc',
  status: 'stable',
  route: { path: '/components/car-battle', title: '双人碰碰车' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  capabilities: { fullscreen: true, fullscreenMode: 'viewport' },
} satisfies ComponentConfig;
