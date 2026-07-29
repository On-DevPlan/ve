// gis-user 组件的站点详情弹窗。
// 复刻自 ve 仓库 huang/gis_usr/PointDetail.vue,事件命名改为 camelCase。

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface DetailPoint {
  id?: string | number;
  lon?: number;
  lat?: number;
  title?: string;
  description?: string;
  images?: string[];
  time?: string;
}

interface Props {
  show?: boolean;
  point?: DetailPoint | null;
}
const props = withDefaults(defineProps<Props>(), {
  show: false,
  point: null,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'viewImage', imageUrl: string, event: MouseEvent): void;
}>();

const currentImageIndex = ref(0);

watch(() => props.point, () => {
  currentImageIndex.value = 0;
});

const currentImage = computed(() => {
  if (!props.point || !props.point.images || props.point.images.length === 0) {
    return null;
  }
  return props.point.images[currentImageIndex.value];
});

const imageCount = computed(() => {
  if (!props.point || !props.point.images) return 0;
  return props.point.images.length;
});

const hasImages = computed(() => imageCount.value > 0);

const imageList = computed(() => props.point?.images || []);

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--;
  } else {
    currentImageIndex.value = imageCount.value - 1;
  }
};

const nextImage = () => {
  if (currentImageIndex.value < imageCount.value - 1) {
    currentImageIndex.value++;
  } else {
    currentImageIndex.value = 0;
  }
};

const selectImage = (index: number) => {
  currentImageIndex.value = index;
};

const handleClose = () => emit('close');

