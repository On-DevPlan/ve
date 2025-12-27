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
  },
  // 图层数据
  layers: {
    type: Array,
    default: () => []
  },
  // 当前图层索引
  currentLayerIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'switchLayer',
  'viewPoint',
  'playRouteAnimation',
  'zoomToRoute',
  'changeViewMode',
  'toggleAutoPreview'
])

// 视图模式: 'all' | 'points-only' | 'routes-only'
const viewMode = ref('all')
const autoPreview = ref(false) // 自动预览首图开关

// 计算可见的点和路线
const visiblePoints = computed(() => {
  if (viewMode.value === 'routes-only') return []
  return props.recordPoints
})

const visibleRoutes = computed(() => {
  if (viewMode.value === 'points-only') return []
  return props.routes
})

// 切换视图模式
const setViewMode = (mode) => {
  viewMode.value = mode
  emit('changeViewMode', mode)
}

// 切换自动预览
const toggleAutoPreview = () => {
  autoPreview.value = !autoPreview.value
  emit('toggleAutoPreview', autoPreview.value)
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

// 视图模式配置
const viewModes = [
  { id: 'all', label: '显示全部', icon: '🌏' },
  { id: 'points-only', label: '仅显示点', icon: '📍' },
  { id: 'routes-only', label: '仅显示路线', icon: '🛣️' }
]
</script>

<template>
  <div class="user-control-panel">
    <!-- 视图控制 -->
    <div class="panel-section">
      <h3>👁️ 视图模式</h3>
      <div class="view-mode-buttons">
        <button
          v-for="mode in viewModes"
          :key="mode.id"
          :class="{ active: viewMode === mode.id }"
          @click="setViewMode(mode.id)"
          class="view-mode-btn"
        >
          <span class="mode-icon">{{ mode.icon }}</span>
          <span class="mode-label">{{ mode.label }}</span>
        </button>
      </div>
    </div>

    <!-- 记录点列表 -->
    <div class="panel-section" v-show="viewMode !== 'routes-only'">
      <h3>📍 旅行足迹 ({{ recordPoints.length }})</h3>
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
      <p v-else class="empty-text">当前视图模式下无记录点</p>
    </div>

    <!-- 路线列表 -->
    <div class="panel-section" v-show="viewMode !== 'points-only'">
      <h3>🛣️ 旅行路线 ({{ routes.length }})</h3>
      <div v-if="visibleRoutes.length > 0" class="route-list">
        <div
          v-for="route in visibleRoutes"
          :key="route.id"
          class="route-item"
        >
          <div class="route-info">
            <span class="route-name">{{ route.name || route.title || '未命名路线' }}</span>
            <span class="route-length">{{ route.length }}</span>
            <span class="route-description" v-if="route.description">{{ route.description }}</span>
          </div>
          <div class="route-actions">
            <button @click.stop="handlePlayAnimation(route.id)" title="播放动画" class="action-btn play-btn">
              🚗 播放
            </button>
            <button @click.stop="handleZoomToRoute(route.id)" title="定位" class="action-btn zoom-btn">
              🎯 定位
            </button>
          </div>
        </div>
      </div>
      <p v-else class="empty-text">当前视图模式下无路线</p>
    </div>

    <!-- 自动预览开关 -->
    <div class="panel-section">
      <h3>🖼️ 预览设置</h3>
      <div class="toggle-container">
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="autoPreview"
            @change="toggleAutoPreview"
            class="toggle-checkbox"
          />
          <span class="toggle-slider"></span>
          <span class="toggle-text">自动预览首图</span>
        </label>
        <p class="toggle-hint">开启后，地图上的点将自动显示第一张图片</p>
      </div>
    </div>

    <!-- 图层切换 -->
    <div class="panel-section">
      <h3>🗺️ 地图图层</h3>
      <div class="layer-buttons">
        <button
          v-for="(layer, index) in layers"
          :key="index"
          :class="{ active: currentLayerIndex === index }"
          @click="emit('switchLayer', index)"
          class="layer-btn"
        >
          {{ layer.name }}
        </button>
      </div>
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

/* 视图模式按钮 */
.view-mode-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-mode-btn {
  padding: 14px 16px;
  background: #eff6ff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
}

.view-mode-btn:hover {
  border-color: #93c5fd;
  background: #dbeafe;
}

.view-mode-btn.active {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  color: #fff;
}

.mode-icon {
  font-size: 18px;
}

.mode-label {
  flex: 1;
  text-align: left;
}

/* 记录点列表 */
.point-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
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
  max-height: 250px;
  overflow-y: auto;
}

.route-item {
  background: #eff6ff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  padding: 12px;
  transition: all 0.2s;
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
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  background: #fff;
  border: 2px solid #dbeafe;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
  color: #3b82f6;
}

.action-btn:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.play-btn:hover {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  color: #fff;
  border-color: #3b82f6;
}

.zoom-btn:hover {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  border-color: #10b981;
}

/* 自动预览开关 */
.toggle-container {
  background: #eff6ff;
  border-radius: 12px;
  padding: 16px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  position: relative;
}

.toggle-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  width: 48px;
  height: 26px;
  background: #cbd5e1;
  border-radius: 13px;
  transition: all 0.3s;
  flex-shrink: 0;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-checkbox:checked + .toggle-slider {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.toggle-checkbox:checked + .toggle-slider::before {
  left: 25px;
}

.toggle-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
}

.toggle-hint {
  margin: 10px 0 0 0;
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
  padding-left: 60px;
}

/* 图层按钮 */
.layer-buttons {
  display: grid;
  gap: 8px;
}

.layer-btn {
  padding: 12px;
  background: #eff6ff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.layer-btn:hover {
  border-color: #93c5fd;
  background: #dbeafe;
}

.layer-btn.active {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  color: #fff;
}

.empty-text {
  text-align: center;
  color: #cbd5e1;
  font-size: 13px;
  padding: 20px 0;
}
</style>
