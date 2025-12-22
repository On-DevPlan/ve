<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useComponentDiscovery } from '../utils/componentDiscovery'

const props = defineProps({
  componentId: {
    type: String,
    required: true
  }
})

const route = useRoute()
const router = useRouter()
const { getComponent } = useComponentDiscovery()

const component = ref(null)
const loading = ref(true)
const error = ref(null)

// 计算属性
const componentConfig = computed(() => component.value?.config || {})

// 加载组件
const loadComponent = async () => {
  loading.value = true
  error.value = null

  try {
    const componentData = getComponent(props.componentId || route.params.id)
    if (!componentData) {
      throw new Error('Component not found')
    }

    // 动态导入组件
    const componentModule = await componentData.loader()
    component.value = {
      ...componentData,
      module: componentModule.default || componentModule
    }
  } catch (err) {
    error.value = err.message
    console.error('Failed to load component:', err)
  } finally {
    loading.value = false
  }
}

// 返回首页
const goBack = () => {
  router.push('/')
}

// 预览/演示切换
const activeTab = ref('demo')

// 组件配置编辑（开发模式）
const showConfig = ref(false)
const componentProps = ref({})

// 生命周期
onMounted(() => {
  loadComponent()
})

// 监听路由变化
onUnmounted(() => {
  // 清理资源
})
</script>

<template>
  <div class="component-view">
    <!-- 顶部导航栏 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        ← 返回列表
      </button>

      <div class="component-info" v-if="component">
        <h1>{{ component.title }}</h1>
        <p class="component-desc">{{ component.description }}</p>
        <div class="component-meta">
          <span class="version">v{{ component.version }}</span>
          <span class="group">{{ component.group }}</span>
          <span class="category">{{ component.category }}</span>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>加载组件中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error">
        <p>加载失败: {{ error }}</p>
        <button @click="loadComponent" class="retry-btn">重试</button>
      </div>

      <!-- 组件展示 -->
      <div v-else-if="component" class="component-display">
        <!-- 标签页 -->
        <div class="tabs">
          <button
            :class="['tab', { active: activeTab === 'demo' }]"
            @click="activeTab = 'demo'"
          >
            演示
          </button>
          <button
            :class="['tab', { active: activeTab === 'config' }]"
            @click="activeTab = 'config'"
            v-if="$DEV_MODE"
          >
            配置
          </button>
          <button
            :class="['tab', { active: activeTab === 'info' }]"
            @click="activeTab = 'info'"
          >
            信息
          </button>
        </div>

        <!-- 标签内容 -->
        <div class="tab-content">
          <!-- 演示标签页 -->
          <div v-if="activeTab === 'demo'" class="demo-panel">
            <div class="demo-container">
              <!-- 组件演示区域 -->
              <div class="demo-area" :style="componentConfig.preview?.demo?.style || {}">
                <component
                  :is="component.module"
                  v-bind="componentProps"
                  v-if="componentConfig.performance?.suspense !== false"
                >
                  <template #fallback>
                    <div class="demo-loading">
                      <div class="spinner"></div>
                    </div>
                  </template>
                </component>
                <component
                  :is="component.module"
                  v-bind="componentProps"
                  v-else
                />
              </div>

              <!-- 控制面板 -->
              <div class="control-panel" v-if="componentConfig.preview?.demo?.showControls">
                <h3>控制面板</h3>
                <div class="controls">
                  <button
                    v-for="prop in Object.keys(componentConfig.defaultProps || {})"
                    :key="prop"
                    class="control-btn"
                    @click="toggleProp(prop)"
                  >
                    {{ prop }}: {{ componentProps[prop] !== undefined ? componentProps[prop] : '默认' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 配置标签页（仅开发模式） -->
          <div v-else-if="activeTab === 'config' && $DEV_MODE" class="config-panel">
            <div class="config-section">
              <h3>组件配置</h3>
              <pre>{{ JSON.stringify(componentConfig, null, 2) }}</pre>
            </div>

            <div class="config-section">
              <h3>Props</h3>
              <pre>{{ JSON.stringify(componentProps, null, 2) }}</pre>
            </div>
          </div>

          <!-- 信息标签页 -->
          <div v-else-if="activeTab === 'info'" class="info-panel">
            <div class="info-section">
              <h3>基本信息</h3>
              <table class="info-table">
                <tr>
                  <td>名称</td>
                  <td>{{ component.name }}</td>
                </tr>
                <tr>
                  <td>标题</td>
                  <td>{{ component.title }}</td>
                </tr>
                <tr>
                  <td>版本</td>
                  <td>{{ component.version }}</td>
                </tr>
                <tr>
                  <td>分组</td>
                  <td>{{ component.group }}</td>
                </tr>
                <tr>
                  <td>类别</td>
                  <td>{{ component.category }}</td>
                </tr>
                <tr>
                  <td>作者</td>
                  <td>{{ component.author }}</td>
                </tr>
              </table>
            </div>

            <div class="info-section" v-if="component.tags?.length">
              <h3>标签</h3>
              <div class="tags">
                <span
                  v-for="tag in component.tags"
                  :key="tag"
                  class="tag"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <div class="info-section" v-if="component.resources">
              <h3>资源依赖</h3>
              <ul class="resource-list">
                <li v-for="dep in component.resources.dependencies || []" :key="dep">
                  {{ dep }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.component-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.header {
  background: #e8e8e8;
  padding: 20px 30px;
  border-bottom: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  gap: 20px;
}

.back-btn {
  background: none;
  border: 1px solid #c0c0c0;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #d8d8d8;
}

.component-info {
  flex: 1;
}

.component-info h1 {
  color: #404040;
  font-size: 24px;
  margin-bottom: 4px;
}

.component-desc {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.component-meta {
  display: flex;
  gap: 12px;
}

.version,
.group,
.category {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
}

.version {
  background: #e0e0e0;
  color: #666;
}

.group {
  background: #d0e0ff;
  color: #4060a0;
}

.category {
  background: #ffd0d0;
  color: #a04040;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.retry-btn {
  margin-top: 16px;
  padding: 8px 20px;
  background: #888;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.tabs {
  display: flex;
  background: #e0e0e0;
  border-bottom: 1px solid #d0d0d0;
}

.tab {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.tab:hover {
  background: #d8d8d8;
}

.tab.active {
  background: #fff;
  color: #404040;
  font-weight: 600;
}

.tab-content {
  flex: 1;
  overflow: auto;
  background: #fff;
}

.demo-panel {
  height: 100%;
}

.demo-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.demo-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.demo-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.control-panel {
  background: #f8f8f8;
  border-top: 1px solid #e0e0e0;
  padding: 20px;
}

.control-panel h3 {
  color: #404040;
  margin-bottom: 12px;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 6px 12px;
  background: #e0e0e0;
  border: 1px solid #c0c0c0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #d0d0d0;
}

.config-panel,
.info-panel {
  padding: 20px;
}

.config-section,
.info-section {
  margin-bottom: 30px;
}

.config-section h3,
.info-section h3 {
  color: #404040;
  margin-bottom: 12px;
}

.config-section pre {
  background: #f8f8f8;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}

.info-table {
  width: 100%;
  border-collapse: collapse;
}

.info-table td {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
}

.info-table td:first-child {
  background: #f8f8f8;
  font-weight: 600;
  width: 120px;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: #e0e0e0;
  color: #666;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.resource-list {
  list-style: none;
  padding: 0;
}

.resource-list li {
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}

.resource-list li:before {
  content: "📦 ";
  margin-right: 8px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top: 3px solid #888;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>