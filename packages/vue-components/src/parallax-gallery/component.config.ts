// parallax-gallery 组件的 config。
//
// 模仿 ghost-huang-monorepo 的 ConcertItemSection + ParallaxCard:
//   - 瀑布流布局:items >= 5 走 CSS column-count;< 5 走 flex grid
//   - Safari 上 column-count 渲染不稳,改用「找最短列」手动绝对定位瀑布流
//   - 视差卡片:背景层比卡片高,滚动时按进度 translateY,产生前后速度差
//   - 错落入场:IntersectionObserver + 每项 transition-delay,等价 v-motion 的
//     :delay="Math.min(index * 70, 420)"
//
// 注:卡片视觉是图片本身(渐变 + 暗角),不消费 sl-token,因此 theme.requiredTokens 留空,
// 与 china-map 的处理一致。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'parallax-gallery',
  name: 'ParallaxGallery',
  title: '瀑布流视差画廊',
  description:
    '瀑布流(masonry)布局 + 滚动视差卡片:≥5 项走 column-count,Safari 退回手动「找最短列」算法;每张卡片背景随滚动平移,前景不动,形成速度差。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '视觉动效',
  category: '瀑布流布局',
  tags: ['masonry', 'waterfall', 'parallax', 'scroll', 'layout', 'gallery'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/parallax-gallery', title: '瀑布流视差画廊', keepAlive: false },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
