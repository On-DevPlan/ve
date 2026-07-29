// pretext-text-layout 组件的 config(对应 spec §4.1 ComponentConfig)。
//
// 约定对齐:
//   - id === 目录名(import.meta.glob 按目录名扫,ESLint 强制一致)
//   - route.path === /components/<id>(ESLint 强制一致)
//   - framework === 'vue'(所在包为 vue-components)
//   - mount.kind = 'vue' → showcase 详情页用 VueMountAdapter 挂载
//   - isolation.mode = 'shadow-dom' → ShadowRootHost 隔离样式
//   - dependencies.sharing = 'component' → @chenglou/pretext 随本组件 chunk 打包
//     (Host 不直接消费该库,故不与 Host 共享)

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'pretext-text-layout',
  name: 'PretextTextLayout',
  title: 'Pretext 文本布局实验室',
  description:
    '基于 @chenglou/pretext 的多语言文本测量与流式排版:无 DOM 重排实时测量高度、文字绕可拖拽图形流动,演示纯 JS 文本引擎比传统 DOM 测量快数百倍。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '文本与排版',
  category: '文本布局',
  tags: ['pretext', 'text-layout', 'typography', 'measurement', 'text-flow', 'i18n'],
  platform: 'pc',
  status: 'stable',
  route: { path: '/components/pretext-text-layout', title: 'Pretext 文本布局' },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'container' },
  dependencies: [{ name: '@chenglou/pretext', version: '^0.0.8', sharing: 'component' }],
} satisfies ComponentConfig;
