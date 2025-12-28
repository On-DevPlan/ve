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
import { ScaleLine, FullScreen } from 'ol/control'
import { defaults as defaultInteractions } from 'ol/interaction'
import { Style, Fill, Stroke, Circle, Text } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { getLength } from 'ol/sphere'
import Overlay from 'ol/Overlay'
import UserControlPanel from './UserControlPanel.vue'
import PointDetail from './PointDetail.vue'
import { getPresetData, importFromJson } from './StorageManager.js'

// 地图容器
const mapContainer = ref(null)
const map = shallowRef(null)
const currentLayerIndex = ref(0)

// 矢量源和图层
const vectorSource = new VectorSource()
const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: new Style({
    image: new Circle({
      radius: 10,
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 })
    })
  })
})

// 路线专用矢量源和图层
const routeSource = new VectorSource()
const routeLayer = new VectorLayer({
  source: routeSource,
  style: new Style({
    stroke: new Stroke({
      color: '#77a4ff',
      width: 4,
      lineDash: [10, 5]
    })
  }),
  zIndex: 100
})

// 记录点数据
const recordPoints = ref([])
const routes = ref([])

// 点详情
const showPointDetail = ref(false)
const viewingPoint = ref(null)

// 悬停的点
const hoveredPointId = ref(null)

// 动画相关
const carOverlay = ref(null)
const animationProgress = ref(0)
const animationId = ref(null)

// 图片预览
const previewImage = ref(null)
const previewPosition = ref({ x: 0, y: 0 })

// 地图点悬浮图片预览
const pointImageOverlay = ref(null)
const carImageUrl = '/map/333.gif'

// 动画路线源（显示已走过的部分）
const animationRouteSource = new VectorSource()
const animationRouteLayer = new VectorLayer({
  source: animationRouteSource,
  style: new Style({
    stroke: new Stroke({
      color: '#4da4ff',
      width: 6
    })
  }),
  zIndex: 101
})

// 图层配置
const layers = ref([
  { name: 'OpenStreetMap', type: 'osm', visible: true, url: '' },
  { name: '高德地图', type: 'xyz', visible: false, url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}' }
])

// 切换图层
const switchLayer = (index) => {
  if (!map.value) return
  const tileLayers = map.value.getLayers().getArray().filter(l => l instanceof TileLayer)
  tileLayers.forEach((layer, i) => {
    layer.setVisible(i === index)
  })
  currentLayerIndex.value = index
}

// 创建地图要素
const createPointFeature = (point) => {
  const feature = new Feature({
    geometry: new Point(fromLonLat([point.lon, point.lat])),
    ...point
  })
  feature.setId(point.id)
  updatePointStyle(feature, false)
  return feature
}

// 更新点样式
const updatePointStyle = (feature, isHovered) => {
  feature.setStyle(getPointStyle(feature, isHovered))
}

// 刷新地图上的点
const refreshMapPoints = () => {
  vectorSource.clear()
  recordPoints.value.forEach(point => {
    vectorSource.addFeature(createPointFeature(point))
  })
}

// 定位到点
const flyToPoint = (point) => {
  if (!map.value) return
  const view = map.value.getView()
  view.animate({
    center: fromLonLat([point.lon, point.lat]),
    zoom: 14,
    duration: 1000
  })
}

// 点击地图处理
const handleClick = (event) => {
  const coords = event.coordinate

  // 检查是否点击了已有的要素
  const feature = map.value.forEachFeatureAtPixel(event.pixel, (feature) => {
    return feature
  }, { hitTolerance: 10 })

  if (feature) {
    const props = feature.getProperties()

    // 检查是否是路线转折点
    if (props.isRoutePoint) {
      let targetRoute = null
      let pointIndex = props.routePointIndex

      // 查找已保存的路线
      for (const route of routes.value) {
        if (route.points && route.points[pointIndex]) {
          targetRoute = route
          break
        }
      }

      if (targetRoute) {
        const routePoint = targetRoute.points[pointIndex]
        handleViewPoint(routePoint)
      }
      return
    }

    // 检查是否是普通记录点
    if (feature.getId()) {
      const point = recordPoints.value.find(p => p.id === feature.getId())
      if (point) {
        handleViewPoint(point)
        return
      }
    }
  }

  // 用户模式下点击空白区域不做任何操作
}

