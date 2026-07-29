# pretext-text-layout

基于 [`@chenglou/pretext`](https://github.com/chenglou/pretext) 的多语言文本测量与流式排版实验室。纯 JavaScript/TypeScript 文本引擎,不碰 `getBoundingClientRect` / `offsetHeight` 这类会触发**布局重排**的 DOM 测量 API,用浏览器自身字体引擎在 JS 层完成断行与高度计算。

## 两个面板

### 1. 文字绕流(FlowPanel)

文字围绕一个**可拖拽图形**实时流动,逐行宽度可变。核心技术是 pretext 的游标式排版:

```ts
const prepared = prepareWithSegments(text, font);
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
let y = 0;
while (true) {
  const width = y < shape.bottom ? columnWidth - shape.width : columnWidth; // 每行宽度可不同
  const range = layoutNextLineRange(prepared, cursor, width); // ← 关键:逐行排版
  if (range === null) break;
  const line = materializeLineRange(prepared, range);
  cursor = range.end;
  y += lineHeight;
}
```

- 拖动图形(支持上 / 下 / 左 / 右)→ 自动判定浮动侧 → 文字逐行避让重排
- 图形宽 / 高可调;`文字绕流`是 CSS `shape-outside` 难以做到的"动态、任意、逐行宽度"效果

### 2. 无 DOM 测量(MeasurePanel)

实时展示 pretext **不触发重排**的文本高度测量,并与浏览器真实渲染对照:

- 实时指标:高度、行数(纯算术,无 DOM 重排)
- 精度对照:pretext 预测高度 vs 浏览器实际渲染高度,虚线标尺可视化对齐
- 性能基准:同样测量 1000 次,pretext `layout()` vs DOM `appendChild + offsetHeight`(后者每次触发真实重排)

### 多语言

样例刻意混排 CJK / 阿拉伯语 RTL / Emoji,展示 pretext 对 Unicode 双向文本与无空格断行的支持。

## 字体策略

`@chenglou/pretext` 官方警告 `system-ui` 在 macOS 下测量不准,故优先加载 `Inter`(Google Fonts,1.5s 超时);离线 / CDN 不可达时回退 `system-ui`,功能仍可用。canvas `font` 字符串与 CSS `font-family` 始终对齐,保证测量与渲染一致。

## 文件结构

```
pretext-text-layout/
├── index.vue              # 壳:头部 + 标签切换,组合两个面板
├── component.config.ts
├── README.md
└── src/
    ├── FlowPanel.vue      # 文字绕流(use case 2)
    ├── MeasurePanel.vue   # 无 DOM 测量 + 基准(use case 1)
    ├── usePretext.ts      # 字体加载门禁 + canvas-font 构造
    ├── samples.ts         # 多语言样例文本
    └── types.ts           # 共享类型
```

## 依赖

- `@chenglou/pretext@^0.0.8`(`sharing: 'component'`,随本组件 chunk 打包)
