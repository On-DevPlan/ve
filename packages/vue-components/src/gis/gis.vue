<script setup>
import { ref, onMounted, onUnmounted, shallowRef, computed } from 'vue'
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
import PointEditor from './PointEditor.vue'
import PointDetail from './PointDetail.vue'
import ControlPanel from './ControlPanel.vue'
import UserControlPanel from './UserControlPanel.vue'
import { importFromJson } from './StorageManager.js'

// 地图容器
const mapContainer = ref(null)
const map = shallowRef(null)
const currentLayerIndex = ref(0)

// 面板模式: 'admin' | 'user'
const panelMode = ref('admin')

// 视图模式 (用户面板): 'all' | 'points-only' | 'routes-only'
const viewMode = ref('all')

// 自动预览首图开关
const autoPreviewEnabled = ref(false)

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
const showPointDetail = ref(false)  // 用户详情弹窗
const editingPoint = ref(null)
const viewingPoint = ref(null)      // 正在查看的点
const editorMode = ref('create') // 'create' | 'edit' | 'view' | 'route' | 'route-point'
const editingRoute = ref(null)
const editingRoutePointIndex = ref(null)  // 正在编辑的路线转折点索引

// 悬停的点
const hoveredPointId = ref(null)

// Select 交互
// const selectInteraction = ref(null)  // 暂未使用 — ve 项目里也有,但目前没参与任何逻辑

// 动画相关
const carOverlay = ref(null)  // 小车 overlay
const animationProgress = ref(0)  // 动画进度 0-1
const animationId = ref(null)  // 动画帧 ID

// 图片预览
const previewImage = ref(null)  // 当前预览的图片 URL
const previewPosition = ref({ x: 0, y: 0 })  // 预览位置

// 地图点悬浮图片预览
const pointImageOverlay = ref(null)  // 点的图片预览 overlay
const carImageUrl = '/map/333.gif'  

// 计算临时路线点数量（传递给 ControlPanel）
const tempRoutePointsCount = computed(() => tempRoutePoints.value.length)
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

// 搜索地点处理
const handleSearchLocation = (place) => {
  if (!map.value) return
  // 飞到搜索到的地点
  const view = map.value.getView()
  view.animate({
    center: fromLonLat([place.lon, place.lat]),
    zoom: 15,
    duration: 1000
  })

  // 可以在此添加临时标记点
  const searchMarker = new Feature({
    geometry: new Point(fromLonLat([place.lon, place.lat])),
    name: place.name,
    address: place.address,
    isSearchMarker: true
  })

  // 创建搜索标记样式（特殊颜色）
  searchMarker.setStyle(new Style({
    image: new Circle({
      radius: 14,
      fill: new Fill({ color: '#f59e0b' }),
      stroke: new Stroke({ color: '#fff', width: 3 })
    }),
    text: new Text({
      text: place.name,
      offsetY: -20,
      fill: new Fill({ color: '#f59e0b' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
      font: 'bold 14px sans-serif'
    })
  }))

  vectorSource.addFeature(searchMarker)

  // 5秒后移除搜索标记
  setTimeout(() => {
    vectorSource.removeFeature(searchMarker)
  }, 5000)
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
    pointFeature.setStyle(getRoutePointStyle())

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
      const pointIndex = props.routePointIndex

      // 检查是否是正在绘制的临时路线（仅管理模式）
      if (isDrawingRoute.value && panelMode.value === 'admin') {
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
          const routePoint = targetRoute.points[pointIndex]
          if (panelMode.value === 'user') {
            // 用户模式：显示详情弹窗
            handleViewPoint(routePoint)
          } else {
            // 管理模式：打开编辑器
            editingRoute.value = targetRoute
            editingPoint.value = { ...routePoint }
            editingRoutePointIndex.value = pointIndex
            editorMode.value = 'route-point'
            showEditor.value = true
          }
        }
      }
      return
    }

    // 检查是否是普通记录点
    if (feature.getId()) {
      const point = recordPoints.value.find(p => p.id === feature.getId())
      if (point) {
        // 根据面板模式决定操作
        handleViewPoint(point)
        return
      }
    }
  }

  // 点击空白区域：添加新记录点（仅管理模式）
  if (panelMode.value === 'admin') {
    editingPoint.value = {
      lon: lonLat[0],
      lat: lonLat[1],
      time: new Date().toLocaleString('zh-CN')
    }
    editorMode.value = 'create'
    showEditor.value = true
  }
  // 用户模式下点击空白区域不做任何操作
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
        // 路线转折点 hover 效果
        feature.setStyle(getRoutePointHoverStyle(feature))

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

  // 提取转折点数据
  const points = tempRoutePoints.value.map(p => p.data)

  // 从 points 计算 EPSG:3857 坐标
  const coordinates = points.map(p => fromLonLat([p.lon, p.lat]))
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

  // 从 points 计算路线坐标
  const coordinates = route.points ? route.points.map(p => fromLonLat([p.lon, p.lat])) : []
  if (coordinates.length < 2) return

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
    // 从 points 计算 EPSG:3857 坐标
    const coordinates = route.points ? route.points.map(p => fromLonLat([p.lon, p.lat])) : []
    const lineString = new LineString(coordinates)
    const feature = new Feature({
      geometry: lineString
    })

    feature.setStyle(new Style({
      stroke: new Stroke({
        color: '#ec4899',
        width: 5
      }),
      text: new Text({
        text: route.name || route.title || '',
        offsetY: -15,
        fill: new Fill({ color: '#ec4899' }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
        font: 'bold 14px sans-serif'
      })
    }))

    routeSource.addFeature(feature)

    // 返回路线对象（包含 feature 引用）
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

  // 提示用户
  const pointsCount = recordPoints.value.length
  const routesCount = routes.value.length
  alert(`导入成功！\n\n记录点: ${pointsCount} 个\n路线: ${routesCount} 条`)
}

