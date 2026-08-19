# bottom-nav-capsule-v3

复刻 `ui-2000-photoo/bottom_nav_capsule_v3.html` 的 iOS 风格胶囊底部导航。

## 演示要点

- 浅灰手机壳 (360px 宽) 内底部水平居中放置 300×58 的胶囊 nav
- 灰色 capsule (90×50) 在 active tab 后方弹性滑动 (`cubic-bezier(0.34, 1.5, 0.64, 1)`)
- 切换 tab:active 图标从 `#8e8e93` 转为 `#1c1c1e`
- 3 tab 图标:列表 / 方向盘 / 包裹,可调整 `TABS`

## 复用

```ts
import BottomNavCapsuleV3 from '@style-library/vue-components/bottom-nav-capsule-v3/index.vue';
```

## 约束

- Tabler Icons 使用 [`@tabler/icons-vue`](https://www.npmjs.com/package/@tabler/icons-vue) 的 SVG 组件(`IconLayoutList` / `IconSteeringWheel` / `IconPackage`),零字体依赖、零外部请求
- 颜色硬编码为 iOS 浅灰系;若需主题适配,把 `.sl-bnc-capsule` 背景与 `.sl-bnc-item i` 颜色改为 `var(--sl-*)`