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
import { defaults as defaultInteractions, DoubleClickZoom } from 'ol/interaction'
import { Style, Fill, Stroke, Circle, Text } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { getLength } from 'ol/sphere'
import Overlay from 'ol/Overlay'
import Select from 'ol/interaction/Select'
import PointEditor from './PointEditor.vue'
import PointList from './PointList.vue'

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
      fill: new Fill({ color: '#ec4899' }),
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
      color: '#f472b6',
      width: 4,
      lineDash: [10, 5]
    })
  }),
  zIndex: 100
})

// 记录点数据
const recordPoints = ref([])
const routes = ref([])
const isDrawingRoute = ref(false)
const tempRoutePoints = ref([])  // 存储转折点对象 { coordinate, feature, data }
const tempRouteFeature = ref(null)

// 编辑器状态
const showEditor = ref(false)
const editingPoint = ref(null)
const editorMode = ref('create') // 'create' | 'edit' | 'view' | 'route' | 'route-point'
const editingRoute = ref(null)
const editingRoutePointIndex = ref(null)  // 正在编辑的路线转折点索引

// 悬停的点
const hoveredPointId = ref(null)

// Select 交互
const selectInteraction = ref(null)

// 动画相关
const carOverlay = ref(null)  // 小车 overlay
const animationProgress = ref(0)  // 动画进度 0-1
const animationId = ref(null)  // 动画帧 ID

// 图片预览
const previewImage = ref(null)  // 当前预览的图片 URL
const previewPosition = ref({ x: 0, y: 0 })  // 预览位置

