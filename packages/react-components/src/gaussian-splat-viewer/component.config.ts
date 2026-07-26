import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'gaussian-splat-viewer',
  name: 'GaussianSplatViewer',
  title: '3D 高斯泼溅查看器',
  description:
    '基于 three.js + @mkkellogg/gaussian-splats-3d 的滚动驱动电影感 3D 场景查看器,源自 sharp-3d-viewer。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '3D 场景',
  tags: ['three', 'gaussian-splat', '3dgs', 'cinematic', 'scroll-driven', 'fullscreen'],
  status: 'stable',
  route: { path: '/components/gaussian-splat-viewer', title: '3D 高斯泼溅查看器' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: {
    mode: 'global',
    globalStyleReason:
      'Canvas is mounted into a full-viewport fixed-position host div (.sl-gsv-canvas-host) inside the host ShadowRoot portal; the component captures window-level wheel/touch events and overrides the body cursor / overflow for the cinematic scroll-driven experience.',
  },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'viewport' },
  dependencies: [
    { name: 'three', version: '^0.170.0', sharing: 'component' },
    { name: '@mkkellogg/gaussian-splats-3d', version: '^0.4.7', sharing: 'component' },
  ],
} satisfies ComponentConfig;
