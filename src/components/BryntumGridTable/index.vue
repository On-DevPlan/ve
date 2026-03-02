<template>
  <div class="bryntum-container">
    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
      <div class="toolbar-left">
        <h1 class="app-title">🏢 企业级数据管理系统</h1>
      </div>
      <div class="toolbar-right">
        <button class="tool-btn" @click="expandAll" title="展开全部">
          <span>⬇️</span>
        </button>
        <button class="tool-btn" @click="collapseAll" title="折叠全部">
          <span>⬆️</span>
        </button>
        <div class="toolbar-divider"></div>
        <button class="tool-btn" @click="toggleView">
          <span>{{ viewIcon }}</span> {{ viewName }}
        </button>
        <button class="tool-btn tool-btn-primary" @click="addNode">
          <span>+</span> 新建
        </button>
      </div>
    </div>

    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <span v-if="!sidebarCollapsed">📁 组织架构</span>
        <button v-if="!sidebarCollapsed" class="collapse-btn" @click="sidebarCollapsed = true">◀</button>
        <button v-else class="collapse-btn" @click="sidebarCollapsed = false">▶</button>
      </div>
      <div class="sidebar-tree" v-if="!sidebarCollapsed">
        <div v-for="node in orgTree" :key="node.id" class="tree-node">
          <div class="tree-item" @click="selectNode(node)">
            <span class="tree-icon">{{ node.icon }}</span>
            <span>{{ node.name }}</span>
            <span class="tree-count">({{ node.count }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 过滤器栏 -->
      <div class="filter-bar">
        <div class="filter-group">
          <label>搜索:</label>
          <input v-model="searchQuery" class="filter-input" placeholder="输入关键词搜索...">
        </div>
        <div class="filter-group">
          <label>部门:</label>
          <select v-model="filterDepartment" class="filter-select">
            <option value="">全部</option>
            <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>状态:</label>
          <select v-model="filterStatus" class="filter-select">
            <option value="">全部</option>
            <option value="active">活跃</option>
            <option value="inactive">停用</option>
            <option value="pending">待审核</option>
          </select>
        </div>
        <div class="filter-spacer"></div>
        <div class="summary">
          共 {{ filteredData.length }} 条记录
        </div>
      </div>

      <!-- TreeGrid 视图 -->
      <div v-if="currentView === 'tree'" class="grid-container">
        <table class="bryntum-grid">
          <thead>
            <tr>
              <th class="col-expand" width="40"></th>
              <th v-for="col in columns" :key="col.field" :width="col.width">
                <div class="th-content">
                  <span>{{ col.title }}</span>
                  <span class="sort-icon" @click="sortBy(col.field)">⇅</span>
                </div>
              </th>
              <th class="col-actions" width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in displayData" :key="row.id" :class="{ 'group-row': row.isGroup, 'selected': row.selected }" :style="{ paddingLeft: (row.level * 20) + 'px' }">
              <td class="col-expand">
                <span v-if="row.hasChildren" class="expand-icon" @click="toggleExpand(row)">
                  {{ row.expanded ? '▼' : '▶' }}
                </span>
              </td>
              <td v-for="col in columns" :key="col.field">
                <span v-if="row.isGroup" class="group-cell">
                  <strong>{{ row[col.field] }}</strong>
                  <span class="group-count">({{ row.children?.length || 0 }})</span>
                </span>
                <input v-else-if="col.editable" v-model="row[col.field]" class="cell-input" @change="onCellEdit(row, col.field)">
                <span v-else>{{ formatValue(row[col.field], col) }}</span>
              </td>
              <td class="col-actions">
                <button v-if="!row.isGroup" class="action-link" @click="editRow(row)">编辑</button>
                <button v-if="!row.isGroup" class="action-link action-danger" @click="deleteRow(row.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card 视图 -->
      <div v-if="currentView === 'card'" class="card-container">
        <div v-for="row in flatFilteredData" :key="row.id" class="data-card" :class="'status-' + row.status">
          <div class="card-header">
            <h3>{{ row.name }}</h3>
            <span class="card-status">{{ getStatusLabel(row.status) }}</span>
          </div>
          <div class="card-body">
            <div class="card-row">
              <span class="label">部门:</span>
              <span>{{ row.department }}</span>
            </div>
            <div class="card-row">
              <span class="label">职位:</span>
              <span>{{ row.position }}</span>
            </div>
            <div class="card-row">
              <span class="label">邮箱:</span>
              <span>{{ row.email }}</span>
            </div>
            <div class="card-row">
              <span class="label">入职日期:</span>
              <span>{{ row.startDate }}</span>
            </div>
            <div class="card-row">
              <span class="label">绩效评分:</span>
              <div class="rating">
                <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= (row.rating || 0) }">★</span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button class="card-btn" @click="editRow(row)">编辑</button>
            <button class="card-btn card-btn-danger" @click="deleteRow(row.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- Chart 视图 -->
      <div v-if="currentView === 'chart'" class="chart-container">
        <div class="chart-tabs">
          <button class="chart-tab" :class="{ active: chartType === 'department' }" @click="chartType = 'department'">按部门统计</button>
          <button class="chart-tab" :class="{ active: chartType === 'status' }" @click="chartType = 'status'">按状态统计</button>
          <button class="chart-tab" :class="{ active: chartType === 'rating' }" @click="chartType = 'rating'">绩效分布</button>
        </div>
        <div class="chart-content">
          <div v-if="chartType === 'department'" class="bar-chart">
            <div v-for="item in departmentStats" :key="item.name" class="bar-item">
              <div class="bar-label">{{ item.name }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (item.count / maxCount * 100) + '%' }"></div>
              </div>
              <div class="bar-value">{{ item.count }}</div>
            </div>
          </div>
          <div v-if="chartType === 'status'" class="pie-stats">
            <div v-for="item in statusStats" :key="item.status" class="stat-item">
              <div class="stat-dot" :style="{ background: item.color }"></div>
              <span class="stat-label">{{ item.label }}</span>
              <span class="stat-value">{{ item.count }}</span>
            </div>
          </div>
          <div v-if="chartType === 'rating'" class="rating-chart">
            <div v-for="item in ratingStats" :key="item.rating" class="rating-bar">
              <span class="rating-label">{{ item.rating }} 星</span>
              <div class="rating-track">
                <div class="rating-fill" :style="{ width: (item.count / maxRatingCount * 100) + '%' }"></div>
              </div>
              <span class="rating-count">{{ item.count }} 人</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-dialog">
        <div class="modal-header">
          <h2>{{ editingRow?.id ? '编辑记录' : '新建记录' }}</h2>
          <button class="modal-close" @click="showEditModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>姓名 *</label>
            <input v-model="editingRow.name" class="form-input">
          </div>
          <div class="form-row">
            <label>部门 *</label>
            <select v-model="editingRow.department" class="form-select">
              <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>职位</label>
            <input v-model="editingRow.position" class="form-input">
          </div>
          <div class="form-row">
            <label>邮箱</label>
            <input v-model="editingRow.email" type="email" class="form-input">
          </div>
          <div class="form-row">
            <label>状态</label>
            <select v-model="editingRow.status" class="form-select">
              <option value="active">活跃</option>
              <option value="inactive">停用</option>
              <option value="pending">待审核</option>
            </select>
          </div>
          <div class="form-row">
            <label>绩效评分</label>
            <input v-model.number="editingRow.rating" type="number" min="1" max="5" class="form-input">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" @click="saveRow">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// 列定义
const columns = ref([
  { field: 'name', title: '姓名', width: 120, editable: true },
  { field: 'department', title: '部门', width: 120 },
  { field: 'position', title: '职位', width: 120, editable: true },
  { field: 'email', title: '邮箱', width: 200, editable: true },
  { field: 'startDate', title: '入职日期', width: 120 },
  { field: 'status', title: '状态', width: 100 },
  { field: 'rating', title: '绩效', width: 100 },
])

// 组织树
const orgTree = ref([
  { id: 1, name: '技术部', icon: '💻', count: 15 },
  { id: 2, name: '产品部', icon: '📦', count: 8 },
  { id: 3, name: '设计部', icon: '🎨', count: 6 },
  { id: 4, name: '市场部', icon: '📈', count: 10 },
  { id: 5, name: '人事部', icon: '👥', count: 4 },
])

// 部门列表
const departments = ['技术部', '产品部', '设计部', '市场部', '人事部']

// 示例数据（树形结构）
const treeData = ref([
  {
    id: 1, name: '技术部', department: '技术部', position: '部门', level: 0,
    isGroup: true, expanded: true, hasChildren: true, children: [
      { id: 11, name: '张三', department: '技术部', position: '前端工程师', email: 'zhangsan@company.com', startDate: '2023-01-15', status: 'active', rating: 4, level: 1 },
      { id: 12, name: '李四', department: '技术部', position: '后端工程师', email: 'lisi@company.com', startDate: '2022-06-01', status: 'active', rating: 5, level: 1 },
      { id: 13, name: '王五', department: '技术部', position: '全栈工程师', email: 'wangwu@company.com', startDate: '2023-08-20', status: 'pending', rating: 3, level: 1 },
    ]
  },
  {
    id: 2, name: '产品部', department: '产品部', position: '部门', level: 0,
    isGroup: true, expanded: true, hasChildren: true, children: [
      { id: 21, name: '赵六', department: '产品部', position: '产品经理', email: 'zhaoliu@company.com', startDate: '2022-03-10', status: 'active', rating: 4, level: 1 },
      { id: 22, name: '钱七', department: '产品部', position: '产品助理', email: 'qianqi@company.com', startDate: '2023-05-15', status: 'active', rating: 3, level: 1 },
    ]
  },
  {
    id: 3, name: '设计部', department: '设计部', position: '部门', level: 0,
    isGroup: true, expanded: false, hasChildren: true, children: [
      { id: 31, name: '孙八', department: '设计部', position: 'UI设计师', email: 'sunba@company.com', startDate: '2023-02-01', status: 'active', rating: 5, level: 1 },
      { id: 32, name: '周九', department: '设计部', position: 'UX设计师', email: 'zhoujiu@company.com', startDate: '2022-11-20', status: 'inactive', rating: 4, level: 1 },
    ]
  },
])

// 状态
const currentView = ref('tree')
const searchQuery = ref('')
const filterDepartment = ref('')
const filterStatus = ref('')
const sidebarCollapsed = ref(false)
const showEditModal = ref(false)
const editingRow = ref({})
const chartType = ref('department')

const views = ['tree', 'card', 'chart']
const viewIcons = { tree: '🌲', card: '📇', chart: '📊' }
const viewNames = { tree: '树形表格', card: '卡片视图', chart: '数据统计' }

// 扁平化数据
const flatData = computed(() => {
  const result = []
  function traverse(nodes) {
    nodes.forEach(node => {
      result.push(node)
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }
  traverse(treeData.value)
  return result
})

// 过滤后的扁平数据
const flatFilteredData = computed(() => {
  return flatData.value.filter(row => {
    if (row.isGroup) return false
    if (searchQuery.value && !JSON.stringify(row).toLowerCase().includes(searchQuery.value.toLowerCase())) {
      return false
    }
    if (filterDepartment.value && row.department !== filterDepartment.value) return false
    if (filterStatus.value && row.status !== filterStatus.value) return false
    return true
  })
})

// 树形显示数据
const displayData = computed(() => {
  const result = []

  function processNode(node, visible = true) {
    // 检查筛选条件
    let nodeVisible = visible
    if (searchQuery.value || filterDepartment.value || filterStatus.value) {
      if (node.isGroup) {
        // 检查子节点是否有符合条件的
        const hasVisibleChildren = hasVisibleDescendants(node)
        nodeVisible = hasVisibleChildren
      } else {
        if (searchQuery.value && !JSON.stringify(node).toLowerCase().includes(searchQuery.value.toLowerCase())) {
          nodeVisible = false
        }
        if (filterDepartment.value && node.department !== filterDepartment.value) nodeVisible = false
        if (filterStatus.value && node.status !== filterStatus.value) nodeVisible = false
      }
    }

    if (!nodeVisible) return

    result.push(node)

    if (node.children && node.expanded) {
      node.children.forEach(child => processNode(child, true))
    }
  }

  treeData.value.forEach(node => processNode(node))
  return result
})

const filteredData = computed(() => flatFilteredData.value)

// 统计数据
const departmentStats = computed(() => {
  const stats = {}
  flatData.value.forEach(row => {
    if (!row.isGroup && row.department) {
      stats[row.department] = (stats[row.department] || 0) + 1
    }
  })
  return Object.entries(stats).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const maxCount = computed(() => Math.max(...departmentStats.value.map(d => d.count), 1))

const statusStats = computed(() => {
  const stats = { active: 0, inactive: 0, pending: 0 }
  flatData.value.forEach(row => {
    if (!row.isGroup && row.status) {
      stats[row.status]++
    }
  })
  return [
    { status: 'active', label: '活跃', count: stats.active, color: '#4caf50' },
    { status: 'inactive', label: '停用', count: stats.inactive, color: '#9e9e9e' },
    { status: 'pending', label: '待审核', count: stats.pending, color: '#ff9800' },
  ]
})

const ratingStats = computed(() => {
  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  flatData.value.forEach(row => {
    if (!row.isGroup && row.rating) {
      stats[row.rating]++
    }
  })
  return Object.entries(stats).map(([rating, count]) => ({ rating: rating + ' 星', count }))
    .filter(s => s.count > 0)
})

const maxRatingCount = computed(() => Math.max(...ratingStats.value.map(r => r.count), 1))

const viewIcon = computed(() => viewIcons[currentView.value])
const viewName = computed(() => viewNames[currentView.value])

// 方法
function hasVisibleDescendants(node) {
  if (!node.children) return false
  return node.children.some(child => {
    if (child.isGroup) {
      return hasVisibleDescendants(child)
    }
    let visible = true
    if (searchQuery.value && !JSON.stringify(child).toLowerCase().includes(searchQuery.value.toLowerCase())) {
      visible = false
    }
    if (filterDepartment.value && child.department !== filterDepartment.value) visible = false
    if (filterStatus.value && child.status !== filterStatus.value) visible = false
    return visible
  })
}

function toggleExpand(row) {
  row.expanded = !row.expanded
}

function expandAll() {
  function expand(nodes) {
    nodes.forEach(node => {
      if (node.isGroup) {
        node.expanded = true
        if (node.children) expand(node.children)
      }
    })
  }
  expand(treeData.value)
}

function collapseAll() {
  function collapse(nodes) {
    nodes.forEach(node => {
      if (node.isGroup) {
        node.expanded = false
        if (node.children) collapse(node.children)
      }
    })
  }
  collapse(treeData.value)
}

function toggleView() {
  const idx = views.indexOf(currentView.value)
  currentView.value = views[(idx + 1) % views.length]
}

function addNode() {
  editingRow.value = {
    name: '',
    department: departments[0],
    position: '',
    email: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    rating: 3
  }
  showEditModal.value = true
}

function editRow(row) {
  editingRow.value = { ...row }
  showEditModal.value = true
}

function saveRow() {
  if (editingRow.value.id) {
    // 编辑现有记录
    const row = findRowById(editingRow.value.id)
    if (row) {
      Object.assign(row, editingRow.value)
    }
  } else {
    // 新建记录
    const newRow = {
      id: Date.now(),
      ...editingRow.value,
      level: 1
    }
    treeData.value[0].children.push(newRow)
  }
  showEditModal.value = false
}

function deleteRow(id) {
  function removeFrom(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        nodes.splice(i, 1)
        return true
      }
      if (nodes[i].children && removeFrom(nodes[i].children)) {
        return true
      }
    }
    return false
  }
  removeFrom(treeData.value)
}

function findRowById(id, nodes = treeData.value) {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findRowById(id, node.children)
      if (found) return found
    }
  }
  return null
}

function onCellEdit(row, field) {
  console.log('Cell edited:', row.id, field, row[field])
}

function sortBy(field) {
  // 简单排序实现
  console.log('Sort by:', field)
}

function formatValue(value, col) {
  if (col.field === 'status') {
    const labels = { active: '活跃', inactive: '停用', pending: '待审核' }
    return labels[value] || value
  }
  if (col.field === 'rating') {
    return '⭐'.repeat(value || 0)
  }
  return value
}

function getStatusLabel(status) {
  const labels = { active: '活跃', inactive: '停用', pending: '待审核' }
  return labels[status] || status
}

function selectNode(node) {
  filterDepartment.value = node.name === '全部' ? '' : node.name
}
</script>

<style scoped>
.bryntum-container {
  height: 100vh;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
}

/* 顶部工具栏 */
.top-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.app-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: rgba(255,255,255,0.3);
}

