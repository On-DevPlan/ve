<script setup>
import { ref, computed, onMounted } from 'vue'
import { getPresetData } from './StorageManager.js'

const props = defineProps({
  routes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'viewPoint',
  'playRouteAnimation',
  'zoomToRoute',
  'toggleRouteVisibility',
  'loadPresetData'
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

// 切换路线展开/收起
const toggleRoute = (routeId) => {
  if (expandedRoutes.value.has(routeId)) {
    expandedRoutes.value.delete(routeId)
  } else {
    expandedRoutes.value.add(routeId)
  }
}

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

// 路线数量
const routesCount = computed(() => props.routes.length)

// 总站点数
const totalStations = computed(() => {
  return props.routes.reduce((sum, route) => {
    return sum + (route.points?.length || 0)
  }, 0)
})

// 组件挂载时加载预设数据
onMounted(async () => {
  try {
    const presetData = await getPresetData()
    if (presetData.data) {
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
        <!-- 统计信息 -->
        <div class="route-stats">
          <div class="stat-item">
            <span class="stat-label">巡演路线</span>
            <span class="stat-value">{{ routesCount }} 条</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">演出站点</span>
            <span class="stat-value">{{ totalStations }} 个</span>
          </div>
        </div>

        <!-- 路线列表 -->
        <div
          v-for="route in routes"
          :key="route.id"
          class="concert-route"
          :class="{ expanded: expandedRoutes.has(route.id) }"
        >
          <!-- 路线头部 -->
          <div class="route-header" @click="toggleRoute(route.id)">
            <div class="route-title-row">
              <span class="expand-icon">
                {{ expandedRoutes.has(route.id) ? '▼' : '▶' }}
              </span>
              <span class="route-title">{{ route.name || route.title }}</span>
            </div>
            <span class="route-length">📏 {{ route.length }}</span>
          </div>

          <p v-if="route.description && expandedRoutes.has(route.id)" class="route-description">
            {{ route.description }}
          </p>

          <!-- 路线操作按钮 -->
          <div v-if="expandedRoutes.has(route.id)" class="route-actions">
            <button @click.stop="handlePlayAnimation(route.id)" class="action-btn play-btn">
              ▶ 播放巡演
            </button>
            <button @click.stop="handleZoomToRoute(route.id)" class="action-btn zoom-btn">
              🔍 定位
            </button>
          </div>

          <!-- 城市站点列表 -->
          <div v-if="route.points && route.points.length > 0 && expandedRoutes.has(route.id)" class="city-stations">
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
                  <div v-if="point.images && point.images.length > 0" class="station-images">
                    📷 {{ point.images.length }} 张照片
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-text">
        🎵 暂无巡演路线数据
      </div>
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

/* 统计信息 */
.route-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  background: rgba(233, 69, 96, 0.1);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #b8c1ec;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #e94560;
}

/* 演唱会路线卡片 */
.concert-route {
  background: rgba(15, 15, 30, 0.6);
  border: 2px solid rgba(233, 69, 96, 0.3);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s;
}

.concert-route:hover {
  border-color: rgba(233, 69, 96, 0.5);
  box-shadow: 0 4px 20px rgba(233, 69, 96, 0.2);
}

.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  background: rgba(233, 69, 96, 0.05);
  transition: all 0.3s;
}

.route-header:hover {
  background: rgba(233, 69, 96, 0.1);
}

.route-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-icon {
  font-size: 10px;
  color: #e94560;
  transition: transform 0.3s;
}

.route-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.route-length {
  font-size: 12px;
  color: #b8c1ec;
  white-space: nowrap;
}

.route-description {
  margin: 0;
  padding: 0 16px 12px;
  font-size: 13px;
  color: #b8c1ec;
  line-height: 1.5;
}

/* 路线操作按钮 */
.route-actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  background: rgba(233, 69, 96, 0.1);
  border: 2px solid #e94560;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
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

/* 城市站点列表 */
.city-stations {
  padding: 0 16px 16px;
}

.city-stations h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #b8c1ec;
  font-weight: 600;
}

.stations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.station-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(233, 69, 96, 0.05);
  border: 1px solid rgba(233, 69, 96, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.station-item:hover {
  background: rgba(233, 69, 96, 0.15);
  border-color: #e94560;
  transform: translateX(4px);
}

.station-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.station-info {
  flex: 1;
  min-width: 0;
}

.station-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.station-coord {
  font-size: 11px;
  color: #b8c1ec;
  margin-bottom: 4px;
}

.station-images {
  font-size: 11px;
  color: #e94560;
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
