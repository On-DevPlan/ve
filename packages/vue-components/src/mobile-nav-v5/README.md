# mobile-nav-v5

复刻 `ui-1000/mobile_nav_v5.html` 的 5 tab 圆点底部导航。

## 演示要点

- 黑色手机框 (360 × 520) 内嵌 page 区 + 70px 高的底部 nav 条
- 圆形指示器 (52px) 在 active tab 中心,**半圆形凹槽** 通过 `::before / ::after` 反向圆角与白色背景组合实现
- 切换 tab:图标上移到 indicator 内并变白,label 淡入;上方 page 区同步切到对应 icon + 配色
- 5 tab 配色:紫 / 粉 / 橙 / 绿 / 蓝,可通过 `TABS` 常量调整

## 复用

```ts
// 直接 import 即可使用
import MobileNavV5 from '@style-library/vue-components/mobile-nav-v5/index.vue';
```

## 约束

- Tabler Icons 使用 [`@tabler/icons-vue`](https://www.npmjs.com/package/@tabler/icons-vue) 的 SVG 组件(`IconHome` / `IconSearch` / `IconBell` / `IconHeart` / `IconUser`),零字体依赖、零外部请求
- 颜色硬编码,未消费 `sl-*` token —— 与原 design 保持一致;若需要主题适配,把 `TABS[i].color` 与 indicator 颜色改成 `var(--sl-color-*)`