// ==================== 用户面板相关功能 ====================

// 加载预设数据
const handleLoadPresetData = async (presetData) => {
  const imported = importFromJson(presetData)
  handleImportData(imported)
}

// 切换视图模式
const handleChangeViewMode = (mode) => {
  viewMode.value = mode

  // 始终保持 vectorLayer 可见，通过控制 Feature 级别可见性
  vectorLayer.setVisible(true)

  // 根据视图模式控制路线图层可见性
  if (mode === 'points-only') {
    routeLayer.setVisible(false)
  } else {
    routeLayer.setVisible(true)
  }

  // 控制 vectorLayer 中每个 Feature 的可见性
  vectorSource.getFeatures().forEach(feature => {
    const props = feature.getProperties()
    const isRoutePoint = props.isRoutePoint

    if (mode === 'points-only') {
      // 仅显示点：显示普通记录点，隐藏路线转折点
      feature.setStyle(isRoutePoint ? null : getPointStyle(feature, false))
    } else if (mode === 'routes-only') {
      // 仅显示路线：隐藏普通记录点，显示路线转折点
      feature.setStyle(isRoutePoint ? getRoutePointStyle() : null)
    } else {
      // 显示全部：显示所有点
      if (isRoutePoint) {
        feature.setStyle(getRoutePointStyle())
      } else {
        feature.setStyle(getPointStyle(feature, false))
      }
    }
  })
}

// 获取普通记录点样式
const getPointStyle = (feature, isHovered) => {
  const point = feature.getProperties()
  const radius = isHovered ? 16 : 12
  const strokeWidth = isHovered ? 4 : 3

  return new Style({
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
  })
}

// 获取路线转折点样式
const getRoutePointStyle = () => {
  return new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: '#f472b6' }),
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
  })
}

// 切换自动预览
const handleToggleAutoPreview = (enabled) => {
  autoPreviewEnabled.value = enabled

  if (enabled) {
    // 自动显示所有点的第一张图片
    showAllPointImages()
  } else {
    // 隐藏所有自动预览
    hideAllPointImages()
  }
}

// 显示所有点的首图预览
const showAllPointImages = () => {
  if (!map.value) return

  // 为每个有图片的点创建 overlay
  vectorSource.getFeatures().forEach(feature => {
    const props = feature.getProperties()
    let imageUrl = null

    // 从记录点获取图片
    const point = recordPoints.value.find(p => p.id === feature.getId())
    if (point && point.images && point.images.length > 0) {
      imageUrl = point.images[0]
    }

    // 如果没有，从路线转折点获取
    if (!imageUrl && props.isRoutePoint) {
      for (const route of routes.value) {
        if (route.points) {
          const routePoint = route.points.find(p => p.id === feature.getId())
          if (routePoint && routePoint.images && routePoint.images.length > 0) {
            imageUrl = routePoint.images[0]
            break
          }
        }
      }
    }

    if (imageUrl) {
      const geometry = feature.getGeometry()
      if (geometry) {
        const coordinate = geometry.getCoordinates()
        createPersistentImageOverlay(feature.getId(), coordinate, imageUrl)
      }
    }
  })
}

