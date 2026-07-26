<script setup>
import { ref, watch, computed } from 'vue'

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

const currentImageIndex = ref(0)

// 当前显示的图片
const currentImage = computed(() => {
  if (!props.point || !props.point.images || props.point.images.length === 0) {
    return null
  }
  return props.point.images[currentImageIndex.value]
})

// 是否有图片
const hasImages = computed(() => {
  return props.point && props.point.images && props.point.images.length > 0
})

// 图片总数
const imageCount = computed(() => {
  if (!props.point || !props.point.images) return 0
  return props.point.images.length
})

// 上一张图片
const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  } else {
    currentImageIndex.value = imageCount.value - 1
  }
}

// 下一张图片
const nextImage = () => {
  if (currentImageIndex.value < imageCount.value - 1) {
    currentImageIndex.value++
  } else {
    currentImageIndex.value = 0
  }
}

// 查看大图
const handleViewImage = (imageUrl, event) => {
  emit('viewImage', imageUrl, event)
}

// 关闭详情
const handleClose = () => {
  emit('close')
}

// 监听点变化，重置图片索引
watch(() => props.point, () => {
  currentImageIndex.value = 0
})

// 键盘事件
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

// 组件挂载时添加键盘事件监听
import { onMounted, onUnmounted } from 'vue'
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show && point"
        class="modal-overlay"
        @click.self="handleClose"
      >
        <div class="point-detail-modal">
          <!-- 关闭按钮 -->
          <button
            class="close-btn"
            @click="handleClose"
          >
            ✕
          </button>

          <div class="detail-content">
            <!-- 图片查看器 -->
            <div
              v-if="hasImages"
              class="image-viewer"
            >
              <div class="image-display">
                <img
                  :src="currentImage"
                  :alt="point.title"
                  class="main-image"
                  @click="handleViewImage(currentImage, $event)"
                >
              </div>

              <!-- 图片导航 -->
              <div class="image-navigation">
                <button
                  class="nav-btn prev-btn"
                  :disabled="imageCount <= 1"
                  @click="prevImage"
                >
                  ‹
                </button>
                <span class="image-counter">{{ currentImageIndex + 1 }} / {{ imageCount }}</span>
                <button
                  class="nav-btn next-btn"
                  :disabled="imageCount <= 1"
                  @click="nextImage"
                >
                  ›
                </button>
              </div>

              <!-- 图片缩略图 -->
              <div
                v-if="imageCount > 1"
                class="image-thumbnails"
              >
                <div
                  v-for="(img, index) in point.images"
                  :key="index"
                  class="thumbnail"
                  :class="{ active: index === currentImageIndex }"
                  @click="currentImageIndex = index"
                >
                  <img
                    :src="img"
                    :alt="`图片 ${index + 1}`"
                  >
                </div>
              </div>
            </div>

            <!-- 无图片占位 -->
            <div
              v-else
              class="no-image-placeholder"
            >
              <div class="placeholder-icon">
                📷
              </div>
              <p>暂无照片</p>
            </div>

            <!-- 点信息 -->
            <div class="point-info">
              <h2 class="point-title">
                {{ point.title || '未命名地点' }}
              </h2>

              <div class="info-section">
                <div class="info-label">
                  📍 坐标
                </div>
                <div class="info-value">
                  {{ point.lat?.toFixed(6) || 'N/A' }}°N, {{ point.lon?.toFixed(6) || 'N/A' }}°E
                </div>
              </div>

              <div
                v-if="point.description"
                class="info-section"
              >
                <div class="info-label">
                  📝 描述
                </div>
                <div class="info-value description">
                  {{ point.description }}
                </div>
              </div>

              <div
                v-if="point.time"
                class="info-section"
              >
                <div class="info-label">
                  🕐 时间
                </div>
                <div class="info-value">
                  {{ point.time }}
                </div>
              </div>

              <div
                v-if="hasImages"
                class="info-section"
              >
                <div class="info-label">
                  🖼️ 照片
                </div>
                <div class="info-value">
                  {{ imageCount }} 张
                </div>
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
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.point-detail-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
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
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  border-radius: 50%;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 10;
}

.close-btn:hover {
  background: #e94560;
  transform: rotate(90deg);
}

.detail-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 0;
  max-height: 90vh;
  overflow: hidden;
}

/* 图片查看器 */
.image-viewer {
  background: rgba(0, 0, 0, 0.3);
  padding: 60px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.main-image {
  max-width: 100%;
  max-height: 500px;
  object-fit: contain;
  border-radius: 12px;
  cursor: zoom-in;
  transition: transform 0.3s;
}

.main-image:hover {
  transform: scale(1.02);
}

.image-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px;
  background: rgba(233, 69, 96, 0.1);
  border-radius: 12px;
}

.nav-btn {
  width: 40px;
  height: 40px;
  background: rgba(233, 69, 96, 0.3);
  border: 2px solid #e94560;
  border-radius: 8px;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.nav-btn:hover:not(:disabled) {
  background: #e94560;
  transform: scale(1.1);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.image-counter {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  min-width: 60px;
  text-align: center;
}

.image-thumbnails {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  max-width: 100%;
}

.image-thumbnails::-webkit-scrollbar {
  height: 6px;
}

.image-thumbnails::-webkit-scrollbar-thumb {
  background: #e94560;
  border-radius: 3px;
}

.thumbnail {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.thumbnail:hover {
  border-color: rgba(233, 69, 96, 0.5);
  transform: scale(1.05);
}

.thumbnail.active {
  border-color: #e94560;
  box-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 无图片占位 */
.no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: rgba(0, 0, 0, 0.3);
  color: #b8c1ec;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-image-placeholder p {
  font-size: 16px;
  opacity: 0.7;
}

/* 点信息 */
.point-info {
  background: rgba(233, 69, 96, 0.05);
  padding: 60px 24px 24px;
  border-left: 2px solid #e94560;
  overflow-y: auto;
}

.point-info::-webkit-scrollbar {
  width: 6px;
}

.point-info::-webkit-scrollbar-thumb {
  background: #e94560;
  border-radius: 3px;
}

.point-title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
  line-height: 1.3;
}

.info-section {
  margin-bottom: 20px;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: #e94560;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  color: #b8c1ec;
  line-height: 1.6;
  font-family: 'SF Mono', Consolas, monospace;
}

.info-value.description {
  font-family: inherit;
  white-space: pre-wrap;
}

/* 过渡动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .point-detail-modal,
.modal-fade-leave-active .point-detail-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .point-detail-modal,
.modal-fade-leave-to .point-detail-modal {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .detail-content {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .image-viewer {
    padding: 60px 16px 16px;
  }

  .point-info {
    border-left: none;
    border-top: 2px solid #e94560;
    padding: 24px 16px;
  }

  .point-detail-modal {
    max-height: 95vh;
  }
}
</style>