// 处理鼠标移动（hover 效果）
const handlePointerMove = (event) => {
  const feature = map.value.forEachFeatureAtPixel(event.pixel, (feature) => {
    return feature
  }, { hitTolerance: 10 })

  // 重置之前 hover 的点
  if (hoveredPointId.value && (!feature || feature.getId() !== hoveredPointId.value)) {
    const prevFeature = vectorSource.getFeatureById(hoveredPointId.value)
    if (prevFeature) {
      const props = prevFeature.getProperties()
      if (props.isRoutePoint) {
        prevFeature.setStyle(getRoutePointStyle())
      } else {
        updatePointStyle(prevFeature, false)
      }
    }
    hoveredPointId.value = null
    mapContainer.value.style.cursor = 'default'

    // 隐藏点图片预览
    if (pointImageOverlay.value) {
      pointImageOverlay.value.setPosition(undefined)
    }
  }

  // 设置当前 hover 的点
  if (feature && feature.getId()) {
    if (hoveredPointId.value !== feature.getId()) {
      const props = feature.getProperties()
      if (props.isRoutePoint) {
        feature.setStyle(getRoutePointHoverStyle(feature))

        // 查找路线转折点的图片
        if (props.images && props.images.length > 0) {
          showPointImagePreview(event.coordinate, props.images[0])
        } else {
          for (const route of routes.value) {
            if (route.points) {
              const routePoint = route.points.find(p => p.id === feature.getId())
              if (routePoint && routePoint.images && routePoint.images.length > 0) {
                showPointImagePreview(event.coordinate, routePoint.images[0])
                break
              }
            }
          }
        }
      } else {
        updatePointStyle(feature, true)

        // 显示普通记录点的图片预览
        const point = recordPoints.value.find(p => p.id === feature.getId())
        if (point && point.images && point.images.length > 0) {
          showPointImagePreview(event.coordinate, point.images[0])
        }
      }
      hoveredPointId.value = feature.getId()
      mapContainer.value.style.cursor = 'pointer'
    }
  }
}

// 显示点的图片预览
const showPointImagePreview = (coordinate, imageUrl) => {
  if (!pointImageOverlay.value) {
    const imageElement = document.createElement('div')
    imageElement.className = 'point-image-preview'
    imageElement.innerHTML = `<img src="${imageUrl}" alt="预览" />`

    pointImageOverlay.value = new Overlay({
      element: imageElement,
      positioning: 'bottom-left',
      offset: [15, -15],
      stopEvent: false
    })

    map.value.addOverlay(pointImageOverlay.value)
  } else {
    const element = pointImageOverlay.value.getElement()
    element.innerHTML = `<img src="${imageUrl}" alt="预览" />`
  }

  pointImageOverlay.value.setPosition(coordinate)
}

// 图片预览处理
const handleImagePreview = (imageUrl, event) => {
  previewImage.value = imageUrl
  const rect = event.target.getBoundingClientRect()
  previewPosition.value = {
    x: rect.right + 10,
    y: rect.top
  }
}

