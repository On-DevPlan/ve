<script setup>
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'
import { fromLonLat, toLonLat } from 'ol/proj'
import { defaults as defaultControls } from 'ol/control'
import { ScaleLine, FullScreen, MousePosition } from 'ol/control'
import { defaults as defaultInteractions, DoubleClickZoom } from 'ol/interaction'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Snap from 'ol/interaction/Snap'
import Select from 'ol/interaction/Select'
import { Style, Fill, Stroke, Circle, Text } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { GeoJSON } from 'ol/format'
import { getArea, getLength } from 'ol/sphere'

// 地图容器
const mapContainer = ref(null)
// 地图实例（使用 shallowRef 避免深层响应式）
const map = shallowRef(null)
// 绘制交互
const drawInteraction = ref(null)
const modifyInteraction = ref(null)
const selectInteraction = ref(null)
// 当前绘制类型
const currentDrawType = ref(null)
// 当前选中图层
const currentLayerIndex = ref(0)
// 矢量源
const vectorSource = new VectorSource()
const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: new Style({
    fill: new Fill({ color: 'rgba(255, 255, 0, 0.2)' }),
    stroke: new Stroke({ color: '#ff0000', width: 2 }),
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: '#ff0000' })
    })
  })
})

// 路线专用矢量源和图层
const routeSource = new VectorSource()
const routeLayer = new VectorLayer({
  source: routeSource,
  style: new Style({
    stroke: new Stroke({
      color: '#3b82f6',
      width: 4,
      lineDash: [10, 5]
    })
  }),
  zIndex: 100  // 确保路线图层在最上层
})
// 路线列表
const routes = ref([])
// 当前路线名称
const currentRouteName = ref('')
// 是否正在绘制路线
const isDrawingRoute = ref(false)
// 路线绘制交互
const routeDrawInteraction = ref(null)

// 图层配置
const layers = ref([
  { name: 'OpenStreetMap', type: 'osm', visible: true, url: '' },
  { name: '高德地图', type: 'xyz', visible: false, url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}' }
])

// 地图控件状态
const showControls = ref({
  scale: true,
  fullscreen: true,
  mousePosition: true
})

// 绘制工具选项
const drawTypes = [
  { type: 'Point', name: '点标记', icon: '📍' },
  { type: 'LineString', name: '线段', icon: '📏' },
  { type: 'Polygon', name: '多边形', icon: '⬡' },
  { type: 'Circle', name: '圆形', icon: '⭕' },
  { type: 'Square', name: '方形', icon: '⬜' },
  { type: 'Box', name: '矩形', icon: '▭' }
]

// 预设标记点
const markers = ref([
  { name: '北京', coords: [116.4074, 39.9042], desc: '中国首都' },
  { name: '上海', coords: [121.4737, 31.2304], desc: '经济中心' },
  { name: '广州', coords: [113.2644, 23.1291], desc: '南方门户' },
  { name: '深圳', coords: [114.0579, 22.5431], desc: '科技之城' },
  { name: '成都', coords: [104.0668, 30.5728], desc: '天府之国' }
])

// 当前选择的标记点
const selectedMarker = ref(null)
// 测量结果
const measureResult = ref('')

// 切换图层
const switchLayer = (index) => {
  if (!map.value) return

  const tileLayers = map.value.getLayers().getArray().filter(l => l instanceof TileLayer)
  tileLayers.forEach((layer, i) => {
    layer.setVisible(i === index)
  })
  currentLayerIndex.value = index
}