.tool-btn-primary {
  background: #4caf50;
  border-color: #4caf50;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,0.3);
}

/* 布局 */
.bryntum-container > .sidebar {
  width: 200px;
  background: #ffffff;
  border-right: 1px solid #e8e8e8;
  transition: width 0.3s;
}

.bryntum-container > .sidebar.collapsed {
  width: 48px;
}

.sidebar-header {
  padding: 16px;
  font-weight: 600;
  color: #37352f;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.collapse-btn {
  padding: 4px 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #787774;
}

.sidebar-tree {
  padding: 12px;
}

.tree-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s;
}

.tree-item:hover {
  background: #f7f7f5;
}

.tree-count {
  margin-left: auto;
  font-size: 12px;
  color: #787774;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 过滤器栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 13px;
  color: #787774;
  white-space: nowrap;
}

.filter-input, .filter-select {
  padding: 6px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 13px;
  min-width: 150px;
}

.filter-spacer {
  flex: 1;
}

.summary {
  font-size: 13px;
  color: #787774;
}

/* 表格容器 */
.grid-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.bryntum-grid {
  width: 100%;
  background: #ffffff;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.bryntum-grid thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.bryntum-grid th {
  background: linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%);
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #37352f;
  border-bottom: 2px solid #e8e8e8;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sort-icon {
  cursor: pointer;
  opacity: 0.3;
  font-size: 12px;
}