const closeImagePreview = () => {
  previewImage.value = null
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

// 播放路线动画
const playRouteAnimation = (routeId) => {
  const route = routes.value.find(r => r.id === routeId)
  if (!route || !map.value) return

  // 停止之前的动画
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }

  // 清空动画路线
  animationRouteSource.clear()

  // 隐藏原始路线
  route.feature.setStyle(undefined)

  // 创建小车 overlay
  if (!carOverlay.value) {
    const carElement = document.createElement('div')
    carElement.className = 'car-marker'
    carElement.innerHTML = `<img src="${carImageUrl}" alt="car" />`

    carOverlay.value = new Overlay({
      element: carElement,
      positioning: 'center-center',
      stopEvent: false,
      offset: [0, 0]
    })

    map.value.addOverlay(carOverlay.value)
  }

  // 从 points 计算路线坐标
  const coordinates = route.points ? route.points.map(p => fromLonLat([p.lon, p.lat])) : []
  if (coordinates.length < 2) return

  // 固定10秒完成整条路线
  const duration = 10000

  const startTime = Date.now()
  animationProgress.value = 0

  let animatedRouteFeature = null

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    animationProgress.value = progress

    // 计算当前位置
    const totalSegments = coordinates.length - 1
    const currentSegment = Math.min(Math.floor(progress * totalSegments), totalSegments - 1)
    const segmentProgress = (progress * totalSegments) - currentSegment

    const startCoord = coordinates[currentSegment]
    const endCoord = coordinates[currentSegment + 1]

    // 线性插值
    const x = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress
    const y = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress

    // 计算方向角度（弧度）
    const dx = endCoord[0] - startCoord[0]
    const dy = endCoord[1] - startCoord[1]
    const angleRad = Math.atan2(dy, dx)

    let angle = -angleRad
    let needsFlip = false

    if (dx < 0) {
      angle = angle - Math.PI
      needsFlip = true
    }

    // 更新小车位置和旋转
    carOverlay.value.setPosition([x, y])
    const carElement = carOverlay.value.getElement()
    if (carElement) {
      const angleDeg = angle * 180 / Math.PI
      carElement.style.transform = `rotate(${angleDeg}deg) scaleX(${needsFlip ? -1 : 1})`
    }

    // 计算已走过的路线坐标
    const walkedCoords = []
    for (let i = 0; i < currentSegment; i++) {
      walkedCoords.push(coordinates[i])
    }
    walkedCoords.push(startCoord)
    walkedCoords.push([x, y])

    // 移除旧的动态路线
    if (animatedRouteFeature) {
      animationRouteSource.removeFeature(animatedRouteFeature)
    }

    // 绘制已走过的路线（实线）
    if (walkedCoords.length >= 2) {
      animatedRouteFeature = new Feature({
        geometry: new LineString(walkedCoords)
      })

      animatedRouteFeature.setStyle(new Style({
        stroke: new Stroke({
          color: '#4da4ff',
          width: 6
        })
      }))

      animationRouteSource.addFeature(animatedRouteFeature)
    }

    if (progress < 1) {
      animationId.value = requestAnimationFrame(animate)
    } else {
      // 动画结束，隐藏小车
      setTimeout(() => {
        if (carOverlay.value) {
          carOverlay.value.setPosition(undefined)
        }
        setTimeout(() => {
          animationRouteSource.clear()
          // 恢复原始路线的实线样式
          route.feature.setStyle(new Style({
            stroke: new Stroke({
              color: '#4da4ff',
              width: 5
            })
          }))
        }, 2000)
      }, 500)
    }
  }

  animate()
}

// 导入数据处理
const handleImportData = (data) => {
  // 清除现有数据
  vectorSource.clear()
  routeSource.clear()

  // 更新记录点
  recordPoints.value = data.points || []

  // 刷新地图上的点
  refreshMapPoints()

  // 处理路线数据
  routes.value = (data.routes || []).map(route => {
    const coordinates = route.points ? route.points.map(p => fromLonLat([p.lon, p.lat])) : []
    const lineString = new LineString(coordinates)
    const feature = new Feature({
      geometry: lineString
    })

    feature.setStyle(new Style({
      stroke: new Stroke({
        color: '#4da4ff',
        width: 5
      }),
      text: new Text({
        text: route.name || route.title || '',
        offsetY: -15,
        fill: new Fill({ color: '#4da4ff' }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
        font: 'bold 14px sans-serif'
      })
    }))

    routeSource.addFeature(feature)

    return {
      ...route,
      feature: feature
    }
  })

  // 如果有路线转折点，也添加到地图上
  routes.value.forEach(route => {
    if (route.points) {
      route.points.forEach((point, index) => {
        const pointFeature = new Feature({
          geometry: new Point(fromLonLat([point.lon, point.lat])),
          ...point,
          isRoutePoint: true,
          routePointIndex: index
        })
        pointFeature.setId(point.id)
        pointFeature.setStyle(getRoutePointStyle())
        vectorSource.addFeature(pointFeature)
      })
    }
  })
}

// 加载预设数据
const handleLoadPresetData = async (presetData) => {
  const imported = importFromJson(presetData)
  handleImportData(imported)
}

// 切换路线可见性
const handleToggleRouteVisibility = (visible) => {
  if (!map.value) return
  const layers = map.value.getLayers().getArray()
  layers.forEach(layer => {
    if (layer === routeLayer) {
      layer.setVisible(visible)
    }
  })
}

// 查看点详情
const handleViewPoint = (point) => {
  viewingPoint.value = { ...point }
  showPointDetail.value = true
}

// 获取普通记录点样式
const getPointStyle = (feature, isHovered) => {
  const point = feature.getProperties()
  const radius = isHovered ? 16 : 12
  const strokeWidth = isHovered ? 4 : 3

  return new Style({
    image: new Circle({
      radius: radius,
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: strokeWidth })
    }),
    text: new Text({
      text: point.title || '',
      offsetY: -(radius + 8),
      fill: new Fill({ color: '#4da4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 13px sans-serif'
    })
  })
}

// 获取路线转折点样式
const getRoutePointStyle = () => {
  return new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    })
  })
}

