<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  component: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const closeModal = () => {
  emit('close')
}

// 点击背景关闭
const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    closeModal()
  }
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="visible"
      class="modal-backdrop"
      @click="handleBackdropClick"
    >
      <div class="modal-content">
        <div class="modal-header">
          <div class="header-left">
            <span class="modal-icon">{{ component.config?.route?.meta?.icon || '📦' }}</span>
            <h2>{{ component.title }}</h2>
          </div>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="info-section">
            <h3>基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">名称：</span>
                <span class="value">{{ component.name }}</span>
              </div>
              <div class="info-item">
                <span class="label">版本：</span>
                <span class="value">v{{ component.version }}</span>
              </div>
              <div class="info-item">
                <span class="label">分组：</span>
                <span class="value">{{ component.group }}</span>
              </div>
              <div class="info-item">
                <span class="label">类别：</span>
                <span class="value">{{ component.category }}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h3>描述</h3>
            <p class="description">{{ component.description }}</p>
          </div>

          <div class="info-section">
            <h3>标签</h3>
            <div class="tags-container">
              <span
                v-for="tag in component.tags"
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div v-if="component.dependencies && component.dependencies.length > 0" class="info-section">
            <h3>依赖</h3>
            <div class="dependencies">
              <span
                v-for="dep in component.dependencies"
                :key="dep"
                class="dependency"
              >
                {{ dep }}
              </span>
            </div>
          </div>

          <div class="info-section">
            <h3>路由</h3>
            <div class="route-info">
              <code>{{ component.config?.route?.path || `/components/${component.id}` }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: #f8f8f8;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #e8e8e8;
  border-bottom: 1px solid #d0d0d0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  font-size: 28px;
}

.modal-header h2 {
  color: #404040;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #404040;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(80vh - 88px);
}

.info-section {
  margin-bottom: 24px;
}

.info-section:last-child {
  margin-bottom: 0;
}

.info-section h3 {
  color: #404040;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  border-bottom: 1px solid #d0d0d0;
  padding-bottom: 6px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
}

.label {
  color: #666;
  font-size: 14px;
  min-width: 60px;
}

.value {
  color: #404040;
  font-size: 14px;
  font-weight: 500;
}

.description {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: #e0e0e0;
  color: #666;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.dependencies {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dependency {
  background: #d4edda;
  color: #155724;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 500;
}

.route-info {
  background: #f1f1f1;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #888;
}

.route-info code {
  color: #404040;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-leave-active .modal-content {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from .modal-content {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

.modal-leave-to .modal-content {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}
</style>