// 地图点悬浮图片预览
const pointImageOverlay = ref(null)  // 点的图片预览 overlay
const carImageUrl = '/map/right.gif'  // 小车图片（只用一张）
const animationRouteSource = new VectorSource()  // 动画路线源（显示已走过的部分）
const animationRouteLayer = new VectorLayer({
  source: animationRouteSource,
  style: new Style({
    stroke: new Stroke({
      color: '#ec4899',
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
  const point = feature.getProperties()
  const radius = isHovered ? 16 : 12
  const strokeWidth = isHovered ? 4 : 3

  feature.setStyle(new Style({
    image: new Circle({
      radius: radius,
      fill: new Fill({ color: '#ec4899' }),
      stroke: new Stroke({ color: '#fff', width: strokeWidth })
    }),
    text: new Text({
      text: point.title || '',
      offsetY: -(radius + 8),
      fill: new Fill({ color: '#ec4899' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 13px sans-serif'
    })
  }))
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
  const lonLat = toLonLat(coords)

  // 如果正在绘制路线，添加转折点
  if (isDrawingRoute.value) {
    const pointId = `route-point-${Date.now()}-${tempRoutePoints.value.length}`

    // 创建转折点对象
    const routePoint = {
      coordinate: coords,
      data: {
        id: pointId,
        lon: lonLat[0],
        lat: lonLat[1],
        title: '',
        description: '',
        images: []
      }
    }

    // 创建转折点 Feature
    const pointFeature = new Feature({
      geometry: new Point(coords),
      ...routePoint.data,
      isRoutePoint: true,
      routePointIndex: tempRoutePoints.value.length
    })
    pointFeature.setId(pointId)
    pointFeature.setStyle(new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: '#f472b6' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }))

    routePoint.feature = pointFeature
    tempRoutePoints.value.push(routePoint)
    vectorSource.addFeature(pointFeature)

    // 更新路线
    if (tempRoutePoints.value.length > 1) {
      if (tempRouteFeature.value) {
        routeSource.removeFeature(tempRouteFeature.value)
      }

      const coordinates = tempRoutePoints.value.map(p => p.coordinate)
      const lineString = new LineString(coordinates)
      tempRouteFeature.value = new Feature({
        geometry: lineString
      })
      tempRouteFeature.value.setStyle(new Style({
        stroke: new Stroke({
          color: '#f472b6',
          width: 4,
          lineDash: [10, 5]
        })
      }))
      routeSource.addFeature(tempRouteFeature.value)
    }

    return
  }

  // 检查是否点击了已有的要素
  const feature = map.value.forEachFeatureAtPixel(event.pixel, (feature) => {
    return feature
  }, { hitTolerance: 10 })

  if (feature) {
    const props = feature.getProperties()

    // 检查是否是路线转折点
    if (props.isRoutePoint) {
      // 找到对应的路线
      let targetRoute = null
      let pointIndex = props.routePointIndex

      // 检查是否是正在绘制的临时路线
      if (isDrawingRoute.value) {
        editingPoint.value = { ...tempRoutePoints.value[pointIndex].data }
        editingRoutePointIndex.value = pointIndex
        editorMode.value = 'route-point'
        showEditor.value = true
      } else {
        // 查找已保存的路线
        for (const route of routes.value) {
          if (route.points && route.points[pointIndex]) {
            targetRoute = route
            break
          }
        }

        if (targetRoute) {
          editingRoute.value = targetRoute
          editingPoint.value = { ...targetRoute.points[pointIndex] }
          editingRoutePointIndex.value = pointIndex
          editorMode.value = 'route-point'
          showEditor.value = true
        }
      }
      return
    }

    // 检查是否是普通记录点
    if (feature.getId()) {
      const point = recordPoints.value.find(p => p.id === feature.getId())
      if (point) {
        editingPoint.value = { ...point }
        editorMode.value = 'view'
        showEditor.value = true
        return
      }
    }
  }

  // 点击空白区域：添加新记录点
  editingPoint.value = {
    lon: lonLat[0],
    lat: lonLat[1],
    time: new Date().toLocaleString('zh-CN')
  }
  editorMode.value = 'create'
  showEditor.value = true
}

// 处理鼠标移动（hover 效果）
const handlePointerMove = (event) => {
  if (isDrawingRoute.value) return

  const feature = map.value.forEachFeatureAtPixel(event.pixel, (feature) => {
    return feature
  }, { hitTolerance: 10 })

  // 重置之前 hover 的点
  if (hoveredPointId.value && (!feature || feature.getId() !== hoveredPointId.value)) {
    const prevFeature = vectorSource.getFeatureById(hoveredPointId.value)
    if (prevFeature) {
      const props = prevFeature.getProperties()
      if (props.isRoutePoint) {
        // 恢复路线转折点样式
        prevFeature.setStyle(new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#f472b6' }),
            stroke: new Stroke({ color: '#fff', width: 2 })
          })
        }))
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
        // 路线转折点 hover 效果
        feature.setStyle(new Style({
          image: new Circle({
            radius: 12,
            fill: new Fill({ color: '#f472b6' }),
            stroke: new Stroke({ color: '#fff', width: 3 })
          }),
          text: new Text({
            text: props.title || '',
            offsetY: -18,
            fill: new Fill({ color: '#f472b6' }),
            stroke: new Stroke({ color: '#fff', width: 3 }),
            font: 'bold 12px sans-serif'
          })
        }))

        // 查找路线转折点的图片
        if (props.images && props.images.length > 0) {
          showPointImagePreview(event.coordinate, props.images[0])
        } else {
          // 从路线的 points 数组中查找
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

// 保存记录点
const handleSavePoint = (data) => {
  if (editorMode.value === 'route') {
    // 保存路线信息
    if (editingRoute.value) {
      editingRoute.value.name = data.title
      editingRoute.value.title = data.title
      editingRoute.value.description = data.description
      editingRoute.value.images = data.images

      // 更新路线样式
      editingRoute.value.feature.setStyle(new Style({
        stroke: new Stroke({
          color: '#ec4899',
          width: 5
        }),
        text: new Text({
          text: data.title,
          offsetY: -15,
          fill: new Fill({ color: '#ec4899' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
          font: 'bold 14px sans-serif'
        })
      }))
    }
  } else if (editorMode.value === 'route-point') {
    // 保存路线转折点信息
    if (editingRoute.value && editingRoutePointIndex.value !== null) {
      const pointIndex = editingRoutePointIndex.value
      editingRoute.value.points[pointIndex] = {
        ...editingRoute.value.points[pointIndex],
        ...data
      }

      // 更新转折点样式显示标题
      const feature = vectorSource.getFeatureById(editingRoute.value.points[pointIndex].id)
      if (feature) {
        feature.set('title', data.title)
      }
    }
  } else {
    // 保存普通记录点
    const point = {
      id: editingPoint.value?.id || Date.now(),
      lon: editingPoint.value.lon,
      lat: editingPoint.value.lat,
      time: editingPoint.value.time,
      ...data
    }

    const existingIndex = recordPoints.value.findIndex(p => p.id === point.id)
    if (existingIndex >= 0) {
      recordPoints.value[existingIndex] = point
    } else {
      recordPoints.value.push(point)
    }

    refreshMapPoints()
  }

  showEditor.value = false
  editingPoint.value = null
  editingRoute.value = null
  editingRoutePointIndex.value = null
  editorMode.value = 'create'
}

// 编辑记录点
const handleEditPoint = (point) => {
  editingPoint.value = { ...point }
  showEditor.value = true
}

// 删除记录点
const handleDeletePoint = (pointId) => {
  recordPoints.value = recordPoints.value.filter(p => p.id !== pointId)
  refreshMapPoints()
}

// 路线管理功能
const getAllInteractions = () => {
  return map.value.getInteractions().getArray()
}

const disableDoubleClickZoom = () => {
  const interactions = getAllInteractions()
  interactions.forEach(interaction => {
    if (interaction instanceof DoubleClickZoom) {
      interaction.setActive(false)
    }
  })
}

const enableDoubleClickZoom = () => {
  const interactions = getAllInteractions()
  interactions.forEach(interaction => {
    if (interaction instanceof DoubleClickZoom) {
      interaction.setActive(true)
    }
  })
}

const formatLength = (length) => {
  if (length > 1000) {
    return (length / 1000).toFixed(2) + ' km'
  }
  return Math.round(length) + ' m'
}

const startDrawRoute = () => {
  if (isDrawingRoute.value) {
    finishRoute()
    return
  }

  isDrawingRoute.value = true
  tempRoutePoints.value = []
  tempRouteFeature.value = null
  disableDoubleClickZoom()
}

const finishRoute = () => {
  if (tempRoutePoints.value.length < 2) {
    alert('至少需要2个点才能创建路线')
    return
  }

  if (tempRouteFeature.value) {
    routeSource.removeFeature(tempRouteFeature.value)
  }

  // 提取坐标和转折点数据
  const coordinates = tempRoutePoints.value.map(p => p.coordinate)
  const points = tempRoutePoints.value.map(p => p.data)

  const lineString = new LineString(coordinates)
  const length = getLength(lineString, { projection: 'EPSG:3857' })

  const feature = new Feature({
    geometry: lineString
  })

  feature.setStyle(new Style({
    stroke: new Stroke({
      color: '#f472b6',
      width: 4,
      lineDash: [10, 5]
    })
  }))

  routeSource.addFeature(feature)

  const route = {
    id: Date.now(),
    name: '',
    title: '',
    description: '',
    images: [],
    length: formatLength(length),
    coordinates: coordinates,
    points: points,
    feature: feature,
    time: new Date().toLocaleString('zh-CN')
  }

  routes.value.push(route)

  // 打开编辑器添加路线信息
  editingRoute.value = route
  editingPoint.value = {
    title: '',
    description: '',
    images: []
  }
  editorMode.value = 'route'
  showEditor.value = true

  isDrawingRoute.value = false
  tempRoutePoints.value = []
  tempRouteFeature.value = null
  enableDoubleClickZoom()
}

const cancelDrawRoute = () => {
  // 清除转折点
  tempRoutePoints.value.forEach(p => {
    if (p.feature) {
      vectorSource.removeFeature(p.feature)
    }
  })

  if (tempRouteFeature.value) {
    routeSource.removeFeature(tempRouteFeature.value)
  }

  isDrawingRoute.value = false
  tempRoutePoints.value = []
  tempRouteFeature.value = null
  enableDoubleClickZoom()
  refreshMapPoints()
}

// 图片预览处理
const handleImagePreview = (imageUrl, event) => {
  previewImage.value = imageUrl
  // 计算预览位置（鼠标右下方）
  const rect = event.target.getBoundingClientRect()
  previewPosition.value = {
    x: rect.right + 10,
    y: rect.top
  }
}

const closeImagePreview = () => {
  previewImage.value = null
}

const deleteRoute = (routeId) => {
  const route = routes.value.find(r => r.id === routeId)
  if (route) {
    // 清除转折点
    if (route.points) {
      route.points.forEach(point => {
        const feature = vectorSource.getFeatureById(point.id)
        if (feature) {
          vectorSource.removeFeature(feature)
        }
      })
    }

    routeSource.removeFeature(route.feature)
    routes.value = routes.value.filter(r => r.id !== routeId)
  }
}

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

  // 获取路线坐标
  const coordinates = route.coordinates
  if (!coordinates || coordinates.length < 2) return

  // 固定10秒完成整条路线
  const duration = 10000 // 固定10秒

  const startTime = Date.now()
  animationProgress.value = 0

  let animatedRouteFeature = null  // 动态路线 Feature（已走过的部分）

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
          color: '#ec4899',
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
        // 保留完整路线一段时间后清除动画路线层
        setTimeout(() => {
          animationRouteSource.clear()
          // 恢复原始路线的实线样式
          route.feature.setStyle(new Style({
            stroke: new Stroke({
              color: '#ec4899',
              width: 5
            })
          }))
        }, 2000)
      }, 500)
    }
  }

  animate()
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
  <div class="gis-container">
    <!-- 左侧面板 -->
    <div class="side-panel">

      
      <!-- 记录点列表 -->
      <PointList
        :points="recordPoints"
        @edit="handleEditPoint"
        @delete="handleDeletePoint"
        @select="flyToPoint"
        @preview="handleImagePreview"
      />

      <!-- 路线管理 -->
      <div class="panel-section">
        <h3>🛣️ 我的路线</h3>

        <div v-if="!isDrawingRoute" class="route-input">
          <button @click="startDrawRoute" class="btn-primary full-width">
            ✏️ 开始绘制路线
          </button>
        </div>

        <div v-else class="drawing-actions">
          <button @click="finishRoute" class="btn-success">
            ✓ 完成绘制
          </button>
          <button @click="cancelDrawRoute" class="btn-cancel">
            ✕ 取消
          </button>
        </div>

        <div v-if="isDrawingRoute" class="drawing-hint">
          💡 已添加 {{ tempRoutePoints.length }} 个点
        </div>

        <div v-if="routes.length > 0" class="route-list">
          <div
            v-for="route in routes"
            :key="route.id"
            class="route-item"
          >
            <div class="route-info">
              <span class="route-name">{{ route.name || route.title || '未命名路线' }}</span>
              <span class="route-length">{{ route.length }}</span>
            </div>
            <div class="route-actions">
              <button @click="playRouteAnimation(route.id)" title="播放动画">🚗</button>
              <button @click="zoomToRoute(route.id)" title="定位">🎯</button>
              <button @click="deleteRoute(route.id)" title="删除">🗑️</button>
            </div>
          </div>
        </div>

        <p v-else class="empty-text">暂无路线记录</p>
      </div>

      <!-- 图层切换 -->
      <div class="panel-section">
        <h3>🗺️ 地图图层</h3>
        <div class="layer-buttons">
          <button
            v-for="(layer, index) in layers"
            :key="index"
            :class="{ active: currentLayerIndex === index }"
            @click="switchLayer(index)"
            class="layer-btn"
          >
            {{ layer.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- 地图容器 -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-container" :class="{ drawing: isDrawingRoute }"></div>
    </div>

    <!-- 点编辑器 -->
    <PointEditor
      :show="showEditor"
      :point="editingPoint"
      @close="showEditor = false"
      @save="handleSavePoint"
      @preview="handleImagePreview"
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
.gis-container {
  display: flex;
  height: 100vh;
  background: #fdf2f8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.side-panel {
  width: 320px;
  background: #fff;
  padding: 20px;
  overflow-y: auto;
  border-right: 2px solid #fce7f3;
}

.side-panel::-webkit-scrollbar {
  width: 6px;
}

.side-panel::-webkit-scrollbar-thumb {
  background: #fbcfe8;
  border-radius: 3px;
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #ec4899;
  font-weight: 600;
}

.route-input {
  margin-bottom: 12px;
}

.input-field {
  flex: 1;
  padding: 12px;
  border: 2px solid #fce7f3;
  border-radius: 12px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: #ec4899;
}

.input-field::placeholder {
  color: #fbcfe8;
}

.btn-primary,
.btn-success,
.btn-cancel {
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  color: #fff;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
}

.btn-primary.full-width {
  width: 100%;
}

.btn-success {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  flex: 1;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
  flex: 1;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.drawing-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.drawing-hint {
  background: #fce7f3;
  color: #ec4899;
  padding: 12px;
  border-radius: 12px;
  text-align: center;
  font-size: 13px;
  margin-bottom: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.route-item {
  background: #fdf2f8;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.route-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.route-length {
  font-size: 12px;
  color: #9ca3af;
}

.route-actions {
  display: flex;
  gap: 6px;
}

.route-actions button {
  width: 32px;
  height: 32px;
  background: #fff;
  border: 2px solid #fce7f3;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #ec4899;
}

.route-actions button:hover {
  border-color: #ec4899;
  transform: scale(1.1);
}

.empty-text {
  text-align: center;
  color: #d1d5db;
  font-size: 13px;
  padding: 20px 0;
}

.layer-buttons {
  display: grid;
  gap: 8px;
}

.layer-btn {
  padding: 12px;
  background: #fdf2f8;
  border: 2px solid #fce7f3;
  border-radius: 12px;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.layer-btn:hover {
  border-color: #f9a8d4;
  background: #fce7f3;
}

.layer-btn.active {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  border-color: #ec4899;
  color: #fff;
}

.map-wrapper {
  flex: 1;
  position: relative;
  background: #fdf2f8;
}

.map-container {
  width: 100%;
  height: 100%;
}

.map-container :deep(.ol-control) {
  background: rgba(255, 255, 255, 0.9);
}

.map-container :deep(.ol-control button) {
  color: #ec4899;
}

.map-container :deep(.ol-scale-line) {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #fce7f3;
}

.map-container :deep(.ol-scale-line-text) {
  color: #6b7280;
  font-size: 10px;
}

.map-container.drawing {
  cursor: crosshair;
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
