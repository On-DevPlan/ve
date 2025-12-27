<script setup>
import { ref, onMounted } from 'vue'
import { getPresetData } from './StorageManager.js'

const props = defineProps({
  // 记录点数据
  recordPoints: {
    type: Array,
    default: () => []
  },
  // 路线数据
  routes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'viewPoint',
  'playRouteAnimation',
  'zoomToRoute',
  'loadPresetData',
  'toggleRouteVisibility'
])

// 是否显示路线连接线
const showRouteLines = ref(true)

// 切换路线显示
const toggleRouteLines = () => {
  showRouteLines.value = !showRouteLines.value
  emit('toggleRouteVisibility', showRouteLines.value)
}

// 展开状态
const expandedRoutes = ref(new Set())

// 切换展开/收起
const toggleRoute = (routeId) => {
  if (expandedRoutes.value.has(routeId)) {
    expandedRoutes.value.delete(routeId)
  } else {
    expandedRoutes.value.add(routeId)
  }
}

// 判断是否展开
const isExpanded = (routeId) => expandedRoutes.value.has(routeId)

// 查看点详情
const handleViewPoint = (point) => {
  emit('viewPoint', point)
}

// 播放路线动画
const handlePlayAnimation = (routeId) => {
  emit('playRouteAnimation', routeId)
}

// 定位到路线
const handleZoomToRoute = (routeId) => {
  emit('zoomToRoute', routeId)
}

// 组件挂载时自动加载预设数据并展开第一条路线
onMounted(async () => {
  try {
    const presetData = await getPresetData()
    if (presetData.data) {
      // 通过父组件加载数据
      emit('loadPresetData', presetData)
      // 自动展开第一条路线
      if (props.routes.length > 0) {
        expandedRoutes.value.add(props.routes[0].id)
      }
    }
  } catch (error) {
    console.error('加载预设数据失败:', error)
  }
})
</script>

<template>
  <div class="user-control-panel">
    <!-- 演唱会巡演路线 -->
    <div class="panel-section">
      <div class="section-header">
        <h3>🎵 2025年宇宙无敌号演唱会</h3>
        <button
          @click="toggleRouteLines"
          class="toggle-lines-btn"
          :class="{ active: showRouteLines }"
          :title="showRouteLines ? '隐藏路线' : '显示路线'"
        >
          {{ showRouteLines ? '📍 隐藏路线' : '🛤️ 显示路线' }}
        </button>
      </div>

      <div v-if="routes.length > 0" class="route-detail">
        <div
          v-for="route in routes"
          :key="route.id"
          class="concert-route"
        >
          <div class="route-header">
            <span class="route-title">{{ route.name || route.title }}</span>
            <span class="route-length">📏 {{ route.length }}</span>
          </div>

          <p v-if="route.description" class="route-description">{{ route.description }}</p>

          <!-- 城市站点列表 -->
          <div v-if="route.points && route.points.length > 0" class="city-stations">
            <h4>🎤 演出站点 ({{ route.points.length }})</h4>
            <div class="stations-list">
              <div
                v-for="(point, index) in route.points"
                :key="point.id"
                class="station-item"
                @click="handleViewPoint(point)"
              >
                <div class="station-number">{{ index + 1 }}</div>
                <div class="station-info">
                  <div class="station-name">{{ point.title || '未命名站点' }}</div>
                  <div class="station-coord">
                    {{ point.lat.toFixed(2) }}°N, {{ point.lon.toFixed(2) }}°E
                  </div>
                  <div v-if="point.description" class="station-desc">
                    {{ point.description }}
                  </div>
                  <div v-if="point.images && point.images.length > 0" class="station-images">
                    📷 {{ point.images.length }} 张照片
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="route-actions">
            <button @click="handlePlayAnimation(route.id)" class="action-btn play-btn">
              🚀 播放巡演路线
            </button>
            <button @click="handleZoomToRoute(route.id)" class="action-btn zoom-btn">
              🎯 定位路线
            </button>
          </div>
        </div>
      </div>

      <p v-else class="empty-text">暂无演唱会路线</p>
    </div>
  </div>
</template>

<style scoped>
.user-control-panel {
  width: 320px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
  overflow-y: auto;
  border-right: 2px solid #e94560;
  height: 100%;
  color: #fff;
}

.user-control-panel::-webkit-scrollbar {
  width: 6px;
}

.user-control-panel::-webkit-scrollbar-thumb {
  background: #e94560;
  border-radius: 3px;
}

.panel-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
}

.panel-section h3 {
  margin: 0;
  font-size: 18px;
  color: #e94560;
  font-weight: 600;
  text-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
}

/* 演唱会路线卡片 */
.route-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.concert-route {
  background: rgba(233, 69, 96, 0.1);
  border: 2px solid #e94560;
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(10px);
}

.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.route-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
}

.route-length {
  font-size: 12px;
  color: #e94560;
  background: rgba(233, 69, 96, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
}

.route-description {
  font-size: 13px;
  color: #b8c1ec;
  margin: 8px 0 16px 0;
  line-height: 1.5;
}

/* 城市站点列表 */
.city-stations {
  margin-bottom: 16px;
}

.city-stations h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #e94560;
  font-weight: 600;
}

.stations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.stations-list::-webkit-scrollbar {
  width: 4px;
}

.stations-list::-webkit-scrollbar-thumb {
  background: #e94560;
  border-radius: 2px;
}

.station-item {
  display: flex;
  gap: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.station-item:hover {
  background: rgba(233, 69, 96, 0.2);
  border-color: #e94560;
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
}

.station-number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.station-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.station-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.station-coord {
  font-size: 11px;
  color: #b8c1ec;
  font-family: 'SF Mono', Consolas, monospace;
}

.station-desc {
  font-size: 12px;
  color: #b8c1ec;
  line-height: 1.4;
}

.station-images {
  font-size: 11px;
  color: #e94560;
  background: rgba(233, 69, 96, 0.2);
  padding: 3px 8px;
  border-radius: 6px;
  align-self: flex-start;
}

/* 路线操作按钮 */
.route-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e94560;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  color: #fff;
  background: rgba(233, 69, 96, 0.2);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.4);
}

.play-btn:hover {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  border-color: #ff6b6b;
}

.zoom-btn:hover {
  background: linear-gradient(135deg, #0f3460, #16213e);
  border-color: #0f3460;
}

/* 路线切换按钮 */
.toggle-lines-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.toggle-lines-btn:hover {
  background: rgba(233, 69, 96, 0.4);
  transform: scale(1.05);
}

.toggle-lines-btn.active {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  border-color: #ff6b6b;
}

.empty-text {
  text-align: center;
  color: #b8c1ec;
  font-size: 13px;
  padding: 40px 20px;
  font-style: italic;
}
</style>
