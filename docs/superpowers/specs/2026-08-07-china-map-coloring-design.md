# 中国地图涂色工具 — 设计规格

## 概述

在组件展示系统中新增一个 React + Canvas 2D 的「中国地图涂色」组件：点击省份用当前选中颜色上色。复刻线上对标站 `https://app-8c305puxroxt.appmiaoda.com/`（百度秒哒生成）的完整效果——功能、视觉、交互三对齐。

对标站逆向结论（已实测）在 `china-map-coloring-tech-spec.md`（仓库外，版本 v1.0）。本设计将其落地为 ve 的 React 组件，并记录所有因 ve 约定导致的必要适配。

## 技术栈

- **框架**: React 19 (遵循 `@style-library/react-components` 规范；对标站为 React 18，两者对本组件无差异)
- **渲染**: Canvas 2D API + `Path2D` + `isPointInPath`（纯浏览器 API，无 ECharts/D3/Leaflet/mapbox）
- **数据**: 复用 ve 已有 `/map/json/china.json`（ECharts 压缩编码，34 省级 feature，约 61KB）
- **构建**: Vite（复用 monorepo 现有配置），组件由 `import.meta.glob` 自动发现
- **样式**: 手写 CSS（ve 无 Tailwind），`sl-cmc-*` 前缀 + `var(--sl-*, fallback)` token
- **图标**: inline SVG / 文本（无 lucide-react 依赖）
- **零新增依赖**：React 19、TypeScript、vitest 均已在包内

### 与规范文档的偏差（均由 ve 约定强制，不影响渲染效果）

| 规范文档 | 本设计 | 原因 |
|---|---|---|
| React 18 | React 19 | react-components 包固定 React 19 |
| Tailwind v3 + shadcn/ui + lucide | 手写 CSS + inline SVG | ve 未引入 Tailwind |
| React Router 7 | 无路由 | 单组件挂载，由 Host 提供路由 |
| AMap DataV china.json（35 features, `center`/`adcode`） | ve ECharts 编码 china.json（34 features, `cp`） | 复用仓库已有数据，见 §4 |
| viewport width=375 | 标准 viewport | 原站缺陷，不沿用 |

## 组件信息

| 字段 | 值 |
|------|-----|
| id | `china-map-coloring` |
| name | `ChinaMapColoring` |
| title | 中国地图涂色 |
| description | 点击省份为地图上色：8 色调色板、hover 高亮、高级调试。 |
| framework | `react` |
| group | 数据可视化 |
| category | 地图 |
| platform | `both` |
| status | `stable` |
| route.path | `/components/china-map-coloring` |
| mount.kind | `react` / `propsMode: 'none'` |
| isolation.mode | `shadow-dom` |
| theme | `css-variables` / namespace `sl` |
| capabilities | `resizable: true`, `fullscreen: true`, `fullscreenMode: 'container'` |
| dependencies | 无 |

## 数据策略

**复用 `/map/json/china.json`，不引入新数据文件。**

该文件为 ECharts 压缩编码 GeoJSON（`FeatureCollection`，34 省）。实测验证的解析方式：

- 每个 `feature.geometry.coordinates` 是多边形数组，每个多边形是「编码字符串数组 + `encodeOffsets` 二维数组」：
  ```json
  { "type": "MultiPolygon", "coordinates": [["@@°Ü¯Û", "..."], "encodeOffsets": [[[x,y]],[[x,y]]] }"
  ```
- 解码算法（`charCode - 64` + zigzag 反差分），坐标单位为 ×1000：
  ```ts
  export function decodeRing(encoded: string, offset: [number, number]): [number, number][] {
    let px = offset[0], py = offset[1];
    const out: [number, number][] = [];
    for (let i = 0; i < encoded.length; i += 2) {
      let x = encoded.charCodeAt(i) - 64;
      let y = encoded.charCodeAt(i + 1) - 64;
      x = (x >> 1) ^ -(x & 1);
      y = (y >> 1) ^ -(y & 1);
      x += px; y += py;
      px = x; py = y;
      out.push([x / 1000, y / 1000]);   // ×1000 缩放还原为经纬度
    }
    return out;
  }
  ```
  已实证：台湾首环解码首点为 `[122886, 24033] ÷ 1000 = [122.886, 24.033]`，为有效经纬度。
