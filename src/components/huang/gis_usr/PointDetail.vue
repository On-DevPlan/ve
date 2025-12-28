<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  point: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'viewImage'])

// 图片导航
const currentImageIndex = ref(0)

// 监听点变化，重置图片索引
watch(() => props.point, () => {
  currentImageIndex.value = 0
})

// 当前图片
const currentImage = computed(() => {
  if (!props.point || !props.point.images || props.point.images.length === 0) {
    return null
  }
  return props.point.images[currentImageIndex.value]
})

// 图片数量
const imageCount = computed(() => {
  if (!props.point || !props.point.images) {
    return 0
  }
  return props.point.images.length
})

// 是否有图片
const hasImages = computed(() => imageCount.value > 0)

// 图片列表
const imageList = computed(() => {
  return props.point?.images || []
})

// 上一张
const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  } else {
    currentImageIndex.value = imageCount.value - 1
  }
}

// 下一张
const nextImage = () => {
  if (currentImageIndex.value < imageCount.value - 1) {
    currentImageIndex.value++
  } else {
    currentImageIndex.value = 0
  }
}

// 选择图片
const selectImage = (index) => {
  currentImageIndex.value = index
}

// 关闭
const handleClose = () => {
  emit('close')
}

// 查看图片
const handleViewImage = (imageUrl, event) => {
  emit('viewImage', imageUrl, event)
}

// 键盘快捷键
const handleKeydown = (event) => {
  if (!props.show) return
  if (event.key === 'Escape') {
    handleClose()
  } else if (event.key === 'ArrowLeft') {
    prevImage()
  } else if (event.key === 'ArrowRight') {
    nextImage()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClose">
        <div class="point-detail-modal" @click.stop>
          <button @click="handleClose" class="close-btn">×</button>

          <div class="detail-content">
            <!-- 图片查看器 -->
            <div v-if="hasImages" class="image-viewer">
              <div class="image-display">
                <img
                  v-if="currentImage"
                  :src="currentImage"
                  :alt="point.title"
                  class="main-image"
                  @click="handleViewImage(currentImage, $event)"
                />
                <div v-else class="no-image">暂无图片</div>
              </div>

              <!-- 图片导航 -->
              <div v-if="imageCount > 1" class="image-navigation">
                <button @click="prevImage" class="nav-btn">‹</button>
                <span class="image-counter">{{ currentImageIndex + 1 }} / {{ imageCount }}</span>
                <button @click="nextImage" class="nav-btn">›</button>
              </div>

              <!-- 缩略图 -->
              <div v-if="imageCount > 1" class="image-thumbnails">
                <div
                  v-for="(img, index) in imageList"
                  :key="index"
                  class="thumbnail"
                  :class="{ active: index === currentImageIndex }"
                  @click="selectImage(index)"
                >
                  <img :src="img" :alt="`${point.title} ${index + 1}`" />
                </div>
              </div>
            </div>

            <!-- 点信息 -->
            <div class="point-info">
              <h2>{{ point?.title || '未命名地点' }}</h2>

              <!-- 坐标 -->
              <div class="info-section">
                <div class="info-label">📍 坐标</div>
                <div class="info-value">
                  {{ point?.lat?.toFixed(6) }}°N, {{ point?.lon?.toFixed(6) }}°E
                </div>
              </div>

              <!-- 时间 -->
              <div v-if="point?.time" class="info-section">
                <div class="info-label">🕐 时间</div>
                <div class="info-value">{{ point.time }}</div>
              </div>

              <!-- 描述 -->
              <div v-if="point?.description" class="info-section">
                <div class="info-label">📝 描述</div>
                <div class="info-value description">{{ point.description }}</div>
              </div>

              <!-- 图片统计 -->
              <div v-if="hasImages" class="info-section">
                <div class="info-label">📷 照片</div>
                <div class="info-value">{{ imageCount }} 张</div>
              </div>

              <!-- 快捷键提示 -->
              <div class="shortcuts-hint">
                <div class="hint-item">← → 切换图片</div>
                <div class="hint-item">ESC 关闭</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.point-detail-modal {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  max-width: 900px;
  max-height: 90vh;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid #e94560;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  color: #e94560;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.close-btn:hover {
  background: rgba(233, 69, 96, 0.4);
  transform: rotate(90deg);
}

.detail-content {
  display: flex;
  gap: 0;
  max-height: 90vh;
  overflow-y: auto;
}

/* 图片查看器 */
.image-viewer {
  flex: 1.5;
  background: #0f0f1e;
  display: flex;
  flex-direction: column;
}

.image-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 20px;
}

.main-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.3s;
}

.main-image:hover {
  transform: scale(1.02);
}

.no-image {
  color: #b8c1ec;
  font-size: 16px;
}

.image-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 16px;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  color: #e94560;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-btn:hover {
  background: rgba(233, 69, 96, 0.4);
}

.image-counter {
  color: #b8c1ec;
  font-size: 14px;
  font-weight: 600;
}

.image-thumbnails {
  display: flex;
  gap: 8px;
  padding: 0 20px 20px;
  overflow-x: auto;
  justify-content: center;
}

.thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s;
  flex-shrink: 0;
}

.thumbnail:hover {
  border-color: rgba(233, 69, 96, 0.5);
}

.thumbnail.active {
  border-color: #e94560;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 点信息 */
.point-info {
  flex: 1;
  padding: 40px 30px;
  background: linear-gradient(180deg, #16213e 0%, #1a1a2e 100%);
  border-left: 2px solid #e94560;
  min-width: 300px;
}

.point-info h2 {
  margin: 0 0 24px 0;
  font-size: 24px;
  color: #e94560;
  font-weight: 600;
}

.info-section {
  margin-bottom: 20px;
}

.info-label {
  color: #b8c1ec;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.info-value {
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
}

.info-value.description {
  white-space: pre-wrap;
}

.shortcuts-hint {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(233, 69, 96, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint-item {
  color: #b8c1ec;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-item::before {
  content: '⌨️';
}

/* 响应式 */
@media (max-width: 768px) {
  .detail-content {
    flex-direction: column;
  }

  .point-info {
    border-left: none;
    border-top: 2px solid #e94560;
    min-width: auto;
  }

  .image-display {
    max-height: 40vh;
  }
}

/* Modal 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-active .point-detail-modal,
.modal-leave-active .point-detail-modal {
  transition: transform 0.3s, opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .point-detail-modal,
.modal-leave-to .point-detail-modal {
  transform: scale(0.9);
  opacity: 0;
}
</style>
