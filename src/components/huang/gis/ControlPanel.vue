<script setup>
import { ref } from 'vue'
import PointList from './PointList.vue'
import LocationSearch from './LocationSearch.vue'
import {
  exportToJson,
  downloadJsonFile,
  readJsonFile,
  importFromJson,
  getPresetData
} from './StorageManager.js'

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
  },
  // 是否正在绘制路线
  isDrawingRoute: {
    type: Boolean,
    default: false
  },
  // 临时路线点数量
  tempRoutePointsCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'switchLayer',
  'startDrawRoute',
  'finishRoute',
  'cancelDrawRoute',
  'playRouteAnimation',
  'zoomToRoute',
  'deleteRoute',
  'editPoint',
  'deletePoint',
  'selectPoint',
  'previewImage',
  'searchLocation',
  'importData'
])

// 文件输入引用
const fileInput = ref(null)

// 搜索地点
const handleSearchLocation = (place) => {
  emit('searchLocation', place)
}

// 编辑点
const handleEditPoint = (point) => {
  emit('editPoint', point)
}

// 删除点
const handleDeletePoint = (pointId) => {
  emit('deletePoint', pointId)
}

// 定位到点
const handleSelectPoint = (point) => {
  emit('selectPoint', point)
}

// 图片预览
const handlePreviewImage = (imageUrl, event) => {
  emit('previewImage', imageUrl, event)
}

// 导出数据
const handleExport = () => {
  const jsonData = exportToJson(props.recordPoints, props.routes, {
    title: '我的旅行日记',
    description: '导出的旅行记录和路线',
    includeImages: true
  })
  const filename = `travel-diary-${new Date().toISOString().slice(0, 10)}.json`
  downloadJsonFile(jsonData, filename)
}

// 导入预设数据
const handleImportPreset = async () => {
  try {
    const presetData = await getPresetData()
    const imported = importFromJson(presetData)
    emit('importData', imported)
  } catch (error) {
    alert('加载预设数据失败: ' + error.message)
  }
}

// 导入文件
const handleImportFile = () => {
  fileInput.value?.click()
}

// 文件选择处理
const handleFileChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const jsonData = await readJsonFile(file)
    const imported = importFromJson(jsonData)
    emit('importData', imported)

    // 重置文件输入
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (error) {
    alert('导入失败: ' + error.message)
  }
}
</script>

<template>
  <div class="control-panel">
    <!-- 地点搜索 -->
    <div class="panel-section">
      <h3>🔍 搜索地点</h3>
      <LocationSearch @select="handleSearchLocation" />
    </div>

    <!-- 记录点列表 -->
    <PointList
      :points="recordPoints"
      @edit="handleEditPoint"
      @delete="handleDeletePoint"
      @select="handleSelectPoint"
      @preview="handlePreviewImage"
    />

    <!-- 路线管理 -->
    <div class="panel-section">
      <h3>🛣️ 我的路线</h3>

      <div v-if="!isDrawingRoute" class="route-input">
        <button @click="emit('startDrawRoute')" class="btn-primary full-width">
          ✏️ 开始绘制路线
        </button>
      </div>

      <div v-else class="drawing-actions">
        <button @click="emit('finishRoute')" class="btn-success">
          ✓ 完成绘制
        </button>
        <button @click="emit('cancelDrawRoute')" class="btn-cancel">
          ✕ 取消
        </button>
      </div>

      <div v-if="isDrawingRoute" class="drawing-hint">
        💡 已添加 {{ tempRoutePointsCount }} 个点
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
            <button @click="emit('playRouteAnimation', route.id)" title="播放动画">🚗</button>
            <button @click="emit('zoomToRoute', route.id)" title="定位">🎯</button>
            <button @click="emit('deleteRoute', route.id)" title="删除">🗑️</button>
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
          @click="emit('switchLayer', index)"
          class="layer-btn"
        >
          {{ layer.name }}
        </button>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="panel-section">
      <h3>💾 数据管理</h3>
      <div class="data-buttons">
        <button @click="handleExport" class="data-btn export-btn">
          📤 导出数据
        </button>
        <button @click="handleImportPreset" class="data-btn preset-btn">
          📦 加载预设
        </button>
        <button @click="handleImportFile" class="data-btn import-btn">
          📥 导入文件
        </button>
      </div>
      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        @change="handleFileChange"
        style="display: none"
      />
      <p class="data-hint">导出的 JSON 文件可用于备份和分享数据</p>
    </div>
  </div>
</template>

<style scoped>
.control-panel {
  width: 320px;
  background: #fff;
  padding: 20px;
  overflow-y: auto;
  border-right: 2px solid #fce7f3;
  height: 100%;
}

.control-panel::-webkit-scrollbar {
  width: 6px;
}

.control-panel::-webkit-scrollbar-thumb {
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

/* 数据管理按钮 */
.data-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-btn {
  padding: 12px 16px;
  border: 2px solid #fce7f3;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.export-btn {
  background: linear-gradient(135deg, #34d399, #10b981);
  border-color: #10b981;
  color: #fff;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.preset-btn {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  color: #fff;
}

.preset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.import-btn {
  background: #fdf2f8;
  border-color: #fce7f3;
  color: #6b7280;
}

.import-btn:hover {
  border-color: #f9a8d4;
  background: #fce7f3;
}

.data-hint {
  margin-top: 12px;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  line-height: 1.4;
}
</style>
