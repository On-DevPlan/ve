// bottom-nav-capsule-v3 —— 复刻 ui-2000-photoo/bottom_nav_capsule_v3.html 的 iOS 风格胶囊导航。
//
// 结构:
//   - 浅灰手机壳 (360 × ~120),底部水平居中放 300×58 的胶囊 nav
//   - 3 个 tab 图标:列表 / 方向盘 / 包裹
//   - 灰色 capsule (90×50) 在 active 图标后方滑动,active 图标变深色
//
// 注意事项:
//   - Tabler icons 字体走 CDN @import,在 ShadowRoot 内被 style-adoption 克隆
//   - 颜色为组件内硬编码(原 design 就是这套 iOS 配色),不消费 sl-token
//   - 复用 import.meta.glob 自动发现,无需声明 loaderUrl

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'bottom-nav-capsule-v3',
  name: 'BottomNavCapsuleV3',
  title: 'iOS 胶囊底部导航 v3',
  description:
    '3 tab iOS 风格胶囊导航:灰色胶囊在 active 图标后方平滑滑动,图标从灰转深。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '导航',
  category: '移动端',
  tags: ['nav', 'bottom', 'mobile', 'tab', 'capsule', 'ios', 'tabler'],
  status: 'stable',
  route: { path: '/components/bottom-nav-capsule-v3', title: 'iOS 胶囊底部导航 v3' },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: false, fullscreenMode: 'container' },
} satisfies ComponentConfig;