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
const selectedTag = ref('all')

// 视图模式
const viewMode = ref('grid') // grid, list, compact

// 统计面板展开状态
const expandedPanels = ref({
  stats: true,
  groups: true,
  categories: true,
  tags: true,
  recent: true
})

// 计算属性 - 过滤后的组件
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

  // 按标签过滤
  if (selectedTag.value !== 'all') {
    result = result.filter(comp => comp.tags.includes(selectedTag.value))
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(comp =>
      comp.title.toLowerCase().includes(query) ||
      comp.description.toLowerCase().includes(query) ||
      comp.tags.some(tag => tag.toLowerCase().includes(query)) ||
      comp.name?.toLowerCase().includes(query)
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

// 类别选项
const categoryOptions = computed(() => {
  const categories = ['all']
  components.value.forEach(comp => {
    if (!categories.includes(comp.category)) {
      categories.push(comp.category)
    }
  })
  return categories
})

// 所有标签
const allTags = computed(() => {
  const tags = new Set()
  components.value.forEach(comp => {
    comp.tags.forEach(tag => tags.add(tag))
  })
  return Array.from(tags).sort()
})

// 标签选项
const tagOptions = computed(() => ['all', ...allTags.value])

// 分组统计
const groupStats = computed(() => {
  const stats = {}
  components.value.forEach(comp => {
    if (!stats[comp.group]) {
      stats[comp.group] = { count: 0, categories: new Set(), icon: getGroupIcon(comp.group) }
    }
    stats[comp.group].count++
    stats[comp.group].categories.add(comp.category)
  })
  return Object.entries(stats).map(([name, data]) => ({
    name,
    count: data.count,
    icon: data.icon,
    categories: Array.from(data.categories)
  })).sort((a, b) => b.count - a.count)
})

// 类别统计
const categoryStats = computed(() => {
  const stats = {}
  components.value.forEach(comp => {
    const key = `${comp.group}/${comp.category}`
    if (!stats[key]) {
      stats[key] = { group: comp.group, category: comp.category, count: 0 }
    }
    stats[key].count++
  })
  return Object.values(stats).sort((a, b) => b.count - a.count)
})

// 热门标签
const popularTags = computed(() => {
  const tagCounts = {}
  components.value.forEach(comp => {
    comp.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

// 最近添加的组件
const recentComponents = computed(() => {
  return [...components.value]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5)
})

// 总体统计
const overallStats = computed(() => ({
  total: components.value.length,
  groups: groupOptions.value.length - 1,
  categories: categoryOptions.value.length - 1,
  tags: allTags.value.length
}))

// 获取分组图标
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

// 获取类别颜色
function getCategoryColor(group, category) {
  const colors = {
    'Three.js': { 'Scene': '#4CAF50', 'Lighting': '#FFC107', 'Geometry': '#2196F3' },
    'Data': { 'Table': '#2383e2', 'Spreadsheet': '#107c41' },
    'default': '#787774'
  }
  return colors[group]?.[category] || colors.default
}

// 方法
const navigateToComponent = (component) => {
  router.push(component.config?.route?.path || `/components/${component.id}`)
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

const togglePanel = (panel) => {
  expandedPanels.value[panel] = !expandedPanels.value[panel]
}

const selectGroup = (group) => {
  selectedGroup.value = group
  selectedCategory.value = 'all'
  selectedTag.value = 'all'
}

const selectCategory = (category) => {
  selectedCategory.value = category
}

const selectTag = (tag) => {
  selectedTag.value = tag
}

onMounted(() => {
  // 组件已在App.vue中初始化
})
</script>

<template>
  <div class="home-page">
    <!-- 顶部头部 -->
    <header class="main-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <div class="logo-text">
            <h1>Vue 组件演示中心</h1>
            <p class="tagline">探索、学习、创建 - Vue 3 + Vite + Three.js</p>
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-stats">
          <div class="header-stat">
            <span class="stat-number">{{ overallStats.total }}</span>
            <span class="stat-label">组件</span>
          </div>
          <div class="header-stat">
            <span class="stat-number">{{ overallStats.groups }}</span>
            <span class="stat-label">分组</span>
          </div>
          <div class="header-stat">
            <span class="stat-number">{{ overallStats.categories }}</span>
            <span class="stat-label">类别</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 搜索和筛选栏 -->
    <section class="filters-section">
      <div class="search-wrapper">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索组件名称、描述、标签..."
            class="search-input"
          />
        </div>
        <div class="filter-pills">
          <button
            v-for="tag in popularTags.slice(0, 5)"
            :key="tag.tag"
            class="filter-pill"
            :class="{ active: selectedTag === tag.tag }"
            @click="selectTag(selectedTag === tag.tag ? 'all' : tag.tag)"
          >
            {{ tag.tag }} <span class="pill-count">{{ tag.count }}</span>
          </button>
        </div>
      </div>

      <div class="filter-controls">
        <select v-model="selectedGroup" class="filter-select" @change="selectGroup(selectedGroup)">
          <option value="all">📁 所有分组</option>
          <option v-for="group in groupOptions.slice(1)" :key="group" :value="group">
            {{ getGroupIcon(group) }} {{ group }}
          </option>
        </select>

        <select v-model="selectedCategory" class="filter-select" @change="selectCategory(selectedCategory)">
          <option value="all">📂 所有类别</option>
          <option v-for="category in categoryOptions.slice(1)" :key="category" :value="category">
            {{ category }}
          </option>
        </select>

        <select v-model="selectedTag" class="filter-select">
          <option value="all">🏷️ 所有标签</option>
          <option v-for="tag in tagOptions.slice(1)" :key="tag" :value="tag">
            {{ tag }}
          </option>
        </select>

        <div class="view-switcher">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'"
            title="网格视图"
          >
            ⊞
          </button>
          <button
            class="view-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
            title="列表视图"
          >
            ☰
          </button>
          <button
            class="view-btn"
            :class="{ active: viewMode === 'compact' }"
            @click="viewMode = 'compact'"
            title="紧凑视图"
          >
            ≡
          </button>
        </div>
      </div>
    </section>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧：组件网格 -->
      <main class="component-area">
        <!-- 当前筛选状态 -->
        <div v-if="selectedGroup !== 'all' || selectedCategory !== 'all' || selectedTag !== 'all' || searchQuery" class="filter-status">
          <span class="filter-text">
            筛选:
            <span v-if="selectedGroup !== 'all'" class="filter-chip">{{ getGroupIcon(selectedGroup) }} {{ selectedGroup }}</span>
            <span v-if="selectedCategory !== 'all'" class="filter-chip">📂 {{ selectedCategory }}</span>
            <span v-if="selectedTag !== 'all'" class="filter-chip">🏷️ {{ selectedTag }}</span>
            <span v-if="searchQuery" class="filter-chip">🔍 "{{ searchQuery }}"</span>
          </span>
          <button class="clear-filter" @click="selectedGroup = 'all'; selectedCategory = 'all'; selectedTag = 'all'; searchQuery = ''">
            清除筛选
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>加载组件中...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="filteredComponents.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p>没有找到匹配的组件</p>
          <button class="btn-secondary" @click="selectedGroup = 'all'; selectedCategory = 'all'; selectedTag = 'all'; searchQuery = ''">
            查看所有组件
          </button>
        </div>

        <!-- 组件网格 -->
        <div v-else :class="['component-grid', `view-${viewMode}`]">
          <div
            v-for="component in filteredComponents"
            :key="component.id"
            class="component-card"
            @click="navigateToComponent(component)"
          >
            <!-- 卡片头部 -->
            <div class="card-header">
              <div class="header-left">
                <span class="component-icon">{{ component.config?.route?.meta?.icon || '📦' }}</span>
                <div class="component-meta">
                  <span class="component-group">{{ component.group }}</span>
                  <span class="component-category">{{ component.category }}</span>
                </div>
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

            <!-- 卡片内容 -->
            <div class="card-content">
              <h3 class="component-title">{{ component.title }}</h3>
              <p class="component-description">{{ component.description }}</p>

              <!-- 依赖信息 -->
              <div v-if="component.dependencies?.length" class="dependencies">
                <span class="deps-label">依赖:</span>
                <span v-for="dep in component.dependencies.slice(0, 3)" :key="dep" class="dep-tag">
                  {{ dep }}
                </span>
                <span v-if="component.dependencies.length > 3" class="dep-more">
                  +{{ component.dependencies.length - 3 }}
                </span>
              </div>
            </div>

            <!-- 卡片底部 -->
            <div class="card-footer">
              <div class="tags">
                <span
                  v-for="tag in component.tags.slice(0, 4)"
                  :key="tag"
                  class="tag"
                  @click.stop="selectTag(tag)"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="card-arrow">→</div>
            </div>
          </div>
        </div>

        <!-- 分页指示 -->
        <div v-if="filteredComponents.length > 0" class="pagination-info">
          显示 {{ filteredComponents.length }} 个组件
        </div>
      </main>

      <!-- 右侧：信息面板 -->
      <aside class="sidebar">
        <!-- 总体统计 -->
        <div class="panel">
          <div class="panel-header" @click="togglePanel('stats')">
            <span class="panel-title">📊 统计概览</span>
            <span class="panel-toggle">{{ expandedPanels.stats ? '▼' : '▶' }}</span>
          </div>
          <div v-show="expandedPanels.stats" class="panel-content">
            <div class="stats-grid">
              <div class="stat-box stat-primary">
                <span class="stat-value">{{ overallStats.total }}</span>
                <span class="stat-label">总组件</span>
              </div>
              <div class="stat-box stat-success">
                <span class="stat-value">{{ overallStats.groups }}</span>
                <span class="stat-label">分组</span>
              </div>
              <div class="stat-box stat-info">
                <span class="stat-value">{{ overallStats.categories }}</span>
                <span class="stat-label">类别</span>
              </div>
              <div class="stat-box stat-warning">
                <span class="stat-value">{{ overallStats.tags }}</span>
                <span class="stat-label">标签</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分组统计 -->
        <div class="panel">
          <div class="panel-header" @click="togglePanel('groups')">
            <span class="panel-title">📁 按分组</span>
            <span class="panel-toggle">{{ expandedPanels.groups ? '▼' : '▶' }}</span>
          </div>
          <div v-show="expandedPanels.groups" class="panel-content">
            <div
              v-for="group in groupStats"
              :key="group.name"
              class="group-item"
              :class="{ active: selectedGroup === group.name }"
              @click="selectGroup(group.name)"
            >
              <span class="group-icon">{{ group.icon }}</span>
              <div class="group-info">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-count">{{ group.count }} 个组件</span>
              </div>
              <span class="group-arrow">→</span>
            </div>
          </div>
        </div>

        <!-- 类别统计 -->
        <div class="panel">
          <div class="panel-header" @click="togglePanel('categories')">
            <span class="panel-title">📂 按类别</span>
            <span class="panel-toggle">{{ expandedPanels.categories ? '▼' : '▶' }}</span>
          </div>
          <div v-show="expandedPanels.categories" class="panel-content">
            <div
              v-for="cat in categoryStats.slice(0, 8)"
              :key="cat.group + cat.category"
              class="category-item"
              :class="{ active: selectedGroup === cat.group && selectedCategory === cat.category }"
              @click="selectGroup(cat.group); selectCategory(cat.category)"
            >
              <div class="category-dot" :style="{ background: getCategoryColor(cat.group, cat.category) }"></div>
              <div class="category-info">
                <span class="category-name">{{ cat.category }}</span>
                <span class="category-group">{{ cat.group }}</span>
              </div>
              <span class="category-count">{{ cat.count }}</span>
            </div>
          </div>
        </div>

        <!-- 热门标签 -->
        <div class="panel">
          <div class="panel-header" @click="togglePanel('tags')">
            <span class="panel-title">🏷️ 热门标签</span>
            <span class="panel-toggle">{{ expandedPanels.tags ? '▼' : '▶' }}</span>
          </div>
          <div v-show="expandedPanels.tags" class="panel-content">
            <div
              v-for="tag in popularTags"
              :key="tag.tag"
              class="tag-item"
              :class="{ active: selectedTag === tag.tag }"
              @click="selectTag(tag.tag)"
            >
              <span class="tag-name">{{ tag.tag }}</span>
              <span class="tag-count">{{ tag.count }}</span>
            </div>
          </div>
        </div>

        <!-- 最近添加 -->
        <div class="panel">
          <div class="panel-header" @click="togglePanel('recent')">
            <span class="panel-title">🆕 最近添加</span>
            <span class="panel-toggle">{{ expandedPanels.recent ? '▼' : '▶' }}</span>
          </div>
          <div v-show="expandedPanels.recent" class="panel-content">
            <div
              v-for="comp in recentComponents"
              :key="comp.id"
              class="recent-item"
              @click="navigateToComponent(comp)"
            >
              <span class="recent-icon">{{ comp.config?.route?.meta?.icon || '📦' }}</span>
              <span class="recent-name">{{ comp.title }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

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
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 顶部头部 */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 30px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.tagline {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.header-stats {
  display: flex;
  gap: 20px;
}

.header-stat {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #2383e2;
}

.stat-label {
  font-size: 11px;
  color: #666;
}

/* 筛选区域 */
.filters-section {
  padding: 12px 30px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
}

.search-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.5;
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: #f7f7f7;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #2383e2;
  background: #ffffff;
}

.filter-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  background: #ffffff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-pill:hover {
  border-color: #2383e2;
  color: #2383e2;
}

.filter-pill.active {
  background: #2383e2;
  border-color: #2383e2;
  color: #ffffff;
}

.pill-count {
  opacity: 0.7;
  font-size: 11px;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #ffffff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.filter-select:focus {
  border-color: #2383e2;
}

.view-switcher {
  display: flex;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  padding: 10px 14px;
  border: none;
  background: #ffffff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.view-btn:hover {
  background: #f7f7f7;
}

.view-btn.active {
  background: #2383e2;
  color: #ffffff;
}

/* 主内容区 */
.main-content {
  display: flex;
  gap: 20px;
  padding: 12px 30px;
}

.component-area {
  flex: 1;
}

/* 筛选状态 */
.filter-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #e8f4fd;
  border: 1px solid #d0e7ff;
  border-radius: 8px;
  margin-bottom: 16px;
}

.filter-text {
  font-size: 13px;
  color: #1976d2;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255,255,255,0.8);
  border-radius: 4px;
  margin: 0 4px;
}

.clear-filter {
  padding: 4px 12px;
  border: none;
  background: rgba(255,255,255,0.8);
  border-radius: 4px;
  color: #1976d2;
  cursor: pointer;
  font-size: 12px;
}

.clear-filter:hover {
  background: #ffffff;
}

/* 组件网格 */
.component-grid {
  display: grid;
  gap: 20px;
  padding: 4px;
}

.view-grid {
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}

.view-list {
  grid-template-columns: 1fr;
}

.view-compact {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.component-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.component-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-bottom: 1px solid #f0f0f0;
}

.component-icon {
  font-size: 32px;
  display: block;
}

.component-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.component-group {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.component-category {
  font-size: 12px;
  color: #888;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.component-version {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 3px 8px;
  border-radius: 10px;
}

.info-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.info-btn:hover {
  background: #e0e0e0;
  transform: scale(1.1);
}

.card-content {
  padding: 16px;
}

.component-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.component-description {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.dependencies {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}

.deps-label {
  color: #888;
}

.dep-tag {
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 3px;
  color: #666;
}

.dep-more {
  color: #999;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafbfc;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 4px 10px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tag:hover {
  background: #e8e8e8;
  color: #2383e2;
}

.card-arrow {
  font-size: 18px;
  color: #ccc;
}

/* 分页信息 */
.pagination-info {
  padding: 12px 16px;
  text-align: center;
  color: #666;
  font-size: 13px;
}

/* 侧边栏 */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
  cursor: pointer;
  transition: background 0.2s;
}

.panel-header:hover {
  background: #f0f1f2;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.panel-toggle {
  font-size: 10px;
  color: #888;
}

.panel-content {
  padding: 12px;
}

/* 统计网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.stat-box {
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.stat-box .stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.stat-box .stat-label {
  font-size: 11px;
  color: #666;
}

.stat-primary { background: #e3f2fd; }
.stat-primary .stat-value { color: #1976d2; }

.stat-success { background: #e8f5e9; }
.stat-success .stat-value { color: #2e7d32; }

.stat-info { background: #fff3e0; }
.stat-info .stat-value { color: #f57c00; }

.stat-warning { background: #fce4ec; }
.stat-warning .stat-value { color: #c2185b; }

/* 分组列表 */
.group-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.group-item:hover {
  background: #f7f7f7;
}

.group-item.active {
  background: #e8f4fd;
}

.group-icon {
  font-size: 20px;
}

.group-info {
  flex: 1;
}

.group-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.group-count {
  font-size: 11px;
  color: #666;
}

.group-arrow {
  color: #ccc;
  font-size: 12px;
}

/* 类别列表 */
.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.category-item:hover {
  background: #f7f7f7;
}

.category-item.active {
  background: #e8f4fd;
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.category-info {
  flex: 1;
}

.category-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.category-group {
  font-size: 11px;
  color: #888;
}

.category-count {
  font-size: 12px;
  color: #666;
}

/* 标签列表 */
.tag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.tag-item:hover {
  background: #f7f7f7;
}

.tag-item.active {
  background: #e8f4fd;
}

.tag-name {
  font-size: 13px;
  color: #1a1a1a;
}

.tag-count {
  font-size: 11px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
}

/* 最近添加 */
.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.recent-item:hover {
  background: #f7f7f7;
}

.recent-icon {
  font-size: 20px;
}

.recent-name {
  font-size: 13px;
  color: #1a1a1a;
}

/* 状态 */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top: 3px solid #2383e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
</style>
