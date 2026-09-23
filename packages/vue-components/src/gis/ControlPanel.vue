<script setup>
import PointList from './PointList.vue'
import LocationSearch from './LocationSearch.vue'
import {
  exportToJson,
  downloadJsonFile,
  readJsonFile,
  importFromJson,
  getPresetData
} from './StorageManager.js'
// 文件选择（导入 JSON）统一走 shared/components 的共享组件 —— 与 game-skin-admin
// 同一条链路：只 import descriptor，不 import FileDropZone.vue（直接渲染会绕过
// SharedMount，descriptor.css 没人注入，组件会以裸样式出现）。
import SharedMount from '@/shared/components/runtime/SharedMount.vue'
import FileDropZone, { formatRejectInfo } from '@/shared/components/FileDropZone'

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

// 导入文件：类型 / 体积 / 目录这些校验由共享组件做完再回调，这里只处理业务。
// 不必再手动重置 input.value —— FileDropZone 内部已经做了（否则连选同一个文件
// 不会触发 change）。
const onImportFile = async (picked) => {
  const file = picked[0]
  if (!file) return

  try {
    const jsonData = await readJsonFile(file)
    const imported = importFromJson(jsonData)
    emit('importData', imported)
  } catch (error) {
    alert('导入失败: ' + error.message)
  }
}

// 被共享组件拒掉的拖拽内容（不是 .json / 拖进了文件夹）
const onRejectImport = (info) => {
  alert(formatRejectInfo(info))
}
</script>

<template>
  <div class="control-panel">
    <!-- 地点搜索 -->
    <div class="panel-section">
      <h3>搜索地点</h3>
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
      <h3>我的路线</h3>

      <div
        v-if="!isDrawingRoute"
        class="route-input"
      >
        <button
          class="btn-primary full-width"
          @click="emit('startDrawRoute')"
        >
          开始绘制路线
        </button>
      </div>

      <div
        v-else
        class="drawing-actions"
      >
        <button
          class="btn-success"
          @click="emit('finishRoute')"
        >
          完成绘制
        </button>
        <button
          class="btn-cancel"
          @click="emit('cancelDrawRoute')"
        >
          取消
        </button>
      </div>

      <div
        v-if="isDrawingRoute"
        class="drawing-hint"
      >
        已添加 {{ tempRoutePointsCount }} 个点
      </div>

      <div
        v-if="routes.length > 0"
        class="route-list"
      >
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
            <button
              title="播放动画"
              @click="emit('playRouteAnimation', route.id)"
            >
              播放
            </button>
            <button
              title="定位"
              @click="emit('zoomToRoute', route.id)"
            >
              定位
            </button>
            <button
              title="删除"
              @click="emit('deleteRoute', route.id)"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      <p
        v-else
        class="empty-text"
      >
        暂无路线记录
      </p>
    </div>

    <!-- 图层切换 -->
    <div class="panel-section">
      <h3>地图图层</h3>
      <div class="layer-buttons">
        <button
          v-for="(layer, index) in layers"
          :key="index"
          :class="{ active: currentLayerIndex === index }"
          class="layer-btn"
          @click="emit('switchLayer', index)"
        >
          {{ layer.name }}
        </button>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="panel-section">
      <h3>数据管理</h3>
      <div class="data-buttons">
        <button
          class="data-btn export-btn"
          @click="handleExport"
        >
          导出数据
        </button>
        <button
          class="data-btn preset-btn"
          @click="handleImportPreset"
        >
          加载预设
        </button>
        <!-- 「导入文件」统一走共享组件（bare 形态）：外观仍是 .data-btn.import-btn，
             额外获得拖拽填入与统一的类型 / 体积 / 目录校验。 -->
        <SharedMount
          class="import-file"
          :module="FileDropZone"
          :component-props="{
            variant: 'bare',
            buttonClass: 'data-btn import-btn',
            accept: '.json',
            label: '导入文件',
            onSelect: onImportFile,
            onReject: onRejectImport,
          }"
        />
      </div>
      <p class="data-hint">
        导出的 JSON 文件可用于备份和分享数据
      </p>
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

.data-hint {
  margin-top: 12px;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  line-height: 1.4;
}
</style>

<style>
/* ── 非 scoped 块 ────────────────────────────────────────────────────
   只有「导入文件」需要它。该按钮已统一交给 shared/components 的
   FileDropZone（bare 形态）—— 外观由消费方提供的类名决定，而那个
   <button> 是共享组件内部渲染的，scoped 的 [data-v-*] 属性加不到它身上。
   作用域改用 .control-panel 前缀收敛（本组件的根类名）；选择器特异度与
   原来的 .xxx[data-v-*] 一致，都是 (0,2,0)，观感不变。
   ──────────────────────────────────────────────────────────────────── */
.control-panel .data-btn {
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

.control-panel .export-btn {
  background: linear-gradient(135deg, #34d399, #10b981);
  border-color: #10b981;
  color: #fff;
}

.control-panel .export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.control-panel .preset-btn {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  color: #fff;
}

.control-panel .preset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.control-panel .import-btn {
  background: #fdf2f8;
  border-color: #fce7f3;
  color: #6b7280;
}

.control-panel .import-btn:hover {
  border-color: #f9a8d4;
  background: #fce7f3;
}

/* SharedMount 的壳（<div class="import-file">）只是布局中转，不参与视觉。
   原来「导入文件」是 .data-buttons 的直接 flex item，靠 align-items: stretch
   铺满整行；加壳后要显式补回这个行为，否则按钮会退化成内容宽度。
   用 `> *` 而不是点共享组件的内部类名 —— 宿主不该伸进共享组件实现里。 */
.control-panel .data-buttons > .import-file,
.control-panel .data-buttons > .import-file > * {
  display: block;
  width: 100%;
}
</style>
