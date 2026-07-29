# GIS 旅行日记组件 - AI Agent 记忆文档

> 基于 Vue 3 + OpenLayers 的旅行日记应用。**Agent 请注意**: 主入口文件是 `gis.vue`

---

## 快速导航

- [组件架构总览](#组件架构总览)
- [gis.vue - 地图核心](#gisvue---地图核心组件)
- [ControlPanel.vue - 控制面板](#controlpanelvue---控制面板组件)
- [LocationSearch.vue - 地点搜索](#locationsearchvue---地点搜索组件)
- [StorageManager.js - 存储管理](#storagemanagerjs---存储管理器)
- [PointEditor.vue - 编辑器](#pointeditorvue---编辑器对话框)
- [PointList.vue - 列表组件](#pointlistvue---记录列表组件)
- [小车动画算法](#小车动画核心算法)
- [开发指南](#开发指南)

---

## 组件架构总览

### 文件结构

```
gis/
├── component.js       # 组件元数据（自动发现系统）
├── gis.vue            # 主地图组件 ⭐ 核心逻辑层
├── ControlPanel.vue   # 左侧控制面板（UI 层）
├── PointEditor.vue    # 编辑器对话框（表单层）
├── PointList.vue      # 记录点列表（展示层）
├── LocationSearch.vue # 地点搜索组件（高德地图 API）
├── StorageManager.js  # 数据存储管理器（JSON 导入导出）
└── README.md          # 本文档
```

### 架构设计原则

```
┌─────────────────────────────────────────────────────────────┐
│                        gis.vue ⭐                           │
│                   （地图核心 + 数据状态）                    │
│  • OpenLayers Map 初始化和管理                               │
│  • 数据状态: recordPoints, routes, tempRoutePoints          │
│  • 地图事件: click, pointermove                             │
│  • 动画控制: playRouteAnimation                             │
└──────────────────┬──────────────────────────────────────────┘
                   │ props (down)     events (up)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    ControlPanel.vue                         │
│                 （左侧控制面板 UI）                          │
│  • 记录点列表区域 (复用 PointList)                           │
│  • 路线管理区域（绘制、播放、删除）                          │
│  • 图层切换区域                                              │
│  • 纯 UI 组件，无业务逻辑                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    PointList.vue                            │
│                 （记录点列表组件）                           │
│  • 折叠列表展示                                              │
│  • 定位、编辑、删除操作                                      │
│  • 图片预览功能                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   PointEditor.vue                           │
│                （编辑器对话框组件）                          │
│  • 5 种编辑模式：create/edit/view/route/route-point         │
│  • 表单输入：标题、描述、图片                                │
│  • 只读模式支持                                              │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

```
用户操作 → ControlPanel.vue → emit事件 → gis.vue → 处理逻辑
                                                    ↓
                                              更新数据状态
                                                    ↓
                                              props传递 → ControlPanel.vue
```

## 组件职责划分

### gis.vue - 地图核心组件 ⭐

**文件路径**: `src/components/huang/gis/gis.vue`

**职责**: OpenLayers 地图的初始化和核心交互逻辑

- 地图实例创建和配置（Map, View, Layers）
- 地图事件处理（点击、悬停、绘制）
- 要素管理（点、路线的增删改查）
- 动画控制（小车沿路线行驶）
- 数据状态管理（recordPoints, routes, tempRoutePoints）

**主要依赖**:

- OpenLayers 核心库
- PointEditor.vue（编辑器）
- ControlPanel.vue（UI 控制）

### ControlPanel.vue - 控制面板组件

**文件路径**: `src/components/huang/gis/ControlPanel.vue`

**职责**: 左侧侧边栏的所有 UI 交互

- 记录点列表展示（复用 PointList）
- 路线管理界面（绘制、完成、取消、播放、删除）
- 图层切换控制

**数据流**:

- 接收 props: recordPoints, routes, layers, currentLayerIndex, isDrawingRoute
- 发出事件: switchLayer, startDrawRoute, finishRoute, cancelDrawRoute, playRouteAnimation 等

### PointEditor.vue - 编辑器对话框

**文件路径**: `src/components/huang/gis/PointEditor.vue`

**职责**: 记录点和路线的编辑界面

- 5 种编辑模式：create, edit, view, route, route-point
- 表单输入（标题、描述、图片上传）
- 只读模式支持

### PointList.vue - 记录列表组件

**文件路径**: `src/components/huang/gis/PointList.vue`

**职责**: 记录点的折叠列表展示

- 展开/收起交互
- 定位、编辑、删除操作
- 图片预览功能

## 核心功能

### 1. 记录点管理 (Points)

**数据结构:**

```javascript
{
  id: number,           // 唯一标识
  lon: number,          // 经度
  lat: number,          // 纬度
  title: string,        // 标题
  description: string,  // 描述
  images: string[],     // 图片数组 (base64)
  time: string          // 创建时间
}
```

**操作:**

- 点击空白地图区域 → 创建新记录
- 点击已有点 → 查看详情 (只读模式)
- 鼠标悬停 → 点放大 + 显示标题

### 2. 路线绘制 (Routes)

**绘制流程:**

1. 点击"✏️ 开始绘制路线"
2. 在地图上点击添加转折点
3. 点击"✓ 完成绘制"或再次点击绘制按钮
4. 弹出编辑器填写路线信息
5. 保存后路线变为实线

**路线数据结构:**

```javascript
{
  id: number,
  name: string,         // 路线名称
  title: string,        // 同 name
  description: string,
  images: string[],
  length: string,       // 格式化距离 "1.23 km" 或 "123 m"
  coordinates: number[][], // OpenLas 坐标数组 [[x, y], ...]
  points: object[],     // 转折点数据
  feature: Feature,     // OpenLas Feature 引用
  time: string
}
```

### 3. 路线转折点 (Route Waypoints)

每个转折点独立可编辑，类似于普通记录点。

**转折点数据结构:**

```javascript
{
  id: string,           // 格式: "route-point-{timestamp}-{index}"
  lon: number,
  lat: number,
  title: string,
  description: string,
  images: string[]
}
```

**特殊属性:**

- `isRoutePoint: true` - 标识为路线转折点
- `routePointIndex: number` - 在路线中的索引

### 4. 小车动画 (Car Animation)

**实现方式:**

- 使用 OpenLas `Overlay` 显示小车图片
- 使用 `requestAnimationFrame` 实现平滑动画
- 固定 10 秒完成整条路线 (不随路线长度变化)
- **只使用一张图片** `right.gif`，通过 CSS `scaleX(-1)` 实现左右翻转

**关键代码:**

```javascript
const playRouteAnimation = (routeId) => {
  const duration = 10000 // 固定10秒

  const animate = () => {
    // 计算当前在哪一段
    const totalSegments = coordinates.length - 1
    const currentSegment = Math.floor(progress * totalSegments)
    const segmentProgress = (progress * totalSegments) - currentSegment

    // 线性插值计算位置
    const x = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress
    const y = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress

    // 计算方向角度（弧度）
    const dx = endCoord[0] - startCoord[0]
    const dy = endCoord[1] - startCoord[1]
    const angleRad = Math.atan2(dy, dx)

    // 参考 vector-move.html 的小车算法：
    // 1. 先取反角度（修复上下翻转）
    // 2. 如果向左（dx < 0），需要减去 π 然后水平翻转
    let angle = -angleRad  // 先取反，修复上下翻转
    let needsFlip = false

    if (dx < 0) {
      // 向左行驶：减去 π，然后水平翻转
      // 这样可以保持小车上下方向正确（人不会倒立）
      angle = angle - Math.PI
      needsFlip = true
    }

    // 更新小车位置和旋转
    carOverlay.value.setPosition([x, y])
    const angleDeg = angle * 180 / Math.PI
    carElement.style.transform = `rotate(${angleDeg}deg) scaleX(${needsFlip ? -1 : 1})`
  }
}
```

**角度计算说明:**

- 小车图片：`right.gif` 朝右（0°），上面是人，下面是车
- 屏幕坐标系：x 向右为正，y 向下为正
- `Math.atan2(dy, dx)` 返回从 x 轴正方向（向右）的角度（弧度）
- **所有方向先取反角度** `angle = -angleRad` 来修复上下反转问题
- **向左行驶（dx < 0）**：再减去 π（或加 π）并使用 `scaleX(-1)` 水平翻转
  - 这样小车始终保持上下方向正确，人不会倒立
- **向右/上/下行驶（dx >= 0）**：直接使用取反后的角度，不翻转

**小车图片路径:** `/public/map/right.gif`

### 5. 数据存储与导入导出 (Storage)

**功能：**

- **导出数据**：将当前记录点和路线导出为 JSON 文件
- **导入预设**：加载内置的示例数据（北京旅行路线）
- **导入文件**：从 JSON 文件导入数据

**JSON 数据格式：**

```json
{
  "version": "2.0.0",
  "format": "gis-travel-diary",
  "title": "旅行日记数据",
  "description": "导出的旅行记录",
  "exportedAt": "2025-12-27T10:00:00.000Z",
  "statistics": {
    "totalPoints": 5,
    "totalRoutes": 2,
    "totalImages": 0
  },
  "data": {
    "points": [
      {
        "id": 1234567890,
        "lon": 116.4074,
        "lat": 39.9042,
        "title": "天安门",
        "description": "北京市中心",
        "images": ["data:image/jpeg;base64,..."],
        "time": "2025-12-27 10:00:00"
      }
    ],
    "routes": [
      {
        "id": 1234567891,
        "name": "北京一日游",
        "title": "北京一日游",
        "description": "经典路线",
        "images": [],
        "length": "5.23 km",
        "coordinates": [[x1, y1], [x2, y2], ...],
        "points": [
          {
            "id": "route-point-1",
            "lon": 116.397128,
            "lat": 39.916527,
            "title": "起点",
            "description": "",
            "images": []
          }
        ],
        "time": "2025-12-27 10:00:00"
      }
    ]
  }
}
```

**存储管理器 API：**

| 函数 | 说明 |
|------|------|
| `exportToJson(points, routes, options)` | 导出为 JSON 对象 |
| `downloadJsonFile(jsonData, filename)` | 下载 JSON 文件 |
| `readJsonFile(file)` | 读取 JSON 文件 |
| `importFromJson(jsonData)` | 从 JSON 导入数据 |
| `getPresetData()` | 获取预设示例数据 |
| `mergeData(existing, imported, options)` | 合并数据 |

**坐标说明：**

- `lon`/`lat`: 经纬度坐标 (EPSG:4326)，用于存储和显示
- `coordinates`: EPSG:3857 (Web Mercator) 格式，OpenLayers 内部使用
- 导入时会自动转换坐标系统

## 编辑器模式 (Editor Modes)

PointEditor 组件支持 5 种模式:

| 模式            | 用途           | 标题示例      | 只读 |
| --------------- | -------------- | ------------- | ---- |
| `create`      | 创建新记录点   | 📍 新建记录   | 否   |
| `edit`        | 编辑已有记录点 | ✏️ 编辑记录 | 否   |
| `view`        | 查看记录详情   | 📍 查看记录   | 是   |
| `route`       | 编辑路线信息   | 🛣️ 编辑路线 | 否   |
| `route-point` | 编辑路线转折点 | 📍 编辑转折点 | 否   |

## 状态管理

### 主要响应式状态

```javascript
// 地图相关
const map = shallowRef(null)              // OpenLas Map 实例
const mapContainer = ref(null)            // 地图 DOM 容器

// 图层
const vectorSource = ref(null)            // 矢量要素源 (点)
const routeSource = ref(null)             // 路线要素源
const vectorLayer = ref(null)             // 矢量图层
const routeLayer = ref(null)              // 路线图层

// 数据
const recordPoints = ref([])              // 记录点数组
const routes = ref([])                    // 路线数组
const isDrawingRoute = ref(false)         // 是否正在绘制
const tempRoutePoints = ref([])           // 临时转折点 { coordinate, feature, data }
const tempRouteFeature = ref(null)        // 临时路线 Feature

// 编辑器
const showEditor = ref(false)             // 显示编辑器
const editingPoint = ref(null)            // 正在编辑的点
const editorMode = ref('create')          // 编辑器模式
const editingRoute = ref(null)            // 正在编辑的路线
const editingRoutePointIndex = ref(null)  // 正在编辑的转折点索引

// 交互
const hoveredPointId = ref(null)          // 当前悬停的点ID

// 动画
const carOverlay = ref(null)              // 小车 Overlay
const animationProgress = ref(0)          // 动画进度 0-1
const animationId = ref(null)             // requestAnimationFrame ID
```

## 核心函数说明

### 地图初始化

```javascript
onMounted(() => {
  // 创建瓦片图层 (OSM, 高德)
  // 创建矢量图层 (点)
  // 创建路线图层
  // 初始化 Map 实例
  // 绑定事件: click, pointermove
})
```

### 点击处理 (handleClick)

```javascript
const handleClick = (event) => {
  // 1. 如果正在绘制路线 → 添加转折点
  // 2. 检查是否点击了要素
  //    - 是路线转折点 → 编辑转折点
  //    - 是普通记录点 → 查看详情
  // 3. 点击空白区域 → 创建新记录
}
```

### 悬停效果 (handlePointerMove)

```javascript
const handlePointerMove = (event) => {
  // 检测鼠标下的要素
  // 更新要素样式 (放大 + 显示标题)
  // 改变鼠标指针
}
```

### 路线操作

```javascript
// 开始绘制
const startDrawRoute = () => {
  isDrawingRoute.value = true
  // 禁用双击缩放
}

// 完成绘制
const finishRoute = () => {
  // 创建路线 Feature
  // 保存到 routes 数组
  // 打开编辑器填写信息
}

// 取消绘制
const cancelDrawRoute = () => {
  // 清除临时转折点和路线
}
```

## 样式规范

### 颜色变量

```css
--primary: #ec4899      /* 主粉色 */
--primary-light: #f472b6 /* 浅粉色 */
--bg-pink: #fce7f3      /* 背景粉 */
--bg-pink-dark: #fdf2f8 /* 深背景粉 */
--text-gray: #6b7280    /* 灰色文字 */
--text-light: #9ca3af   /* 浅灰色文字 */
```

### 点的样式

| 状态       | 半径 | 填充    | 描边     |
| ---------- | ---- | ------- | -------- |
| 普通       | 12px | #ec4899 | #fff 3px |
| 悬停       | 16px | #ec4899 | #fff 4px |
| 转折点     | 8px  | #f472b6 | #fff 2px |
| 转折点悬停 | 12px | #f472b6 | #fff 3px |

### 路线样式

| 状态   | 颜色    | 宽度 | 线型         |
| ------ | ------- | ---- | ------------ |
| 绘制中 | #f472b6 | 4px  | [10, 5] 虚线 |
| 已保存 | #ec4899 | 5px  | 实线         |

## 开发指南

### 添加新的记录字段

1. 更新 `PointEditor.vue` 中的表单
2. 更新 `gis.vue` 中 `handleSavePoint` 的保存逻辑
3. 更新 `PointList.vue` 的显示模板

### 修改控制面板 UI

- 控制面板样式在 `ControlPanel.vue` 中
- 路线管理界面在 `ControlPanel.vue` 的 `panel-section` 中
- 图层切换按钮在 `ControlPanel.vue` 的底部

### 修改主题颜色

替换以下文件中的颜色值:

- `gis.vue` 中的地图相关样式
- `ControlPanel.vue` 中的控制面板样式
- `PointEditor.vue` 中的编辑器样式
- `PointList.vue` 中的列表样式

### 调整动画速度

```javascript
// gis.vue line ~692
const duration = 10000 // 修改此值 (毫秒)
```

### 添加新的地图图层

```javascript
// gis.vue 中的 layers 配置
const layers = ref([
  { name: '图层名称', type: 'xyz', visible: false, url: 'https://...' }
])
```

---

## gis.vue - 地图核心组件

> **文件路径**: `src/components/huang/gis/gis.vue` ⭐

### 关键函数索引（Agent 快速查找）

| 函数名                                   | 行号 | 功能                                   |
| ---------------------------------------- | ---- | -------------------------------------- |
| `switchLayer(index)`                   | ~111 | 切换地图图层                           |
| `createPointFeature(point)`            | ~121 | 创建点的 Feature                       |
| `updatePointStyle(feature, isHovered)` | ~132 | 更新点样式（普通/悬停）                |
| `refreshMapPoints()`                   | ~154 | 刷新地图上的所有点                     |
| `flyToPoint(point)`                    | ~162 | 定位到指定点                           |
| `handleClick(event)`                   | ~173 | **地图点击处理（核心交互逻辑）** |
| `handlePointerMove(event)`             | ~301 | **鼠标悬停效果**                 |
| `showPointImagePreview(coord, url)`    | ~387 | 显示点图片预览 overlay                 |
| `handleSavePoint(data)`                | ~410 | **保存记录点/路线/转折点**       |
| `handleEditPoint(point)`               | ~477 | 编辑记录点                             |
| `handleDeletePoint(pointId)`           | ~483 | 删除记录点                             |
| `startDrawRoute()`                     | ~518 | 开始绘制路线                           |
| `finishRoute()`                        | ~530 | 完成路线绘制                           |
| `cancelDrawRoute()`                    | ~592 | 取消路线绘制                           |
| `deleteRoute(routeId)`                 | ~626 | 删除路线                               |
| `zoomToRoute(routeId)`                 | ~644 | 定位到路线                             |
| `playRouteAnimation(routeId)`          | ~655 | **播放路线动画（核心动画逻辑）** |

### 主要响应式状态

```javascript
// 地图相关
const map = shallowRef(null)              // OpenLayers Map 实例
const mapContainer = ref(null)            // 地图 DOM 容器

// 图层
const vectorSource = new VectorSource()   // 矢量要素源 (点)
const routeSource = new VectorSource()    // 路线要素源
const vectorLayer = new VectorLayer({...})
const routeLayer = new VectorLayer({...})

// 数据
const recordPoints = ref([])              // 记录点数组
const routes = ref([])                    // 路线数组
const isDrawingRoute = ref(false)         // 是否正在绘制
const tempRoutePoints = ref([])           // 临时转折点
const tempRouteFeature = ref(null)        // 临时路线 Feature

// 编辑器
const showEditor = ref(false)             // 显示编辑器
const editingPoint = ref(null)            // 正在编辑的点
const editorMode = ref('create')          // 编辑器模式
const editingRoute = ref(null)            // 正在编辑的路线
const editingRoutePointIndex = ref(null)  // 正在编辑的转折点索引

// 交互
const hoveredPointId = ref(null)          // 当前悬停的点ID

// 动画
const carOverlay = ref(null)              // 小车 Overlay
const animationProgress = ref(0)          // 动画进度 0-1
const animationId = ref(null)             // requestAnimationFrame ID
```

### OpenLayers 图层配置

```javascript
// 矢量图层（点）
vectorSource + vectorLayer
  - 默认样式：粉色圆点 #ec4899，白色描边
  - 悬停样式：放大到 16px

// 路线图层
routeSource + routeLayer
  - 绘制中：粉色虚线 #f472b6，[10, 5] 虚线
  - 已保存：粉色实线 #ec4899，5px

// 动画路线图层
animationRouteSource + animationRouteLayer
  - 已走过的部分：粉色实线 #ec4899，6px
  - zIndex: 101（最上层）
```

---

## ControlPanel.vue - 控制面板组件

> **文件路径**: `src/components/huang/gis/ControlPanel.vue`

### Props

```javascript
{
  recordPoints: Array,         // 记录点数据
  routes: Array,               // 路线数据
  layers: Array,               // 图层配置
  currentLayerIndex: Number,   // 当前图层索引
  isDrawingRoute: Boolean,     // 是否正在绘制
  tempRoutePointsCount: Number // 临时路线点数量
}
```

### Events

```javascript
'startDrawRoute'      // 开始绘制路线
'finishRoute'         // 完成绘制
'cancelDrawRoute'     // 取消绘制
'playRouteAnimation'  // 播放动画 (routeId)
'zoomToRoute'         // 定位路线 (routeId)
'deleteRoute'         // 删除路线 (routeId)
'switchLayer'         // 切换图层 (index)
'editPoint'           // 编辑点 (point)
'deletePoint'         // 删除点 (pointId)
'selectPoint'         // 定位点 (point)
'previewImage'        // 预览图片 (url, event)
'searchLocation'      // 搜索地点 (place)
'importData'          // 导入数据 ({points, routes})
```

### UI 结构

```
┌─────────────────────────────────┐
│  🔍 搜索地点                    │
│  [搜索框]                       │
│                                 │
│  📝 我的记录 (PointList)        │
│  ┌───────────────────────────┐  │
│  │ - 点1                      │  │
│  │ - 点2                      │  │
│  └───────────────────────────┘  │
│                                 │
│  🛣️ 我的路线                    │
│  [✏️ 开始绘制路线]              │
│  ┌───────────────────────────┐  │
│  │ 路线1              [🚗][🎯]│  │
│  │ 路线2              [🚗][🎯]│  │
│  └───────────────────────────┘  │
│                                 │
│  🗺️ 地图图层                    │
│  [OpenStreetMap]                │
│  [高德地图]                      │
│                                 │
│  💾 数据管理                    │
│  [📤 导出数据]                  │
│  [📦 加载预设]                  │
│  [📥 导入文件]                  │
└─────────────────────────────────┘
```

---

## LocationSearch.vue - 地点搜索组件

> **文件路径**: `src/components/huang/gis/LocationSearch.vue`

**职责**: 使用高德地图 API 搜索地点

- 输入关键词搜索地点
- 显示搜索结果（名称、地址、类型）
- 500ms 防抖优化
- 发出 `select` 事件

### Props

```javascript
{
  show: Boolean,      // 是否显示
  placeholder: String, // 占位符
  minLength: Number   // 最小输入长度（默认2）
}
```

### Events

```javascript
'select'  // 选择地点 (place)
```

### Place 数据结构

```javascript
{
  id: string,          // 地点ID
  name: string,        // 名称
  address: string,     // 地址
  lon: number,         // 经度
  lat: number,         // 纬度
  type: string         // 类型
}
```

### API Key

高德地图 API Key 已内置：`973b435c91011c1b33b8c633c6c9eb56`

---

## StorageManager.js - 存储管理器

> **文件路径**: `src/components/huang/gis/StorageManager.js`

**职责**: JSON 数据的导出、导入和验证

### 导出函数

| 函数 | 说明 |
|------|------|
| `exportToJson(points, routes, options)` | 导出为 JSON 对象 |
| `downloadJsonFile(jsonData, filename)` | 下载 JSON 文件 |

### 导入函数

| 函数 | 说明 |
|------|------|
| `readJsonFile(file)` | 读取 JSON 文件 |
| `importFromJson(jsonData)` | 从 JSON 导入数据 |
| `getPresetData()` | 获取预设示例数据 |
| `mergeData(existing, imported, options)` | 合并数据 |

### 验证函数

| 函数 | 说明 |
|------|------|
| `validateJsonData(data)` | 验证 JSON 数据格式 |

---

## PointEditor.vue - 编辑器对话框

> **文件路径**: `src/components/huang/gis/PointEditor.vue`

### Props

```javascript
{
  point: Object,    // 编辑的点数据
  show: Boolean,    // 是否显示
  mode: String      // 编辑模式
}
```

### 表单字段

```javascript
{
  title: string,        // 标题
  description: string,  // 描述
  images: string[]      // 图片数组（base64）
}
```

---

## PointList.vue - 记录列表组件

> **文件路径**: `src/components/huang/gis/PointList.vue`

### Props

```javascript
{
  points: Array    // 记录点数组
}
```

### Events

```javascript
'edit'      // 编辑点 (point)
'delete'    // 删除点 (pointId)
'select'    // 定位点 (point)
'preview'   // 预览图片 (url, event)
```

---

## 小车动画核心算法

> **位置**: `gis.vue` line ~655-795

### 位置计算（线性插值）

```javascript
// 计算当前在哪一段
const totalSegments = coordinates.length - 1
const currentSegment = Math.floor(progress * totalSegments)
const segmentProgress = (progress * totalSegments) - currentSegment

// 线性插值计算位置
const x = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress
const y = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress
```

### 角度计算（关键算法）

```javascript
// 计算方向角度（弧度）
const dx = endCoord[0] - startCoord[0]
const dy = endCoord[1] - startCoord[1]
const angleRad = Math.atan2(dy, dx)

// 修复上下翻转
let angle = -angleRad
let needsFlip = false

// 向左行驶：减去 π，然后水平翻转
if (dx < 0) {
  angle = angle - Math.PI
  needsFlip = true
}

// 应用样式
carElement.style.transform = `rotate(${angleDeg}deg) scaleX(${needsFlip ? -1 : 1})`
```

### 算法说明

| 步骤                  | 说明     | 原因                                         |
| --------------------- | -------- | -------------------------------------------- |
| `angle = -angleRad` | 取反角度 | 修复屏幕坐标系（y 向下为正）导致的上下翻转   |
| `if (dx < 0)`       | 判断方向 | 向左行驶需要特殊处理                         |
| `angle -= Math.PI`  | 减去 π  | 保证向左行驶时小车上下方向正确（人不会倒立） |
| `scaleX(-1)`        | 水平翻转 | 配合角度调整完成正确的朝向                   |

### 小车图片

**路径**: `/public/map/right.gif`
**说明**: 只用一张朝右的图片，通过 CSS 翻转实现多方向

---

## 重要注意事项

### 坐标系统

- **内部坐标**: EPSG:3857 (Web Mercator)
- **显示坐标**: EPSG:4326 (经纬度)
- **转换函数**:
  - `fromLonLat([lon, lat])` → 经纬度转墨卡托
  - `toLonLat([x, y])` → 墨卡托转经纬度

### Feature ID 管理

每个 Feature 必须有唯一 ID：

- 记录点: `Date.now()`
- 转折点: `route-point-${timestamp}-${index}`

### 内存清理

```javascript
onUnmounted(() => {
  cancelAnimationFrame(animationId)      // 清理动画
  map.removeOverlay(pointImageOverlay)   // 清理 overlay
  map.setTarget(null)                    // 清理地图
})
```

---

## 扩展建议

- [ ] 添加本地存储（localStorage）持久化
- [ ] 支持 GPX/KML 文件导入导出
- [ ] 添加路线编辑（拖拽转折点）
- [ ] 支持多条路线动画同时播放
- [ ] 添加拍照功能（设备相机）
- [ ] 支持语音记录描述
- [ ] 添加天气信息查询
- [ ] 支持分享路线链接

---

**版本**: 2.0.0
**最后更新**: 2025-12-26