- `properties`：`{ id, cp, name, childNum }`。label 中心取 `properties.cp`（已是普通经纬度）；`name` 已是短名，无需再短化。
- 省名短化规则（`toShortName`）仍保留（兼容未来换成全名数据源），但当前数据下基本为空转。

**合规**：复用仓库已有数据，无新增许可风险。README 注明边界数据为演示用途、商用需按国家审图标准确认。

## 文件结构

```
packages/react-components/src/china-map-coloring/
├── index.tsx              # 入口：布局 + 全局状态（选色/涂色/hover/debug）+ reset
├── component.config.ts
├── index.css              # 顶部 side-effect import；sl-cmc-* 前缀
├── README.md
└── src/
    ├── lib/               # 纯函数模块，可单测
    │   ├── decode.ts      # ECharts @@ 编码解码（§4 数据策略）
    │   ├── projection.ts  # project() + DEFAULT_MAP_CONFIG
    │   ├── geojson.ts     # buildProvinces() + toShortName()
    │   ├── render.ts      # renderMap() 渲染管线
    │   ├── hitTest.ts     # hitTest() 命中检测
    │   └── constants.ts   # PALETTE（8 色）
    ├── ChinaMap.tsx       # canvas 组件：fetch/构建/事件/resize/骨架屏
    ├── ColorPicker.tsx    # 8 色块 + 选中态 + "当前选择" 文案
    ├── DebugPanel.tsx     # 高级调试开关 + 复位按钮
    └── types.ts           # GeoJSON / ProvincePath / MapConfig 类型
```

`index.tsx` 只做壳（< 300 行），逻辑与子组件下沉到 `src/`，符合 large-component-layout 约定。

## 地图核心算法

### 投影（projection.ts）

与规范 §4.1 逐字一致：

```ts
export interface MapConfig {
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number };
  offset: { x: number; y: number };
  scale:  { x: number; y: number };
}
export const DEFAULT_MAP_CONFIG: MapConfig = {
  bounds: { minLng: 73.5, maxLng: 135, minLat: 18, maxLat: 53.5 },
  offset: { x: 0, y: 0 },
  scale:  { x: 1, y: 1 },
};
export function project(lng, lat, canvasW, canvasH, cfg = DEFAULT_MAP_CONFIG) {
  const wx = (lng - cfg.bounds.minLng) / (cfg.bounds.maxLng - cfg.bounds.minLng);
  const wy = 1 - (lat - cfg.bounds.minLat) / (cfg.bounds.maxLat - cfg.bounds.minLat); // y 翻转
  return { x: wx * canvasW * cfg.scale.x + cfg.offset.x,
           y: wy * canvasH * cfg.scale.y + cfg.offset.y };
}
```

- 画布逻辑尺寸固定 **1200×900**（`canvas.width/height`），与 CSS 尺寸无关。
- `scale`/`offset` 默认单位矩阵，保留给未来调试面板扩展（本期不实现）。

### 省份构建（geojson.ts）

`buildProvinces(fc, canvasW, canvasH, cfg)`：
- 逐 feature，`geometry.type === 'MultiPolygon'` 则取 `coordinates`，否则包一层统一处理。
- 每环解码后逐点 `project` → 独立 `Path2D`（含岛屿），`closePath()` 后收集。
- 每省 `bounds` 取所有点经纬度 min/max；`center` = `project(cp)`，`cp` 缺失时退回 bbox 中心。
- 输出 `ProvincePath[]`：`{ name, displayName, center, centerLngLat, paths, bounds }`。

### 渲染管线（render.ts）

`renderMap(ctx, provinces, colorByProvince, hoverName, debugMode)`，**顺序即效果**：