// 添加标记点
const addMarker = (marker) => {
  const feature = new Feature({
    geometry: new Point(fromLonLat(marker.coords)),
    name: marker.name,
    desc: marker.desc
  })
  feature.setStyle(new Style({
    image: new Circle({
      radius: 10,
      fill: new Fill({ color: '#ff0000' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    })
  }))
  vectorSource.addFeature(feature)
}

// 飞到指定位置
const flyTo = (coords, zoom = 10) => {
  if (!map.value) return
  const view = map.value.getView()
  view.animate({
    center: fromLonLat(coords),
    zoom: zoom,
    duration: 1000
  })
}

// 开始绘制
const startDraw = (type) => {
  if (!map.value) return

  // 移除之前的绘制交互
  if (drawInteraction.value) {
    map.value.removeInteraction(drawInteraction.value)
  }

  if (currentDrawType.value === type) {
    // 取消绘制
    currentDrawType.value = null
    return
  }

  currentDrawType.value = type
  drawInteraction.value = new Draw({
    source: vectorSource,
    type: type
  })

  drawInteraction.value.on('drawend', (event) => {
    const geometry = event.feature.getGeometry()

    // 计算测量结果
    if (type === 'Polygon' || type === 'Circle') {
      const area = getArea(geometry, { projection: 'EPSG:3857' })
      measureResult.value = `面积: ${formatArea(area)}`
    } else if (type === 'LineString') {
      const length = getLength(geometry, { projection: 'EPSG:3857' })
      measureResult.value = `长度: ${formatLength(length)}`
    }

    setTimeout(() => {
      currentDrawType.value = null
      map.value.removeInteraction(drawInteraction.value)
    }, 100)
  })

  map.value.addInteraction(drawInteraction.value)
}

// 格式化长度
const formatLength = (length) => {
  if (length > 1000) {
    return (length / 1000).toFixed(2) + ' km'
  }
  return Math.round(length) + ' m'
}

// 格式化面积
const formatArea = (area) => {
  if (area > 10000) {
    return (area / 1000000).toFixed(2) + ' km²'
  }
  return Math.round(area) + ' m²'
}

// 清除所有绘制
const clearDrawings = () => {
  vectorSource.clear()
  measureResult.value = ''
}

// 切换选择模式
const toggleSelect = () => {
  if (!map.value) return

  if (selectInteraction.value) {
    map.value.removeInteraction(selectInteraction.value)
    selectInteraction.value = null
    return
  }

  selectInteraction.value = new Select()
  map.value.addInteraction(selectInteraction.value)
}

// 切换编辑模式
const toggleModify = () => {
  if (!map.value) return

  if (modifyInteraction.value) {
    map.value.removeInteraction(modifyInteraction.value)
    modifyInteraction.value = null
    return
  }

  modifyInteraction.value = new Modify({
    source: vectorSource
  })
  map.value.addInteraction(modifyInteraction.value)
}

// 导出 GeoJSON
const exportGeoJSON = () => {
  const format = new GeoJSON()
  const features = vectorSource.getFeatures()
  const json = format.writeFeatures(features, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  })
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'map-data.geojson'
  a.click()
  URL.revokeObjectURL(url)
}

// 获取点击坐标
const handleClick = (event) => {
  // 如果正在绘制路线，不处理点击事件
  if (isDrawingRoute.value) {
    return
  }

  const coords = event.coordinate
  const lonLat = toLonLat(coords)
  selectedMarker.value = {
    lon: lonLat[0].toFixed(4),
    lat: lonLat[1].toFixed(4)
  }
}

// ========== 路线管理功能 ==========

// 获取地图所有交互
const getAllInteractions = () => {
  return map.value.getInteractions().getArray()
}

// 禁用双击缩放
const disableDoubleClickZoom = () => {
  const interactions = getAllInteractions()
  interactions.forEach(interaction => {
    if (interaction instanceof DoubleClickZoom) {
      interaction.setActive(false)
    }
  })
}

// 启用双击缩放
const enableDoubleClickZoom = () => {
  const interactions = getAllInteractions()
  interactions.forEach(interaction => {
    if (interaction instanceof DoubleClickZoom) {
      interaction.setActive(true)
    }
  })
}

// 开始绘制路线
const startDrawRoute = () => {
  if (!map.value) {
    console.error('地图未初始化')
    return
  }

  if (isDrawingRoute.value) {
    // 取消绘制
    cancelDrawRoute()
    return
  }

  if (!currentRouteName.value || !currentRouteName.value.trim()) {
    alert('请先输入路线名称')
    return
  }

  console.log('开始绘制路线:', currentRouteName.value)
  isDrawingRoute.value = true

  // 先移除旧的绘制交互
  if (routeDrawInteraction.value) {
    map.value.removeInteraction(routeDrawInteraction.value)
    routeDrawInteraction.value = null
  }

  // 禁用双击缩放
  disableDoubleClickZoom()
  console.log('双击缩放已禁用')

  routeDrawInteraction.value = new Draw({
    source: routeSource,
    type: 'LineString'
  })

  // 添加绘制事件监听
  routeDrawInteraction.value.on('drawstart', (event) => {
    console.log('开始绘制点', event.feature)
  })

  routeDrawInteraction.value.on('drawend', (event) => {
    console.log('绘制完成')
    const geometry = event.feature.getGeometry()
    const coordinates = geometry.getCoordinates()
    const length = getLength(geometry, { projection: 'EPSG:3857' })
    console.log('坐标点数:', coordinates.length, '长度:', length)

    // 保存路线信息
    const route = {
      id: Date.now(),
      name: currentRouteName.value,
      length: formatLength(length),
      coordinates: coordinates,
      feature: event.feature
    }

    routes.value.push(route)
    console.log('路线已保存:', route)

    // 设置路线样式（带标签）
    event.feature.setStyle(new Style({
      stroke: new Stroke({
        color: '#3b82f6',
        width: 5
      }),
      text: new Text({
        text: currentRouteName.value,
        offsetY: -15,
        fill: new Fill({ color: '#3b82f6' }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
        font: 'bold 14px sans-serif'
      })
    }))

    // 重置状态并恢复交互
    currentRouteName.value = ''
    isDrawingRoute.value = false

    // 恢复双击缩放
    enableDoubleClickZoom()
    console.log('双击缩放已恢复')

    setTimeout(() => {
      if (routeDrawInteraction.value) {
        map.value.removeInteraction(routeDrawInteraction.value)
        routeDrawInteraction.value = null
      }
    }, 100)
  })

  map.value.addInteraction(routeDrawInteraction.value)
  console.log('绘制交互已添加，当前交互数量:', map.value.getInteractions().getLength())
}

// 取消绘制路线
const cancelDrawRoute = () => {
  if (routeDrawInteraction.value) {
    map.value.removeInteraction(routeDrawInteraction.value)
    routeDrawInteraction.value = null
  }
  isDrawingRoute.value = false

  // 恢复双击缩放
  enableDoubleClickZoom()
}

// 删除路线
const deleteRoute = (routeId) => {
  const route = routes.value.find(r => r.id === routeId)
  if (route) {
    routeSource.removeFeature(route.feature)
    routes.value = routes.value.filter(r => r.id !== routeId)
  }
}

// 定位到路线
const zoomToRoute = (routeId) => {
  const route = routes.value.find(r => r.id === routeId)
  if (route && route.feature) {
    const geometry = route.feature.getGeometry()
    const extent = geometry.getExtent()
    const view = map.value.getView()
    view.fit(extent, { padding: [50, 50, 50, 50], duration: 1000 })
  }
}

// 切换路线显示
const toggleRouteVisibility = (routeId) => {
  const route = routes.value.find(r => r.id === routeId)
  if (route && route.feature) {
    const currentStyle = route.feature.getStyle()
    if (currentStyle) {
      route.feature.setStyle(null)
    } else {
      route.feature.setStyle(new Style({
        stroke: new Stroke({ color: '#3b82f6', width: 4 }),
        text: new Text({
          text: route.name,
          offsetY: -15,
          fill: new Fill({ color: '#3b82f6' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
          font: 'bold 14px sans-serif'
        })
      }))
    }
  }
}

// 测试功能：硬编码添加一条路线
const testAddRoute = () => {
  console.log('测试添加路线...')

  // 创建坐标点（北京到上海）
  const coordinates = [
    fromLonLat([116.4074, 39.9042]),  // 北京
    fromLonLat([117.2000, 39.1000]),  // 天津
    fromLonLat([118.8000, 32.0000]),  // 南京
    fromLonLat([121.4737, 31.2304])   // 上海
  ]

  // 创建线段几何
  const lineString = new LineString(coordinates)

  // 创建要素
  const feature = new Feature({
    geometry: lineString,
    name: '测试路线-北京到上海'
  })

  // 设置样式
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: '#ff0000',
      width: 6
    }),
    text: new Text({
      text: '测试路线',
      offsetY: -15,
      fill: new Fill({ color: '#ff0000' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 16px sans-serif'
    })
  }))

  // 计算长度
  const length = getLength(lineString, { projection: 'EPSG:3857' })

  // 添加到路线源
  console.log('添加 feature 到 routeSource')
  routeSource.addFeature(feature)
  console.log('routeSource feature count:', routeSource.getFeatures().length)

  // 保存到路线列表
  const route = {
    id: Date.now(),
    name: '测试路线-北京到上海',
    length: formatLength(length),
    coordinates: coordinates,
    feature: feature
  }

  routes.value.push(route)
  console.log('路线已添加:', route)

  // 定位到路线
  setTimeout(() => {
    const extent = lineString.getExtent()
    const view = map.value.getView()
    view.fit(extent, { padding: [50, 50, 50, 50], duration: 1000 })
  }, 100)
}

onMounted(() => {
  // 创建图层
  const tileLayers = layers.value.map(layer => {
    let source
    if (layer.type === 'osm') {
      source = new OSM()
    } else {
      source = new XYZ({ url: layer.url })
    }
    return new TileLayer({
      source: source,
      visible: layer.visible
    })
  })

  // 创建地图
  map.value = new Map({
    target: mapContainer.value,
    layers: [...tileLayers, vectorLayer, routeLayer],
    view: new View({
      center: fromLonLat([116.4074, 39.9042]),
      zoom: 4,
      minZoom: 2,
      maxZoom: 18
    }),
    controls: defaultControls().extend([
      new ScaleLine({ units: 'metric' }),
      new FullScreen(),
      new MousePosition({
        projection: 'EPSG:4326',
        coordinateFormat: (coords) => {
          return coords.map(c => c.toFixed(4)).join(', ')
        }
      })
    ]),
    interactions: defaultInteractions()
  })

  // 添加点击事件
  map.value.on('click', handleClick)

  // 添加默认标记点
  markers.value.forEach(marker => addMarker(marker))
})

onUnmounted(() => {
  if (map.value) {
    map.value.setTarget(null)
    map.value = null
  }
})
</script>

<template>
  <div class="gis-container">
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="panel-section">
        <h3>🗺️ 地图图层</h3>
        <div class="layer-buttons">
          <button
            v-for="(layer, index) in layers"
            :key="index"
            :class="{ active: currentLayerIndex === index }"
            @click="switchLayer(index)"
          >
            {{ layer.name }}
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3>📍 快速定位</h3>
        <div class="marker-list">
          <button
            v-for="(marker, index) in markers"
            :key="index"
            @click="flyTo(marker.coords, 10)"
          >
            {{ marker.name }}
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3>✏️ 绘制工具</h3>
        <div class="draw-tools">
          <button
            v-for="tool in drawTypes"
            :key="tool.type"
            :class="{ active: currentDrawType === tool.type }"
            @click="startDraw(tool.type)"
            :title="tool.name"
          >
            {{ tool.icon }}
          </button>
        </div>
        <div class="action-buttons">
          <button @click="toggleModify" title="编辑">🔧</button>
          <button @click="toggleSelect" title="选择">👆</button>
          <button @click="clearDrawings" title="清除">🗑️</button>
          <button @click="exportGeoJSON" title="导出">📥</button>
        </div>
        <div v-if="measureResult" class="measure-result">
          {{ measureResult }}
        </div>
      </div>

      <div class="panel-section">
        <h3>🛣️ 路线管理</h3>
        <div class="route-input">
          <input
            v-model="currentRouteName"
            type="text"
            placeholder="输入路线名称"
            :disabled="isDrawingRoute"
          />
          <button
            @click="startDrawRoute"
            :class="{ active: isDrawingRoute }"
          >
            {{ isDrawingRoute ? '取消绘制' : '开始绘制' }}
          </button>
        </div>
        <div v-if="isDrawingRoute" class="drawing-hint">
          💡 单击添加点，最后一点双击完成绘制
        </div>
        <button @click="testAddRoute" class="test-button">
          🧪 测试：添加预设路线
        </button>
        <div v-if="routes.length > 0" class="route-list">
          <div
            v-for="route in routes"
            :key="route.id"
            class="route-item"
          >
            <div class="route-info">
              <span class="route-name">{{ route.name }}</span>
              <span class="route-length">{{ route.length }}</span>
            </div>
            <div class="route-actions">
              <button @click="zoomToRoute(route.id)" title="定位">🎯</button>
              <button @click="toggleRouteVisibility(route.id)" title="显示/隐藏">👁️</button>
              <button @click="deleteRoute(route.id)" title="删除">🗑️</button>
            </div>
          </div>
        </div>
        <p v-else class="hint">暂无路线，请先绘制</p>
      </div>

      <div class="panel-section">
        <h3>📍 当前位置</h3>
        <div v-if="selectedMarker" class="current-position">
          <p>经度: {{ selectedMarker.lon }}</p>
          <p>纬度: {{ selectedMarker.lat }}</p>
        </div>
        <p v-else class="hint">点击地图获取坐标</p>
      </div>
    </div>

    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container" :class="{ drawing: isDrawingRoute }"></div>
  </div>
</template>

<style scoped>
.gis-container {
  display: flex;
  height: 100vh;
  background: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 控制面板 */
.control-panel {
  width: 280px;
  min-width: 280px;
  background: #252525;
  padding: 16px;
  overflow-y: auto;
  border-right: 1px solid #333;
}

.control-panel::-webkit-scrollbar {
  width: 6px;
}

.control-panel::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.panel-section {
  background: #333;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.panel-section h3 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 图层按钮 */
.layer-buttons {
  display: grid;
  gap: 6px;
}

.layer-buttons button {
  background: #444;
  border: 1px solid transparent;
  color: #ccc;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.layer-buttons button:hover {
  background: #505050;
}

.layer-buttons button.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: white;
}

/* 标记列表 */
.marker-list {
  display: grid;
  gap: 6px;
}

.marker-list button {
  background: #444;
  border: 1px solid transparent;
  color: #ccc;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  transition: all 0.2s;
}

.marker-list button:hover {
  background: #505050;
  border-color: #60a5fa;
}

/* 绘制工具 */
.draw-tools {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.draw-tools button {
  aspect-ratio: 1;
  background: #444;
  border: 1px solid transparent;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.draw-tools button:hover {
  background: #505050;
}

.draw-tools button.active {
  background: #10b981;
  border-color: #34d399;
}

.action-buttons {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.action-buttons button {
  flex: 1;
  background: #444;
  border: 1px solid transparent;
  color: #fff;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-buttons button:hover {
  background: #505050;
}

.measure-result {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
}

/* 当前位置 */
.current-position {
  background: #444;
  border-radius: 6px;
  padding: 10px;
}

.current-position p {
  margin: 4px 0;
  font-size: 12px;
  color: #e0e0e0;
}

.current-position p:first-child {
  color: #3b82f6;
}

.hint {
  font-size: 11px;
  color: #888;
  text-align: center;
}

/* 地图容器 */
.map-container {
  flex: 1;
  background: #1a1a1a;
}

.map-container :deep(.ol-control) {
  background: rgba(0, 0, 0, 0.7);
}

.map-container :deep(.ol-control button) {
  background: transparent;
  color: #fff;
}

.map-container :deep(.ol-scale-line) {
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.map-container :deep(.ol-scale-line-text) {
  color: #fff;
  font-size: 10px;
}

.map-container :deep(.ol-mouse-position) {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  top: 8px;
  right: 8px;
}

/* 路线管理 */
.route-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.route-input input {
  flex: 1;
  padding: 8px 10px;
  background: #444;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
}

.route-input input:disabled {
  opacity: 0.5;
}

.route-input button {
  padding: 8px 14px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.route-input button.active {
  background: #ef4444;
}

.test-button {
  width: 100%;
  padding: 8px 14px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 12px;
}

.test-button:hover {
  background: #fbbf24;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.route-list::-webkit-scrollbar {
  width: 4px;
}

.route-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.route-item {
  background: #444;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.route-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.route-length {
  font-size: 11px;
  color: #888;
}

.route-actions {
  display: flex;
  gap: 4px;
}

.route-actions button {
  width: 28px;
  height: 28px;
  background: #555;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.route-actions button:hover {
  background: #666;
}

/* 绘制提示 */
.drawing-hint {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid #3b82f6;
  color: #60a5fa;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  margin-bottom: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 绘制状态下的地图光标 */
.map-container.drawing :deep(.ol-unselectable) {
  cursor: crosshair !important;
}

.map-container.drawing {
  cursor: crosshair;
}
</style>
