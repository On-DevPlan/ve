<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useComponentDiscovery } from '../utils/componentDiscovery'

const props = defineProps({
  componentId: {
    type: String,
    required: true
  }
})

const route = useRoute()
const { getComponent } = useComponentDiscovery()

const component = ref(null)
const loading = ref(true)
const error = ref(null)

// 加载组件
const loadComponent = async () => {
  loading.value = true
  error.value = null

  try {
    const componentData = getComponent(props.componentId || route.params.id)
    if (!componentData) {
      throw new Error(`Component not found: ${props.componentId || route.params.id}`)
    }

    // 动态导入组件
    const componentModule = await componentData.loader()
    component.value = {
      ...componentData,
      module: componentModule.default || componentModule
    }
  } catch (err) {
    error.value = err.message || 'Failed to load component'
    console.error('Failed to load component:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadComponent()
})
</script>

<template>
  <div class="component-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error">
      <div class="error-content">
        <p>加载失败: {{ error }}</p>
        <button @click="loadComponent" class="retry-btn">重试</button>
      </div>
    </div>

    <!-- 全屏组件展示 -->
    <div v-else-if="component" class="component-fullscreen">
      <component
        :is="component.module"
        v-bind="component.defaultProps"
      />
    </div>
  </div>
</template>

<style scoped>
.component-view {
  height: 100vh;
  width: 100vw;
  position: relative;
  background: #000;
}

.loading {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  text-align: center;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  padding: 40px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.error-content p {
  margin-bottom: 20px;
  font-size: 16px;
}

.retry-btn {
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.component-fullscreen {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>