1. `clearRect` + 底色 `#F0F4F8` 铺满
2. 白色省面 `#FFFFFF`（fill 所有 path，避免间隙露底色）
3. 省界描边 `#CBD5E1` 1.5px
4. **涂色层**：`colorByProvince` 命中省，`globalAlpha 0.6` fill（顺序 B：垫在文字下，可读性更好——规范推荐，README 记录为唯一有意视觉差异）
5. 省名：白描边（`#FFFFFF` 3.5px）+ 深灰字（`#475569`），字号随名长 18/16/14，居中于 `center`，字体栈 `"Microsoft YaHei","PingFang SC",sans-serif`
6. debug：整图红描边 `#FF0000` 2px `alpha 0.8`
7. hover：命中省 `#3B82F6` 0.3 fill + `#2563EB` 2px stroke

### 命中检测（hitTest.ts）

`hitTest(provinces, ctx, clientX, clientY)`：
- `rect = canvas.getBoundingClientRect()`；`x = clientX * (1200 / rect.width)`，`y = clientY * (900 / rect.height)`。
- **倒序遍历** `provinces`（后绘优先，处理岛屿/重叠），对每省每 path `ctx.isPointInPath(path, x, y)` 命中即返回省全名，否则 `null`。

### 调色板（constants.ts）

```ts
export const PALETTE = [
  { name: "粉红色", value: "#FFB6C1" },
  { name: "浅绿色", value: "#90EE90" },
  { name: "橙色",   value: "#FFA500" },
  { name: "蓝色",   value: "#87CEEB" },
  { name: "紫色",   value: "#DDA0DD" },
  { name: "黄色",   value: "#FFD700" },
  { name: "红色",   value: "#FF6B6B" },
  { name: "青色",   value: "#40E0D0" },
];
```

## 组件与交互

### 全局状态（index.tsx）

- `colorByProvince: Record<string, string>` — key 为省全名，value 为 hex
- `selectedColor: string` — 默认 `PALETTE[0].value`（粉红色）
- `hoverName: string | null`
- `debugMode: boolean`
- `reset()` — 清空 `colorByProvince`

### ChinaMap（ChinaMap.tsx）

- `useEffect`：`fetch('/map/json/china.json')` → 解码 + `buildProvinces(..., 1200, 900)` → 存 state。加载中显示骨架屏。
- 重绘依赖：`provinces / colorByProvince / hoverName / debugMode` 任一变化 → 全量重绘（35 省 Path2D 重绘 < 50ms）。
- `window.resize` → 重绘。
- 事件：
  - `onClick` → `hitTest` → 命中则 `onProvinceClick(name)`
  - `onMouseMove` → `hitTest` → 设 hover + `cursor: pointer|default`
  - `onMouseLeave` → 清 hover + 光标复原
  - `onTouchStart / onTouchMove / onTouchEnd` → 移动端同效
- hover 名称气泡：地图卡左上角，`bg-white/90 backdrop-blur` 等效样式，`pointer-events: none`。

### ColorPicker（ColorPicker.tsx）

- 8 个 `<button>` 色块（`aria-pressed` + 可见 focus 态，键盘可操作）。
- 选中态：蓝色外环 + `✓`（inline SVG）。
- 下方文案：`当前选择：{名称}`。

### DebugPanel（DebugPanel.tsx）

- 开关 → 切 `debugMode`（渲染第 6 步红描边）。
- 复位按钮 → `reset()`。
- 本期不含 localStorage mapConfig 平移/缩放（属"完整 + 平移缩放"档，未选）。

### 布局

- 最外层：flex 纵向（header + main）。
- header：inline SVG 调色板图标 + 标题 + 副题说明。
- main：左地图卡 + 右栏（ColorPicker + 三步引导卡 + DebugPanel），`≤900px` 单列堆叠。
- 地图卡：卡片容器 + 标题栏 + 画布容器（`flex center`），canvas `max-width:100%` 等比自适应 + `touch-action:none`。
- 底部：自有署名（替换"秒哒制作"水印）。
- 三步引导文案：1 选择颜色 / 2 点击涂色 / 3 重复操作。