.sort-icon:hover {
  opacity: 0.6;
}

.bryntum-grid td {
  padding: 0;
  border-bottom: 1px solid #f0f0f0;
}

.group-row {
  background: #f7f7f5 !important;
  font-weight: 600;
}

.group-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-count {
  font-size: 12px;
  color: #787774;
  font-weight: normal;
}

.bryntum-grid tbody tr:hover {
  background: #f7f7f5;
}

.bryntum-grid tbody tr.selected {
  background: #e8f4fd;
}

.cell-input {
  width: 100%;
  height: 40px;
  border: none;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
}

.cell-input:focus {
  background: #f0f7ff;
}

.expand-icon {
  cursor: pointer;
  color: #787774;
  font-size: 10px;
}

.action-link {
  padding: 4px 8px;
  border: none;
  background: none;
  color: #2383e2;
  cursor: pointer;
  font-size: 12px;
}

.action-link:hover {
  text-decoration: underline;
}

.action-danger {
  color: #c62828;
}

/* 卡片视图 */
.card-container {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
}

.data-card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  overflow: hidden;
  transition: all 0.2s;
}

.data-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  transform: translateY(-4px);
}

.card-header {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
}

.card-status {
  padding: 4px 12px;
  background: rgba(255,255,255,0.2);
  border-radius: 12px;
  font-size: 12px;
}

