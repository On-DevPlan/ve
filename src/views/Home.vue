<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useComponentDiscovery } from '../utils/componentDiscovery'
import ComponentInfoModal from '../components/ComponentInfoModal.vue'

const router = useRouter()
const { components, groups, loading } = useComponentDiscovery()

// 信息弹窗状态
const selectedComponent = ref(null)
const showInfoModal = ref(false)

// 搜索状态
const searchQuery = ref('')
const selectedGroup = ref('all')
const selectedCategory = ref('all')

// 计算属性
const filteredComponents = computed(() => {
  let result = components.value

  // 按分组过滤
  if (selectedGroup.value !== 'all') {
    result = result.filter(comp => comp.group === selectedGroup.value)
  }

  // 按类别过滤
  if (selectedCategory.value !== 'all') {
    result = result.filter(comp => comp.category === selectedCategory.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(comp =>
      comp.title.toLowerCase().includes(query) ||
      comp.description.toLowerCase().includes(query) ||
      comp.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  return result
})

const groupOptions = computed(() => {
  const groups = ['all']
  components.value.forEach(comp => {
    if (!groups.includes(comp.group)) {
      groups.push(comp.group)
    }
  })
  return groups
})

const categoryOptions = computed(() => {
  const categories = ['all']
  const currentGroup = selectedGroup.value
  if (currentGroup === 'all') {
    components.value.forEach(comp => {
      if (!categories.includes(comp.category)) {
        categories.push(comp.category)
      }
    })
  } else {
    components.value
      .filter(comp => comp.group === currentGroup)
      .forEach(comp => {
        if (!categories.includes(comp.category)) {
          categories.push(comp.category)
        }
      })
  }
  return categories
})

// 方法
const navigateToComponent = (component) => {
  router.push(`/components/${component.id}`)
}

const getComponentUrl = (component) => {
  return component.config?.route?.path || `/components/${component.id}`
}

const showComponentInfo = (component, event) => {
  event.stopPropagation() // 阻止事件冒泡，避免触发卡片点击
  selectedComponent.value = component
  showInfoModal.value = true
}

const closeInfoModal = () => {
  showInfoModal.value = false
  selectedComponent.value = null
}

onMounted(() => {
  // 组件已在App.vue中初始化
})
</script>

<template>
  <div class="home-page">
    <!-- 头部 -->
    <header class="header">
      <div class="header-content">
        <h1>组件演示中心</h1>
        <p class="subtitle">探索各种Vue组件和效果演示</p>
      </div>
    </header>

    <!-- 搜索和筛选栏 -->
    <section class="filters">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索组件..."
          class="search-input"
        />
        <span class="search-icon">🔍</span>
      </div>

      <div class="filter-controls">
        <select v-model="selectedGroup" class="filter-select">
          <option v-for="group in groupOptions" :key="group" :value="group">
            {{ group === 'all' ? '所有分组' : group }}
          </option>
        </select>

        <select v-model="selectedCategory" class="filter-select">
          <option v-for="category in categoryOptions" :key="category" :value="category">
            {{ category === 'all' ? '所有类别' : category }}
          </option>
        </select>
      </div>
    </section>

    <!-- 组件网格 -->
    <main class="component-grid">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载组件中...</p>
      </div>

      <div v-else-if="filteredComponents.length === 0" class="empty-state">
        <p>没有找到匹配的组件</p>
      </div>

      <div v-else class="grid-container">
        <div
          v-for="component in filteredComponents"
          :key="component.id"
          class="component-card"
          @click="navigateToComponent(component)"
        >
          <div class="card-header">
            <div class="header-left">
              <span class="component-icon">{{ component.config?.route?.meta?.icon || '📦' }}</span>
            </div>
            <div class="header-right">
              <span class="component-version">v{{ component.version }}</span>
              <button
                class="info-btn"
                @click="showComponentInfo(component, $event)"
                title="查看详细信息"
              >
                ℹ️
              </button>
            </div>
          </div>

          <h3 class="component-title">{{ component.title }}</h3>
          <p class="component-description">{{ component.description }}</p>

          <div class="card-footer">
            <div class="footer-left">
              <span class="component-group">{{ component.group }}</span>
            </div>
            <div class="footer-right">
              <div class="component-tags">
                <span
                  v-for="tag in component.tags.slice(0, 3)"
                  :key="tag"
                  class="tag"
                >
                  {{ tag }}
                </span>
                <span v-if="component.tags.length > 3" class="tag-more">
                  +{{ component.tags.length - 3 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 侧边栏统计 -->
    <aside class="sidebar">
      <div class="stats">
        <h3>统计信息</h3>
        <div class="stat-item">
          <span class="stat-label">总组件数：</span>
          <span class="stat-value">{{ components.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">分组数：</span>
          <span class="stat-value">{{ groupOptions.length - 1 }}</span>
        </div>
      </div>

      <div class="quick-links">
        <h3>快速链接</h3>
        <a href="#" class="link">关于项目</a>
        <a href="#" class="link">贡献指南</a>
        <a href="#" class="link">API文档</a>
      </div>
    </aside>

    <!-- 信息弹窗 -->
    <ComponentInfoModal
      :visible="showInfoModal"
      :component="selectedComponent"
      @close="closeInfoModal"
    />
  </div>
</template>

<style scoped>
.home-page {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: auto auto 1fr;
  height: 100vh;
  gap: 20px;
  padding: 20px;
  background: #f5f5f5;
}

.header {
  grid-column: 1 / -1;
  background: #e8e8e8;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content h1 {
  color: #404040;
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 16px;
}

.filters {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: #e8e8e8;
  border-radius: 8px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 16px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #888;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
}

.filter-controls {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}

.component-grid {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.component-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.component-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: #c0c0c0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.component-icon {
  font-size: 24px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.component-version {
  font-size: 12px;
  color: #999;
  background: #e8e8e8;
  padding: 4px 8px;
  border-radius: 12px;
}

.info-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
}

.info-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(1.1);
}

.component-title {
  color: #404040;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.component-description {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.footer-left {
  display: flex;
  align-items: center;
}

.component-group {
  font-size: 12px;
  color: #888;
  background: #e0e0e0;
  padding: 4px 10px;
  border-radius: 4px;
}

.footer-right {
  display: flex;
  align-items: center;
}

.component-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  color: #666;
  background: #e8e8e8;
  padding: 2px 8px;
  border-radius: 4px;
}

.tag-more {
  font-size: 11px;
  color: #999;
}

.sidebar {
  background: #e8e8e8;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.stats h3,
.quick-links h3 {
  color: #404040;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

.stat-value {
  font-weight: 600;
  color: #404040;
}

.link {
  display: block;
  color: #666;
  text-decoration: none;
  padding: 8px 0;
  border-bottom: 1px solid #d0d0d0;
  transition: color 0.2s;
}

.link:hover {
  color: #404040;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
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