// 隐藏所有自动预览
const hideAllPointImages = () => {
  // 移除所有持久化的图片 overlay
  const overlays = map.value.getOverlays().getArray()
  overlays.forEach(overlay => {
    const element = overlay.getElement()
    if (element && element.classList.contains('auto-point-image')) {
      map.value.removeOverlay(overlay)
    }
  })
}

// 创建持久化的图片 overlay
const imageOverlays = new Map() // 存储每个点的图片 overlay

const createPersistentImageOverlay = (pointId, coordinate, imageUrl) => {
  // 如果已存在，先移除
  if (imageOverlays.has(pointId)) {
    const existing = imageOverlays.get(pointId)
    map.value.removeOverlay(existing)
  }

  const imageElement = document.createElement('div')
  imageElement.className = 'auto-point-image point-image-preview'
  imageElement.innerHTML = `<img src="${imageUrl}" alt="预览" />`

  const overlay = new Overlay({
    element: imageElement,
    positioning: 'bottom-left',
    offset: [15, -15],
    stopEvent: false
  })

  map.value.addOverlay(overlay)
  overlay.setPosition(coordinate)
  imageOverlays.set(pointId, overlay)
}

// 查看点详情（用户面板）
const handleViewPoint = (point) => {
  if (panelMode.value === 'user') {
    // 用户模式：显示详情弹窗
    viewingPoint.value = { ...point }
    showPointDetail.value = true
  } else {
    // 管理模式：显示编辑器
    editingPoint.value = { ...point }
    editorMode.value = 'view'
    showEditor.value = true
  }
}

// 切换面板模式（开发调试用）
const togglePanelMode = () => {
  panelMode.value = panelMode.value === 'admin' ? 'user' : 'admin'
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
    <!-- 左侧控制面板 -->
    <ControlPanel
      v-if="panelMode === 'admin'"
      :record-points="recordPoints"
      :routes="routes"
      :layers="layers"
      :current-layer-index="currentLayerIndex"
      :is-drawing-route="isDrawingRoute"
      :temp-route-points-count="tempRoutePointsCount"
      @switch-layer="switchLayer"
      @start-draw-route="startDrawRoute"
      @finish-route="finishRoute"
      @cancel-draw-route="cancelDrawRoute"
      @play-route-animation="playRouteAnimation"
      @zoom-to-route="zoomToRoute"
      @delete-route="deleteRoute"
      @edit-point="handleEditPoint"
      @delete-point="handleDeletePoint"
      @select-point="flyToPoint"
      @preview-image="handleImagePreview"
      @search-location="handleSearchLocation"
      @import-data="handleImportData"
    />

    <UserControlPanel
      v-else
      :record-points="recordPoints"
      :routes="routes"
      :layers="layers"
      :current-layer-index="currentLayerIndex"
      @switch-layer="switchLayer"
      @view-point="handleViewPoint"
      @play-route-animation="playRouteAnimation"
      @zoom-to-route="zoomToRoute"
      @change-view-mode="handleChangeViewMode"
      @toggle-auto-preview="handleToggleAutoPreview"
      @load-preset-data="handleLoadPresetData"
      @toggle-route-visibility="handleToggleRouteVisibility"
    />

    <!-- 地图容器 -->
    <div class="map-wrapper">
      <div
        ref="mapContainer"
        class="map-container"
        :class="{ drawing: isDrawingRoute }"
      >
        <!-- 面板切换按钮（开发调试用） -->
        <button
          class="panel-toggle-btn"
          title="切换面板模式"
          @click="togglePanelMode"
        >
          {{ panelMode === 'admin' ? '用户面板' : '管理面板' }}
        </button>
      </div>
    </div>

    <!-- 点编辑器 -->
    <PointEditor
      :show="showEditor"
      :point="editingPoint"
      @close="showEditor = false"
      @save="handleSavePoint"
      @preview="handleImagePreview"
    />

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
        <img
          :src="previewImage"
          alt="预览图片"
        >
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

/* 面板切换按钮 */
.panel-toggle-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-toggle-btn:hover {
  background: #fff;
  border-color: #94a3b8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
