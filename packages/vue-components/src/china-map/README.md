# ChinaMap

基于 ECharts 的交互式中国地图组件。三种显示模式 + 省份钻取。

## 功能

- **散点模式(scatter)**:全国主要城市涟漪散点,按 level 分级显示。
- **飞线模式(lines)**:城市间的航线动画(箭头沿曲线流动)。
- **热力模式(heatmap)**:按省份人口上色,左下角 visualMap 图例。
- **省份钻取**:点击省份 → 加载该省 GeoJSON → 显示省内城市。
- **响应窗口大小变化**:`window.resize` 触发 `chart.resize()`。

## 静态资源

依赖以下 GeoJSON 文件,放在 `apps/showcase/public/map/json/` 下:

```
china.json
province/
├── anhui.json
├── beijing.json
├── chongqing.json
├── ... (34 个省级行政区)
```

合计约 2.1 MB。组件 fetch 路径:

- `/map/json/china.json`
- `/map/json/province/<id>.json`

`id` 由 `data.ts` 中的 `provinceIdMap` 提供(中文省名 → 拼音文件名)。

## 依赖

| 包 | 版本 | 说明 |
|----|------|------|
| `echarts` | `^5.5.0` | 已在 `@style-library/vue-components` 的 `dependencies` 中声明 |

## 已知限制

- 原版用 `position: fixed` 让地图覆盖整个视口。本组件在 ShadowRoot 内挂载,
  fixed 会跳脱 ShadowRoot 遮住页面 chrome,因此改为 `position: relative;
  width: 100%; height: 100%; min-height: 600px;`,跟随宿主容器尺寸。
- 主题:组件使用固定暗色 (`#0E2152` 背景 + `#4ECDC4` 高亮),不消费
  `--sl-color-*` token —— 这是数据可视化组件的常见做法,避免 token 覆盖
  导致配色失真。

## 主题契约

| 字段 | 值 |
|------|----|
| `theme.mode` | `css-variables` |
| `theme.namespace` | `sl` |
| `theme.requiredTokens` | (无) |

## 路由

`/components/china-map` —— 详情页由 showcase 的 `DetailPage.vue` 渲染。