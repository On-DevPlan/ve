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
import { defaults as defaultInteractions } from 'ol/interaction'
import Draw from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Snap from 'ol/interaction/Snap'
import Select from 'ol/interaction/Select'
import { Style, Fill, Stroke, Circle } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
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
  const coords = event.coordinate
  const lonLat = toLonLat(coords)
  selectedMarker.value = {
    lon: lonLat[0].toFixed(4),
    lat: lonLat[1].toFixed(4)
  }
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
    layers: [...tileLayers, vectorLayer],
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
        <h3>📍 当前位置</h3>
        <div v-if="selectedMarker" class="current-position">
          <p>经度: {{ selectedMarker.lon }}</p>
          <p>纬度: {{ selectedMarker.lat }}</p>
        </div>
        <p v-else class="hint">点击地图获取坐标</p>
      </div>
    </div>

    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>
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
</style>
