# ChinaMapColoring — 中国地图涂色

基于 Canvas 2D + GeoJSON 的省份涂色组件。点击省份用当前选中颜色上色，支持 hover 高亮、8 色调色板、高级调试（边界描边）与复位。

## 数据

复用 showcase 已有的 `/map/json/china.json`（ECharts `@@` 压缩编码，34 个省级 feature），组件内 `decode.ts` 解码后投影渲染。边界数据为演示用途，商用请按国家审图标准确认数据合规。

## 实现要点

- 画布逻辑 1200×900，CSS 等比缩放；渲染管线顺序见 `src/lib/render.ts`。
- **有意差异**：涂色层垫在省名之下（可读性更好），与原型（涂色盖住省名）不同。
- 命中检测 `ctx.isPointInPath` + 倒序遍历（岛屿/重叠优先高纬）。
- 触摸/鼠标统一走 Pointer Events；画布 `touch-action: none` 防滚动干扰。

## 测试

`packages/react-components/__tests__/china-map-coloring.test.ts`：解码/投影/短名/构建/命中/渲染顺序（纯函数，注入 Path2D 桩）。