// 获取路线转折点悬停样式
const getRoutePointHoverStyle = (feature) => {
  const props = feature.getProperties()
  return new Style({
    image: new Circle({
      radius: 12,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 })
    }),
    text: new Text({
      text: props.title || '',
      offsetY: -18,
      fill: new Fill({ color: '#77a4ff' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 12px sans-serif'
    })
  })
}

// 初始化地图
onMounted(() => {
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

  map.value = new Map({
    target: mapContainer.value,
    layers: [...tileLayers, vectorLayer, routeLayer, animationRouteLayer],
    view: new View({
      center: fromLonLat([116.4074, 39.9042]),
      zoom: 4,
      minZoom: 2,
      maxZoom: 18
    }),
    controls: defaultControls().extend([
      new ScaleLine({ units: 'metric' }),
      new FullScreen()
    ]),
    interactions: defaultInteractions()
  })

  map.value.on('click', handleClick)
  map.value.on('pointermove', handlePointerMove)
})

onUnmounted(() => {
  // 清理动画
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }

  // 清理点图片预览 overlay
  if (pointImageOverlay.value && map.value) {
    map.value.removeOverlay(pointImageOverlay.value)
    pointImageOverlay.value = null
  }

  if (map.value) {
    map.value.setTarget(null)
    map.value = null
  }
})
</script>

<template>
  <div class="gis-user-container">
    <!-- 左侧控制面板 -->
    <UserControlPanel
      :routes="routes"
      @view-point="handleViewPoint"
      @play-route-animation="playRouteAnimation"
      @zoom-to-route="zoomToRoute"
      @toggle-route-visibility="handleToggleRouteVisibility"
      @load-preset-data="handleLoadPresetData"
    />

    <!-- 地图容器 -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-container"></div>
    </div>

    <!-- 用户详情弹窗 -->
    <PointDetail
      :show="showPointDetail"
      :point="viewingPoint"
      @close="showPointDetail = false"
      @view-image="handleImagePreview"
    />

    <!-- 图片预览 -->
    <Transition name="preview-fade">
      <div
        v-if="previewImage"
        class="image-preview-overlay"
        :style="{ left: previewPosition.x + 'px', top: previewPosition.y + 'px' }"
        @mouseenter="closeImagePreview"
      >
        <img :src="previewImage" alt="预览图片" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.gis-user-container {
  display: flex;
  height: 100vh;
  background: #f0f4ff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.map-wrapper {
  flex: 1;
  position: relative;
  background: #f0f4ff;
  border-left: 2px solid #4da4ff;
}

.map-container {
  width: 100%;
  height: 100%;
}

.map-container :deep(.ol-control) {
  background: rgba(255, 255, 255, 0.9);
}

.map-container :deep(.ol-control button) {
  color: #4da4ff;
}

.map-container :deep(.ol-scale-line) {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dbeafe;
}

.map-container :deep(.ol-scale-line-text) {
  color: #6b7280;
  font-size: 10px;
}

.car-marker {
  width: 40px;
  height: 40px;
  transition: transform 0.1s linear;
}

.car-marker img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 地图点图片预览 */
.map-container :deep(.point-image-preview) {
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.map-container :deep(.point-image-preview img) {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

/* 图片预览 */
.image-preview-overlay {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  max-height: 400px;
  overflow: hidden;
}

.image-preview-overlay img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
  display: block;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