const handleViewImage = (imageUrl: string, event: MouseEvent) => {
  emit('viewImage', imageUrl, event);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return;
  if (event.key === 'Escape') {
    handleClose();
  } else if (event.key === 'ArrowLeft') {
    prevImage();
  } else if (event.key === 'ArrowRight') {
    nextImage();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="gisusr-modal">
      <div
        v-if="show"
        class="gisusr-modal-overlay"
        @click="handleClose"
      >
        <div
          class="gisusr-modal"
          @click.stop
        >
          <button
            class="gisusr-close-btn"
            @click="handleClose"
          >
            ×
          </button>

          <div class="gisusr-detail">
            <div
              v-if="hasImages"
              class="gisusr-viewer"
            >
              <div class="gisusr-image-display">
                <img
                  v-if="currentImage"
                  :src="currentImage"
                  :alt="point.title"
                  class="gisusr-main-image"
                  @click="handleViewImage(currentImage, $event)"
                >
                <div
                  v-else
                  class="gisusr-no-image"
                >
                  暂无图片
                </div>
              </div>

              <div
                v-if="imageCount > 1"
                class="gisusr-image-nav"
              >
                <button
                  class="gisusr-nav-btn"
                  @click="prevImage"
                >
                  ‹
                </button>
                <span class="gisusr-image-counter">{{ currentImageIndex + 1 }} / {{ imageCount }}</span>
                <button
                  class="gisusr-nav-btn"
                  @click="nextImage"
                >
                  ›
                </button>
              </div>

              <div
                v-if="imageCount > 1"
                class="gisusr-thumbnails"
              >
                <div
                  v-for="(img, index) in imageList"
                  :key="index"
                  class="gisusr-thumb"
                  :class="{ active: index === currentImageIndex }"
                  @click="selectImage(index)"
                >
                  <img
                    :src="img"
                    :alt="`${point.title} ${index + 1}`"
                  >
                </div>
              </div>
            </div>

            <div class="gisusr-info">
              <h2>{{ point?.title || '未命名地点' }}</h2>

              <div class="gisusr-info-section">
                <div class="gisusr-info-label">
                  坐标
                </div>
                <div class="gisusr-info-value">
                  {{ point?.lat?.toFixed(6) }}°N, {{ point?.lon?.toFixed(6) }}°E
                </div>
              </div>

              <div
                v-if="point?.time"
                class="gisusr-info-section"
              >
                <div class="gisusr-info-label">
                  时间
                </div>
                <div class="gisusr-info-value">
                  {{ point.time }}
                </div>
              </div>

              <div
                v-if="point?.description"
                class="gisusr-info-section"
              >
                <div class="gisusr-info-label">
                  描述
                </div>
                <div class="gisusr-info-value gisusr-info-description">
                  {{ point.description }}
                </div>
              </div>

              <div
                v-if="hasImages"
                class="gisusr-info-section"
              >
                <div class="gisusr-info-label">
                  照片
                </div>
                <div class="gisusr-info-value">
                  {{ imageCount }} 张
                </div>
              </div>

              <div class="gisusr-shortcuts">
                <div class="gisusr-hint-item">
                  ← → 切换图片
                </div>
                <div class="gisusr-hint-item">
                  ESC 关闭
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
.gisusr-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}
.gisusr-modal {
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
.gisusr-close-btn {
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
}
.gisusr-close-btn:hover {
  background: rgba(233, 69, 96, 0.4);
  transform: rotate(90deg);
}
.gisusr-detail {
  display: flex;
  gap: 0;
  max-height: 90vh;
  overflow-y: auto;
}
.gisusr-viewer {
  flex: 1.5;
  background: #0f0f1e;
  display: flex;
  flex-direction: column;
}
.gisusr-image-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 20px;
}
.gisusr-main-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 12px;
  cursor: pointer;
}
.gisusr-main-image:hover {
  transform: scale(1.02);
}
.gisusr-no-image {
  color: #b8c1ec;
  font-size: 16px;
}
.gisusr-image-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 16px;
}
.gisusr-nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.2);
  border: 2px solid #e94560;
  color: #e94560;
  font-size: 20px;
  cursor: pointer;
}
.gisusr-nav-btn:hover {
  background: rgba(233, 69, 96, 0.4);
}
.gisusr-image-counter {
  color: #b8c1ec;
  font-size: 14px;
  font-weight: 600;
}
.gisusr-thumbnails {
  display: flex;
  gap: 8px;
  padding: 0 20px 20px;
  overflow-x: auto;
  justify-content: center;
}
.gisusr-thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  flex-shrink: 0;
}
.gisusr-thumb:hover {
  border-color: rgba(233, 69, 96, 0.5);
}
.gisusr-thumb.active {
  border-color: #e94560;
}
.gisusr-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gisusr-info {
  flex: 1;
  padding: 40px 30px;
  background: linear-gradient(180deg, #16213e 0%, #1a1a2e 100%);
  border-left: 2px solid #e94560;
  min-width: 300px;
}
.gisusr-info h2 {
  margin: 0 0 24px 0;
  font-size: 24px;
  color: #e94560;
  font-weight: 600;
}
.gisusr-info-section {
  margin-bottom: 20px;
}
.gisusr-info-label {
  color: #b8c1ec;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.gisusr-info-value {
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
}
.gisusr-info-description {
  white-space: pre-wrap;
}
.gisusr-shortcuts {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(233, 69, 96, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gisusr-hint-item {
  color: #b8c1ec;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.gisusr-hint-item::before {
  content: '⌨️';
}
@media (max-width: 768px) {
  .gisusr-detail {
    flex-direction: column;
  }
  .gisusr-info {
    border-left: none;
    border-top: 2px solid #e94560;
    min-width: auto;
  }
  .gisusr-image-display {
    max-height: 40vh;
  }
}
.gisusr-modal-enter-active,
.gisusr-modal-leave-active {
  transition: opacity 0.3s;
}
.gisusr-modal-enter-active .gisusr-modal,
.gisusr-modal-leave-active .gisusr-modal {
  transition: transform 0.3s, opacity 0.3s;
}
.gisusr-modal-enter-from,
.gisusr-modal-leave-to {
  opacity: 0;
}
.gisusr-modal-enter-from .gisusr-modal,
.gisusr-modal-leave-to .gisusr-modal {
  transform: scale(0.9);
  opacity: 0;
}
</style>
