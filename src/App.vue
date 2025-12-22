<script setup>
import { ref, computed, onMounted } from 'vue'

const components = ref([])
const activeComponent = ref(null)

// 自动发现组件列表
const discoveredComponents = computed(() => [
  { name: 'Barrage3D', component: () => import('./components/Barrage3D.vue'), description: '3D弹幕墙效果' }
])

// 切换组件
const switchComponent = (component) => {
  activeComponent.value = component
}

onMounted(() => {
  // 默认显示第一个组件
  if (discoveredComponents.value.length > 0) {
    switchComponent(discoveredComponents.value[0])
  }
})
</script>

<template>
  <div id="app">
    <!-- 侧边导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>组件演示</h2>
        <p class="subtitle">轻量级Demo项目</p>
      </div>
      <nav class="nav-list">
        <button
          v-for="comp in discoveredComponents"
          :key="comp.name"
          :class="['nav-item', { active: activeComponent?.name === comp.name }]"
          @click="switchComponent(comp)"
        >
          <span class="component-name">{{ comp.name }}</span>
          <span class="component-desc">{{ comp.description }}</span>
        </button>
      </nav>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <div class="component-viewer">
        <div v-if="activeComponent" class="component-wrapper">
          <Suspense>
            <component :is="activeComponent.component" />
            <template #fallback>
              <div class="loading">
                <div class="spinner"></div>
                <p>加载组件中...</p>
              </div>
            </template>
          </Suspense>
        </div>
        <div v-else class="empty-state">
          <p>请选择一个组件进行演示</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

.sidebar {
  width: 280px;
  background: #e8e8e8;
  border-right: 1px solid #d0d0d0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #d0d0d0;
  background: #e0e0e0;
}

.sidebar-header h2 {
  color: #404040;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  color: #666;
  font-size: 12px;
}

.nav-list {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-item:hover {
  background: #d8d8d8;
  border-color: #c0c0c0;
}

.nav-item.active {
  background: #d0d0d0;
  border-color: #b8b8b8;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.component-name {
  color: #404040;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.component-desc {
  color: #666;
  font-size: 12px;
}

.main-content {
  flex: 1;
  position: relative;
  background: #f0f0f0;
}

.component-viewer {
  width: 100%;
  height: 100%;
  position: relative;
}

.component-wrapper {
  width: 100%;
  height: 100%;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #d0d0d0;
  border-top: 3px solid #888;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 16px;
}
</style>
