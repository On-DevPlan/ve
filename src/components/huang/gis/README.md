# GIS 旅行日记组件技术文档

## 组件概述

一个基于 Vue 3 + OpenLayers 的旅行日记应用，支持记录旅行足迹、绘制路线、添加照片和描述，并具有小车沿路线动画功能。

## 技术栈

- **Vue 3 Composition API**: ref, reactive, computed, watch, onMounted, onUnmounted, shallowRef
- **OpenLayers**: 地图渲染引擎
  - Map, View, TileLayer, VectorLayer
  - OSM, XYZ (瓦片图层)
  - Feature, Point, LineString (几何要素)
  - Style, Fill, Stroke, Circle, Text (样式)
  - Overlay (覆盖层)
  - Select, DoubleClickZoom (交互)
  - getLength (距离计算)
- **主题色**: 粉红色系 (#ec4899, #f472b6, #fce7f3, #fbcfe8)

## 文件结构

```
gis/
├── component.js       # 组件元数据配置
├── index.vue          # 主地图组件
├── PointEditor.vue    # 记录编辑器对话框
└── PointList.vue      # 记录列表侧边栏
```

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

    // 计算旋转角度（屏幕坐标系：x向右为正，y向下为正）
    const dx = endCoord[0] - startCoord[0]
    const dy = endCoord[1] - startCoord[1]
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    // 判断是否需要水平翻转：当向左行驶时（dx < 0）
    const needsFlip = dx < 0
    // scaleX(-1) 会反转旋转方向，所以翻转时需要取反角度
    const rotationAngle = needsFlip ? -angle : angle

    // 更新小车
    carOverlay.value.setPosition([x, y])
    carElement.style.transform = `rotate(${rotationAngle}deg) scaleX(${needsFlip ? -1 : 1})`
  }
}
```

**角度计算说明:**
- 小车图片原始朝向：向右（水平）
- 屏幕坐标系：x 向右为正，y 向下为正
- `Math.atan2(dy, dx)` 返回从 x 轴正方向（向右）的角度
- 向右/下/上行驶（dx >= 0）：`rotate(angle) scaleX(1)`
- 向左行驶（dx < 0）：`rotate(-angle) scaleX(-1)` - 翻转并反转角度（因为 scaleX(-1) 会反转旋转方向）

**小车图片路径:** `/public/map/test.gif`

## 编辑器模式 (Editor Modes)

PointEditor 组件支持 5 种模式:

| 模式 | 用途 | 标题示例 | 只读 |
|------|------|----------|------|
| `create` | 创建新记录点 | 📍 新建记录 | 否 |
| `edit` | 编辑已有记录点 | ✏️ 编辑记录 | 否 |
| `view` | 查看记录详情 | 📍 查看记录 | 是 |
| `route` | 编辑路线信息 | 🛣️ 编辑路线 | 否 |
| `route-point` | 编辑路线转折点 | 📍 编辑转折点 | 否 |

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

| 状态 | 半径 | 填充 | 描边 |
|------|------|------|------|
| 普通 | 12px | #ec4899 | #fff 3px |
| 悬停 | 16px | #ec4899 | #fff 4px |
| 转折点 | 8px | #f472b6 | #fff 2px |
| 转折点悬停 | 12px | #f472b6 | #fff 3px |

### 路线样式

| 状态 | 颜色 | 宽度 | 线型 |
|------|------|------|------|
| 绘制中 | #f472b6 | 4px | [10, 5] 虚线 |
| 已保存 | #ec4899 | 5px | 实线 |

## 开发指南

### 添加新的记录字段

1. 更新 `PointEditor.vue` 中的表单
2. 更新 `index.vue` 中 `handleSavePoint` 的保存逻辑
3. 更新 `PointList.vue` 的显示模板

### 修改主题颜色

替换以下文件中的颜色值:
- `index.vue` 中的样式定义
- `PointEditor.vue` 中的组件样式
- `PointList.vue` 中的列表样式

### 调整动画速度

```javascript
// index.vue line 599
const duration = 10000 // 修改此值 (毫秒)
```

### 添加新的地图图层

```javascript
// index.vue line 82-85
const layers = ref([
  { name: '图层名称', type: 'xyz', visible: false, url: 'https://...' }
])
```

## 注意事项

1. **坐标系统**: OpenLas 内部使用 EPSG:3857 (Web Mercator)，显示时转换为 EPSG:4326 (经纬度)
   - 转换函数: `fromLonLat([lon, lat])` 和 `toLonLat([x, y])`

2. **Feature ID 管理**: 每个 Feature 必须有唯一 ID 用于识别和交互
   - 记录点: `Date.now()`
   - 转折点: `route-point-${timestamp}-${index}`

3. **样式更新**: 直接调用 `feature.setStyle()` 即可触发重新渲染

4. **内存清理**: 组件卸载时需要清理:
   - `cancelAnimationFrame(animationId)`
   - `map.setTarget(null)`

5. **图片存储**: 当前使用 base64 字符串存储在内存中，生产环境建议使用对象存储

## 扩展建议

- [ ] 添加本地存储 (localStorage) 持久化数据
- [ ] 支持 GPX/KML 文件导入导出
- [ ] 添加路线编辑功能 (拖拽转折点)
- [ ] 支持多条路线动画同时播放
- [ ] 添加拍照功能 (调用设备相机)
- [ ] 支持语音记录描述
- [ ] 添加天气信息查询
- [ ] 支持分享路线链接
