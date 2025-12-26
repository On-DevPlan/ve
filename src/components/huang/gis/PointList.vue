<script setup>
import { ref } from 'vue'

const props = defineProps({
  points: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['edit', 'delete', 'select'])

const expandedPoints = ref(new Set())

// 切换展开/收起
const toggleExpand = (pointId) => {
  if (expandedPoints.value.has(pointId)) {
    expandedPoints.value.delete(pointId)
  } else {
    expandedPoints.value.add(pointId)
  }
}

// 定位到点
const handleSelect = (point) => {
  emit('select', point)
}

// 编辑点
const handleEdit = (point) => {
  emit('edit', point)
}

// 删除点
const handleDelete = (pointId) => {
  if (confirm('确定要删除这个记录吗？')) {
    emit('delete', pointId)
  }
}
</script>

<template>
  <div class="point-list-container">
    <h3 class="list-title">📝 我的记录</h3>

    <div v-if="points.length === 0" class="empty-state">
      <p>还没有记录哦~</p>
      <p class="hint">点击地图添加第一个记录吧</p>
    </div>

    <div class="point-items">
      <div
        v-for="point in points"
        :key="point.id"
        class="point-item"
      >
        <div class="point-header" @click="toggleExpand(point.id)">
          <div class="point-title-row">
            <span class="point-icon">📍</span>
            <span class="point-title">{{ point.title || '未命名记录' }}</span>
            <span class="expand-icon">{{ expandedPoints.has(point.id) ? '▼' : '▶' }}</span>
          </div>
          <div class="point-meta">
            <span class="point-time">{{ point.time }}</span>
          </div>
        </div>

        <div v-if="expandedPoints.has(point.id)" class="point-details">
          <div v-if="point.description" class="point-description">
            {{ point.description }}
          </div>

          <div v-if="point.images && point.images.length > 0" class="point-images">
            <img
              v-for="(img, index) in point.images"
              :key="index"
              :src="img"
              alt="记录图片"
              @click="$emit('preview', img)"
            />
          </div>

          <div class="point-coords">
            <small>{{ point.lat.toFixed(4) }}, {{ point.lon.toFixed(4) }}</small>
          </div>

          <div class="point-actions">
            <button @click.stop="handleSelect(point)" class="action-btn locate">
              🎯 定位
            </button>
            <button @click.stop="handleEdit(point)" class="action-btn edit">
              ✏️ 编辑
            </button>
            <button @click.stop="handleDelete(point.id)" class="action-btn delete">
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.point-list-container {
  background: #fff;
  border-radius: 20px;
  padding: 20px;
}

.list-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #ec4899;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #fbcfe8;
}

.empty-state p {
  margin: 8px 0;
}

.hint {
  font-size: 13px;
}

.point-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.point-item {
  background: #fff;
  border: 2px solid #fce7f3;
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.2s;
}

.point-item:hover {
  border-color: #f9a8d4;
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.1);
}

.point-header {
  padding: 14px 16px;
  cursor: pointer;
}

.point-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.point-icon {
  font-size: 16px;
}

.point-title {
  flex: 1;
  font-weight: 600;
  color: #374151;
  font-size: 15px;
}

.expand-icon {
  color: #ec4899;
  font-size: 12px;
}

.point-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.point-time {
  font-size: 12px;
  color: #9ca3af;
}

.point-details {
  padding: 0 16px 16px 16px;
  border-top: 1px solid #fce7f3;
}

.point-description {
  padding: 12px 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.6;
}

.point-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.point-images img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.point-images img:hover {
  transform: scale(1.05);
}

.point-coords {
  padding: 8px 0;
  color: #d1d5db;
  font-size: 11px;
}

.point-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.locate {
  background: #dbeafe;
  color: #3b82f6;
}

.action-btn.locate:hover {
  background: #bfdbfe;
}

.action-btn.edit {
  background: #fef3c7;
  color: #d97706;
}

.action-btn.edit:hover {
  background: #fde68a;
}

.action-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.delete:hover {
  background: #fecaca;
}
</style>