## 样式与主题

- `index.css` 顶部被 `index.tsx` side-effect import；类名全部 `sl-cmc-*` 前缀（ShadowRoot 样式 adoption 识别）。
- 壳 UI（卡片、按钮、色块、文字）走 `var(--sl-*, fallback)` token；画布内颜色为固定 hex（§渲染管线），不随主题变化。
- 间距走 4/8/12/16/24 标准步长；扁平白色背景、单一强调色（#ec4899 粉），与 gis 系列风格一致。
- 字体栈：系统字体 + `"Microsoft YaHei","PingFang SC"`（省名用）。

## 无障碍与响应式

- canvas：`role="img"` + `aria-label="中国地图"`。
- 色块：`<button>` + `aria-pressed` + focus 可见态；键盘可全流程操作。
- 响应式：`max-width:100%` + 高度按 `1200/900` 比例自适应；`≤900px` 主区单列。
- 不沿用原站 `viewport width=375` 缺陷；组件页面为标准 viewport。

## 测试

`packages/react-components/__tests__/china-map-coloring.test.ts`（vitest，纯函数）：

| 用例 | 断言 |
|---|---|
| `decodeRing` | 台湾首环首点 ≈ `[122.886, 24.033]`（用真实 ve china.json 数据） |
| `project` | 边界点 `(73.5, 53.5)` → `(0,0)`；`(135, 18)` → `(1200,900)` |
| `toShortName` | 新疆维吾尔自治区→新疆；北京市→北京市（无后缀不截）；xx特别行政区→xx |
| `buildProvinces` | 34 省；每省 `paths.length >= 1`；`center` 有限数 |
| `PALETTE` | 8 色逐色与规范 §4.5 一致 |

## 验收标准

对照规范文档 §10，结合 ve 环境调整：

| # | 验收项 | 判定 |
|---|---|---|
| 1 | 打开即见中国地图，浅灰蓝底、白色省面、灰蓝省界 | 目测近似 |
| 2 | 省名显示正确且位置合理（台湾/河北等短名） | 目测 + 数据断言 |
| 3 | 点击省份 → 以当前颜色填充（alpha 0.6），可重复改色 | 手动 |
| 4 | Hover 省份 → 蓝色高亮 + 名称气泡 + pointer 光标 | 手动 |
| 5 | 右侧 8 色块，选中态 + "当前选择" 文案 | 手动 |
| 6 | 移动端触摸可涂色（无滚动干扰） | 模拟器/真机 |
| 7 | 窗口 resize 重绘不糊、不错位 | 手动 |
| 8 | 高级调试开关 → 红描边；复位 → 清空 | 手动 |
| 9 | 构建通过、无 TS/Lint 错误；组件出现在 showcase 卡片网格 | CI + dev server |
| 10 | 数据合规说明写入 README | 文档 |

## 风险与记录偏差

1. **数据编码**：ve china.json 为 ECharts 压缩编码，解码器是本组件唯一非标的实现点，已用真实数据断言锁定。
2. **label 位置源**：用 `cp`（对标站用 DataV `center`）；两者都是官方中心点，差异可忽略。
3. **渲染顺序**：涂色垫底（顺序 B），唯一与原型有意的视觉差异，README 明示。
4. **省名重叠**：东南沿海密集区文字可能重叠——原型即有，本期不处理（记录为已知项）。
5. **Canvas DPI**：1200×900 逻辑分辨率，Retina 下略糊——原型同款，本期不增强（记录为已知项）。

## 交付物清单

- [x] 本设计文档
- [ ] `china-map-coloring` 组件（index.tsx / config / css / README / src/ 各模块）
- [ ] 纯函数单测（decode/project/toShortName/buildProvinces/PALETTE）
- [ ] 验收跑通（§验收标准 1-9）
