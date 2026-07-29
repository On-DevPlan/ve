// mobile-nav-v5 —— 复刻 ui-1000/mobile_nav_v5.html 的底部圆点导航。
//
// 结构:
//   - 360×520 的"手机框",内部分为 page 区(展示当前页)和 nav 区(70px)
//   - 5 个 tab:首页 / 搜索 / 通知 / 收藏 / 我的
//   - 圆形 indicator(52px)在 active tab 中心,背景色 = tab 配色
//   - active 时:图标上移到 indicator 中心变白;label 淡入
//
// 注意事项:
//   - Tabler icons 字体走 CDN @import,在 ShadowRoot 内被 style-adoption 克隆
//   - 颜色为组件内硬编码(原 design 就是这套配色),不消费 sl-token
//   - 复用 import.meta.glob 自动发现,无需声明 loaderUrl

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'mobile-nav-v5',
  name: 'MobileNavV5',
  title: '移动端圆点导航 v5',
  description:
    '5 tab 底部导航,圆形指示器随 active 项平滑移动并提升图标,标签在下方淡入;支持键盘与触屏。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '导航',
  category: '移动端',
  tags: ['nav', 'bottom', 'mobile', 'tab', 'indicator', 'tabler'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/mobile-nav-v5', title: '移动端圆点导航 v5' },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: false, fullscreenMode: 'container' },
} satisfies ComponentConfig;