.card-body {
  padding: 16px;
}

.card-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.card-row:last-child {
  border-bottom: none;
}

.card-row .label {
  width: 80px;
  color: #787774;
  font-size: 13px;
}

.rating {
  display: flex;
  gap: 2px;
}

.star {
  color: #e8e8e8;
}

.star.filled {
  color: #ffc107;
}

.card-footer {
  padding: 12px 16px;
  background: #f7f7f5;
  display: flex;
  gap: 8px;
}

.card-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.card-btn:hover {
  background: #f7f7f5;
}

.card-btn-danger {
  color: #c62828;
  border-color: #ffc8c8;
}

/* 图表视图 */
.chart-container {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.chart-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.chart-tab {
  padding: 10px 20px;
  border: none;
  background: #ffffff;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 14px;
  color: #787774;
  transition: all 0.15s;
}

.chart-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.chart-content {
  flex: 1;
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

/* 柱状图 */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bar-label {
  width: 100px;
  text-align: right;
  font-size: 14px;
  color: #37352f;
}

.bar-track {
  flex: 1;
  height: 32px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
}

.bar-value {
  width: 50px;
  text-align: center;
  font-size: 14px;
  color: #37352f;
  font-weight: 600;
}

/* 状态统计 */
.pie-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f7f7f5;
  border-radius: 8px;
}

.stat-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.stat-label {
  flex: 1;
  font-size: 15px;
  color: #37352f;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #37352f;
}

/* 评分图表 */
.rating-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rating-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rating-label {
  width: 60px;
  font-size: 14px;
  color: #37352f;
}

.rating-track {
  flex: 1;
  height: 28px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.rating-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffc107 0%, #ff9800 100%);
  transition: width 0.5s ease;
}

.rating-count {
  width: 60px;
  text-align: center;
  font-size: 14px;
  color: #37352f;
}

/* 对话框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #37352f;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f7f7f5;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  color: #787774;
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label {
  font-size: 13px;
  font-weight: 500;
  color: #37352f;
}

.form-input, .form-select {
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: #f7f7f5;
  border: 1px solid #e8e8e8;
  color: #37352f;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #ffffff;
}

.btn:hover {
  opacity: 0.9;
}
</style>
