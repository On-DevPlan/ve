<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useComponentDiscovery } from '../utils/componentDiscovery'
import ComponentInfoModal from '../components/ComponentInfoModal.vue'

const router = useRouter()
const { components, loading } = useComponentDiscovery()

// 信息弹窗状态
const selectedComponent = ref(null)
const showInfoModal = ref(false)

// 搜索状态 - 从 localStorage 恢复
const searchQuery = ref('')
const selectedGroup = ref(localStorage.getItem('selectedGroup') || 'all')

// 持久化分组选择
watch(selectedGroup, (val) => {
  localStorage.setItem('selectedGroup', val)
})

// 计算属性 - 过滤后的组件
const filteredComponents = computed(() => {
  let result = components.value

  if (selectedGroup.value !== 'all') {
    result = result.filter(comp => comp.group === selectedGroup.value)
  }

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

// 分组选项
const groupOptions = computed(() => {
  const groups = ['all']
  components.value.forEach(comp => {
    if (!groups.includes(comp.group)) {
      groups.push(comp.group)
    }
  })
  return groups
})

// 分组统计
const groupStats = computed(() => {
  const stats = {}
  components.value.forEach(comp => {
    if (!stats[comp.group]) {
      stats[comp.group] = { count: 0, icon: getGroupIcon(comp.group) }
    }
    stats[comp.group].count++
  })
  return Object.entries(stats).map(([name, data]) => ({
    name,
    count: data.count,
    icon: data.icon
  })).sort((a, b) => b.count - a.count)
})

function getGroupIcon(group) {
  const icons = {
    'Three.js': '🎨',
    'Basic': '📦',
    'Data': '📊',
    'DataTable': '📋',
    'Animation': '✨',
    'Effects': '🎭',
    'default': '📁'
  }
  return icons[group] || icons.default
}

const navigateToComponent = (component) => {
  router.push(component.route?.path || `/components/${component.id}`)
}

const showComponentInfo = (component, event) => {
  event.stopPropagation()
  selectedComponent.value = component
  showInfoModal.value = true
}

const closeInfoModal = () => {
  showInfoModal.value = false
  selectedComponent.value = null
}
</script>

<template>
  <div class="home-page">
    <!-- 简洁头部 -->
    <header class="header">
      <div class="header-main">
        <h1 class="title">组件中心</h1>
        <span class="subtitle">{{ filteredComponents.length }} 个组件</span>
      </div>

      <!-- 分组过滤 - 横向胶囊 -->
      <div class="group-pills">
        <button
          v-for="group in groupOptions"
          :key="group"
          class="pill"
          :class="{ active: selectedGroup === group }"
          @click="selectedGroup = group"
        >
          <span v-if="group !== 'all'">{{ getGroupIcon(group) }}</span>
          {{ group === 'all' ? '全部' : group }}
        </button>
      </div>
    </header>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索组件..."
        class="search-input"
      />
    </div>

    <!-- 内容区 -->
    <main class="content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredComponents.length === 0" class="empty">
        <div class="empty-icon">📭</div>
        <p>没有找到组件</p>
      </div>

      <!-- 组件网格 -->
      <div v-else class="grid">
        <div
          v-for="comp in filteredComponents"
          :key="comp.id"
          class="card"
          @click="navigateToComponent(comp)"
        >
          <div class="card-top">
            <span class="card-icon">{{ comp.route?.meta?.icon || '📦' }}</span>
            <span class="card-group">{{ comp.group }}</span>
          </div>
          <h3 class="card-title">{{ comp.title }}</h3>
          <p class="card-desc">{{ comp.description }}</p>
          <div class="card-tags">
            <span v-for="tag in comp.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </main>

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
  min-height: 100vh;
  background: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
}

/* 头部 */
.header {
  background: #fff;
  padding: 20px 24px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.header-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 14px;
  color: #86868b;
}

/* 分组胶囊 */
.group-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.group-pills::-webkit-scrollbar {
  display: none;
}

.pill {
  flex-shrink: 0;
  padding: 8px 16px;
  background: #f5f5f7;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  color: #1d1d1f;
  cursor: pointer;
  transition: all 0.2s;
}

.pill:hover {
  background: #e8e8ed;
}

.pill.active {
  background: #007aff;
  color: #fff;
}

/* 搜索栏 */
.search-bar {
  padding: 12px 24px;
  background: #fff;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  background: #f5f5f7;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
}

.search-icon {
  position: absolute;
  left: 40px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.5;
}

.search-input:focus {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0,122,255,0.2);
}

/* 内容区 */
.content {
  padding: 20px 24px;
}

.loading, .empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #86868b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

/* 网格 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 24px;
}

.card-group {
  font-size: 12px;
  color: #86868b;
  background: #f5f5f7;
  padding: 4px 10px;
  border-radius: 10px;
}

.card-title {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 8px 0;
}

.card-desc {
  font-size: 14px;
  color: #86868b;
  margin: 0 0 16px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  color: #007aff;
  background: rgba(0,122,255,0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

/* 加载动画 */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8ed;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
