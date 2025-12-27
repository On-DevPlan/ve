<script setup>
import { ref, computed, onMounted } from 'vue'
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
  'loadPresetData'
])

// 视图模式: 'points-only' | 'routes-only'
const viewMode = ref('points-only')

// 计算可见的点和路线
const visiblePoints = computed(() => {
  if (viewMode.value === 'routes-only') return []
  return props.recordPoints
})

const visibleRoutes = computed(() => {
  if (viewMode.value === 'points-only') return []
  return props.routes
})

// 切换到路线模式并播放动画
const handleShowRoutes = (routeId) => {
  viewMode.value = 'routes-only'
  emit('playRouteAnimation', routeId)
}

// 切换到点模式
const handleShowPoints = () => {
  viewMode.value = 'points-only'
}

// 切换到路线模式并播放第一条路线
const handleShowFirstRoute = () => {
  if (props.routes.length > 0) {
    handleShowRoutes(props.routes[0].id)
  }
}

// 查看点详情
const handleViewPoint = (point) => {
  emit('viewPoint', point)
}

// 定位到路线
const handleZoomToRoute = (routeId) => {
  emit('zoomToRoute', routeId)
}

// 组件挂载时自动加载预设数据
onMounted(async () => {
  try {
    const presetData = await getPresetData()
    if (presetData.data) {
      // 通过父组件加载数据
      emit('loadPresetData', presetData)
    }
  } catch (error) {
    console.error('加载预设数据失败:', error)
  }
})
</script>

<template>
  <div class="user-control-panel">
    <!-- 记录点列表 -->
    <div class="panel-section" v-show="viewMode === 'points-only'">
      <div class="section-header">
        <h3>📍 旅行足迹 ({{ recordPoints.length }})</h3>
        <button
          v-if="routes.length > 0"
          @click="handleShowFirstRoute"
          class="show-routes-btn"
        >
          🛣️ 显示路线
        </button>
      </div>
      <div v-if="visiblePoints.length > 0" class="point-list">
        <div
          v-for="point in visiblePoints"
          :key="point.id"
          class="point-item"
          @click="handleViewPoint(point)"
        >
          <div class="point-header">
            <span class="point-title">{{ point.title || '未命名地点' }}</span>
            <span class="point-time">{{ point.time }}</span>
          </div>
          <div class="point-location">
            <span class="coord">{{ point.lat.toFixed(4) }}°N, {{ point.lon.toFixed(4) }}°E</span>
          </div>
          <div class="point-description" v-if="point.description">
            {{ point.description }}
          </div>
          <div class="point-images" v-if="point.images && point.images.length > 0">
            <span class="image-count">🖼️ {{ point.images.length }} 张图片</span>
          </div>
        </div>
      </div>
      <p v-else class="empty-text">暂无记录点</p>
    </div>

    <!-- 路线列表 -->
    <div class="panel-section" v-show="viewMode === 'routes-only'">
      <div class="section-header">
        <h3>🛣️ 旅行路线 ({{ routes.length }})</h3>
        <button @click="handleShowPoints" class="back-btn">
          📍 返回足迹
        </button>
      </div>
      <div v-if="visibleRoutes.length > 0" class="route-list">
        <div
          v-for="route in visibleRoutes"
          :key="route.id"
          class="route-item"
          @click="handleShowRoutes(route.id)"
        >
          <div class="route-info">
            <span class="route-name">{{ route.name || route.title || '未命名路线' }}</span>
            <span class="route-length">{{ route.length }}</span>
            <span class="route-description" v-if="route.description">{{ route.description }}</span>
          </div>
          <div class="route-actions">
            <span class="route-hint">点击播放动画</span>
            <button @click.stop="handleZoomToRoute(route.id)" title="定位" class="action-btn zoom-btn">
              🎯
            </button>
          </div>
        </div>
      </div>
      <p v-else class="empty-text">暂无路线</p>
    </div>
  </div>
</template>

<style scoped>
.user-control-panel {
  width: 320px;
  background: #fff;
  padding: 20px;
  overflow-y: auto;
  border-right: 2px solid #dbeafe;
  height: 100%;
}

.user-control-panel::-webkit-scrollbar {
  width: 6px;
}

.user-control-panel::-webkit-scrollbar-thumb {
  background: #bfdbfe;
  border-radius: 3px;
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #3b82f6;
  font-weight: 600;
}

/* Section header with button */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #3b82f6;
  font-weight: 600;
}

.show-routes-btn,
.back-btn {
  padding: 8px 14px;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.show-routes-btn:hover,
.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.back-btn {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.back-btn:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* 记录点列表 */
.point-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.point-item {
  background: #eff6ff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.point-item:hover {
  border-color: #93c5fd;
  background: #dbeafe;
  transform: translateX(4px);
}

.point-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.point-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
}

.point-time {
  font-size: 11px;
  color: #94a3b8;
}

.point-location {
  margin-bottom: 6px;
}

.coord {
  font-size: 11px;
  color: #64748b;
  font-family: 'SF Mono', Consolas, monospace;
}

.point-description {
  font-size: 12px;
  color: #475569;
  margin-top: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.point-images {
  margin-top: 8px;
}

.image-count {
  font-size: 11px;
  color: #3b82f6;
  background: #dbeafe;
  padding: 4px 8px;
  border-radius: 6px;
}

/* 路线列表 */
.route-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 350px;
  overflow-y: auto;
}

.route-item {
  background: #eff6ff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.route-item:hover {
  border-color: #93c5fd;
  background: #dbeafe;
  transform: translateX(4px);
}

.route-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.route-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
}

.route-length {
  font-size: 12px;
  color: #64748b;
}

.route-description {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.route-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.route-hint {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
}

.action-btn {
  padding: 6px 10px;
  background: #fff;
  border: 2px solid #dbeafe;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  color: #3b82f6;
  flex-shrink: 0;
}

.action-btn:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: scale(1.1);
}

.zoom-btn:hover {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  border-color: #10b981;
}

.empty-text {
  text-align: center;
  color: #cbd5e1;
  font-size: 13px;
  padding: 20px 0;
}
</style>
