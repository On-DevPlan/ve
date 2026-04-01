<template>
  <div class="virtual-grid-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="title">⚡ 高性能虚拟表格</h2>
        <span class="subtitle">{{ data.length.toLocaleString() }} 行 × {{ columns.length }} 列</span>
      </div>
      <div class="toolbar-right">
        <button class="btn" @click="addRows(1000)" title="添加1000行">
          + 1K
        </button>
        <button class="btn" @click="addRows(10000)" title="添加10000行">
          + 10K
        </button>
        <button class="btn" @click="addRows(100000)" title="添加100000行">
          + 100K
        </button>
        <div class="divider"></div>
        <button class="btn" @click="clearData" title="清空数据">
          🗑️ 清空
        </button>
        <button class="btn" @click="resetData" title="重置数据">
          🔄 重置
        </button>
        <div class="divider"></div>
        <button class="btn btn-primary" @click="exportData">
          📥 导出
        </button>
      </div>
    </div>

    <!-- 性能统计 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总行数:</span>
        <span class="stat-value">{{ data.length.toLocaleString() }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">可见行:</span>
        <span class="stat-value">{{ visibleRowCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">渲染时间:</span>
        <span class="stat-value">{{ renderTime }}ms</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">滚动位置:</span>
        <span class="stat-value">第 {{ Math.floor(scrollTop / rowHeight) + 1 }} 行</span>
      </div>
    </div>

    <!-- 虚拟滚动表格 -->
    <div class="table-wrapper" ref="wrapperRef" @scroll="handleScroll">
      <!-- 表头 (固定) -->
      <div class="table-header" :style="{ width: tableWidth + 'px' }">
        <div class="header-checkbox" :style="{ width: '50px' }">
          <input type="checkbox" v-model="selectAll" @change="toggleSelectAll">
        </div>
        <div
          v-for="col in columns"
          :key="col.prop"
          class="header-cell"
          :style="{ width: col.size + 'px' }"
          :class="{ sortable: col.sortable }"
          @click="col.sortable && sortBy(col.prop)"
        >
          <span class="header-text">{{ col.name }}</span>
          <span v-if="col.sortable && sortField === col.prop" class="sort-icon">
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </span>
          <span v-else-if="col.sortable" class="sort-icon-placeholder">⇅</span>
        </div>
        <div class="header-actions" :style="{ width: '80px' }">操作</div>
      </div>

      <!-- 表体 (虚拟滚动) -->
      <div class="table-body" :style="{ height: totalHeight + 'px', width: tableWidth + 'px' }">
        <div
          v-for="row in visibleRows"
          :key="row.id"
          class="table-row"
          :style="{ transform: `translateY(${row._offset}px)`, width: tableWidth + 'px' }"
          :class="{ selected: row.selected }"
          @click="selectRow(row)"
        >
          <!-- 复选框 -->
          <div class="cell checkbox-cell" :style="{ width: '50px' }" @click.stop>
            <input type="checkbox" v-model="row.selected">
          </div>

          <!-- 数据单元格 -->
          <div
            v-for="col in columns"
            :key="col.prop"
            class="cell"
            :style="{ width: col.size + 'px' }"
            :class="getCellClass(col, row)"
          >
            <!-- 自定义渲染 -->
            <template v-if="col.render">
              <component :is="col.render(row[col.prop], row, col)" />
            </template>
            <!-- 默认文本 -->
            <template v-else-if="!editingCell || editingCell.id !== row.id + '-' + col.prop">
              {{ formatCellValue(row[col.prop], col) }}
            </template>
            <!-- 编辑模式 -->
            <input
              v-else
              :ref="el => editingCell?.id === row.id + '-' + col.prop ? (editInputRef = el) : null"
              v-model="editingCell.value"
              class="cell-editor"
              @blur="finishEditing"
              @keydown.enter="finishEditing"
              @keydown.esc="cancelEditing"
              @click.stop
            >
          </div>

          <!-- 操作列 -->
          <div class="cell actions-cell" :style="{ width: '80px' }" @click.stop>
            <button class="action-btn" @click="editRow(row)">✏️</button>
            <button class="action-btn action-btn-danger" @click="deleteRow(row.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 滚动条指示器 -->
    <div class="scroll-indicator" v-if="showScrollIndicator">
      快速滚动中... (显示 {{ visibleRowCount }} / {{ data.length.toLocaleString() }} 行)
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, h } from 'vue'

// 配置
const rowHeight = 40
const bufferRows = 5 // 上下缓冲行数

// 列定义
const columns = ref([
  {
    prop: 'id',
    name: 'ID',
    size: 70,
    sortable: true,
  },
  {
    prop: 'name',
    name: '任务名称',
    size: 150,
    sortable: true,
  },
  {
    prop: 'category',
    name: '类别',
    size: 100,
    sortable: true,
    render: (value) => h('span', {
      class: 'category-tag',
      style: { background: getCategoryColor(value) }
    }, value)
  },
  {
    prop: 'status',
    name: '状态',
    size: 100,
    sortable: true,
    render: (value) => h('span', {
      class: ['status-badge', `status-${value}`]
    }, value)
  },
  {
    prop: 'priority',
    name: '优先级',
    size: 80,
    sortable: true,
    render: (value) => h('span', {
      class: ['priority-tag', `priority-${value}`]
    }, value)
  },
  {
    prop: 'progress',
    name: '进度',
    size: 150,
    render: (value) => h('div', { class: 'progress-cell' }, [
      h('input', {
        type: 'number',
        value: value,
        min: 0,
        max: 100,
        class: 'progress-input',
        onChange: (e) => { e.target.value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }
      }),
      h('div', { class: 'progress-track' }, [
        h('div', { class: 'progress-fill', style: { width: Math.min(100, Math.max(0, value || 0)) + '%' } })
      ])
    ])
  },
  {
    prop: 'assignee',
    name: '负责人',
    size: 100,
  },
  {
    prop: 'hours',
    name: '工时',
    size: 80,
    sortable: true,
    render: (value) => h('span', { class: 'hours-value' }, value + 'h')
  },
  {
    prop: 'deadline',
    name: '截止日期',
    size: 120,
    sortable: true,
  },
  {
    prop: 'createdAt',
    name: '创建时间',
    size: 160,
    sortable: true,
  },
])

// 数据
const data = ref([])
const wrapperRef = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const tableWidth = computed(() => 50 + columns.value.reduce((sum, col) => sum + col.size, 0) + 80)

// 排序
const sortField = ref('')
const sortOrder = ref('asc')

// 选择
const selectAll = ref(false)
const selectedRows = computed(() => data.value.filter(r => r.selected))

// 编辑
const editingCell = ref(null)
const editInputRef = ref(null)

// 性能
const renderTime = ref(0)
const showScrollIndicator = ref(false)
let scrollTimeout = null

// 生成示例数据
const generateData = (count, startId = 1) => {
  const statuses = ['待处理', '进行中', '已完成', '已取消']
  const priorities = ['低', '中', '高', '紧急']
  const categories = ['开发', '设计', '测试', '运维', '产品', '文档']
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']
  const tasks = ['代码审查', '需求分析', 'UI设计', '后端开发', '前端开发', 'API设计', '数据库优化', '单元测试', '集成测试', '部署上线', 'Bug修复', '性能优化', '文档编写', '会议']

  const startTime = performance.now()
  const result = Array.from({ length: count }, (_, i) => {
    const id = startId + i
    const category = categories[i % categories.length]
    return {
      id,
      name: `${tasks[i % tasks.length]}-${id}`,
      category,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      progress: Math.floor(Math.random() * 101),
      assignee: names[i % names.length],
      hours: Math.floor(Math.random() * 40) + 1,
      deadline: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
      selected: false,
    }
  })
  renderTime.value = Math.round(performance.now() - startTime)
  return result
}

// 初始化数据
data.value = generateData(1000)

// 计算属性
const totalHeight = computed(() => data.value.length * rowHeight)

const visibleRowCount = computed(() => {
  return Math.min(Math.ceil(viewportHeight.value / rowHeight) + bufferRows * 2, data.value.length)
})

// 可见行（虚拟滚动核心）
const visibleRows = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / rowHeight) - bufferRows)
  const end = Math.min(data.value.length, start + visibleRowCount.value)

  return data.value.slice(start, end).map((row, index) => ({
    ...row,
    _offset: (start + index) * rowHeight,
  }))
})

// 方法
function handleScroll(e) {
  scrollTop.value = e.target.scrollTop
  viewportHeight.value = e.target.clientHeight

  // 显示滚动指示器
  showScrollIndicator.value = true
  clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    showScrollIndicator.value = false
  }, 500)
}

function addRows(count) {
  const startId = data.value.length > 0 ? Math.max(...data.value.map(r => r.id)) + 1 : 1
  const newRows = generateData(count, startId)
  data.value = [...data.value, ...newRows]
}

function clearData() {
  data.value = []
}

function resetData() {
  data.value = generateData(1000)
  selectAll.value = false
}

function sortBy(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }

  const startTime = performance.now()
  data.value.sort((a, b) => {
    let aVal = a[field]
    let bVal = b[field]

    // 数字排序
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal
    }

    // 字符串排序
    aVal = String(aVal || '')
    bVal = String(bVal || '')
    const result = aVal.localeCompare(bVal, 'zh-CN')
    return sortOrder.value === 'asc' ? result : -result
  })
  renderTime.value = Math.round(performance.now() - startTime)
}

function selectRow(row) {
  row.selected = !row.selected
}

function toggleSelectAll() {
  data.value.forEach(row => row.selected = selectAll.value)
}

function editRow(row) {
  alert(`编辑行: ${row.name}`)
}

function deleteRow(id) {
  const index = data.value.findIndex(r => r.id === id)
  if (index !== -1) {
    data.value.splice(index, 1)
  }
}

function formatCellValue(value, col) {
  if (value === null || value === undefined) return ''
  if (col.prop === 'progress') return value + '%'
  return String(value)
}

function getCellClass(col, row) {
  const classes = []
  if (col.prop === 'status') {
    classes.push('cell-status', `status-${row.status}`)
  }
  if (col.prop === 'priority') {
    classes.push('cell-priority', `priority-${row.priority}`)
  }
  return classes.join(' ')
}

function getCategoryColor(category) {
  const colors = {
    '开发': '#e3f2fd',
    '设计': '#f3e5f5',
    '测试': '#fff3e0',
    '运维': '#e8f5e9',
    '产品': '#fce4ec',
    '文档': '#f1f8e9'
  }
  return colors[category] || '#f7f7f5'
}

function exportData() {
  const startTime = performance.now()
  const csv = [
    columns.value.map(c => c.name).join(','),
    ...data.value.map(row =>
      columns.value.map(c => `"${row[c.prop] || ''}"`).join(',')
    )
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `virtual-grid-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)

  renderTime.value = Math.round(performance.now() - startTime)
}

function finishEditing() {
  if (editingCell.value) {
    const [rowId, prop] = editingCell.value.id.split('-')
    const row = data.value.find(r => r.id === parseInt(rowId))
    if (row) {
      row[prop] = editingCell.value.value
    }
    editingCell.value = null
  }
}

function cancelEditing() {
  editingCell.value = null
}

// 更新视口高度
function updateViewportHeight() {
  if (wrapperRef.value) {
    viewportHeight.value = wrapperRef.value.clientHeight - 60 // 减去表头高度
  }
}

onMounted(() => {
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
  console.log('Virtual Grid mounted with', data.value.length, 'rows')
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportHeight)
})
</script>

<style scoped>
.virtual-grid-container {
  height: 100%;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-bottom: 1px solid #5a67d8;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.subtitle {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  background: rgba(255,255,255,0.1);
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover {
  background: rgba(255,255,255,0.2);
}

.btn-primary {
  background: #4caf50;
  border-color: #45a049;
}

.btn-primary:hover {
  background: #45a049;
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,0.3);
}

.stats-bar {
  display: flex;
  gap: 24px;
  padding: 8px 16px;
  background: #f7f7f5;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
}

.stat-item {
  display: flex;
  gap: 4px;
}

.stat-label {
  color: #787774;
}

.stat-value {
  font-weight: 600;
  color: #37352f;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
}

.table-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  background: #f7f7f5;
  border-bottom: 2px solid #e8e8e8;
}

.header-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 40px;
  font-weight: 500;
  color: #787774;
  border-right: 1px solid #e8e8e8;
  user-select: none;
}

.header-cell.sortable {
  cursor: pointer;
}

.header-cell.sortable:hover {
  background: #e8e8e8;
}

.sort-icon {
  color: #2383e2;
}

.sort-icon-placeholder {
  color: #d0d0d0;
  font-size: 11px;
}

.header-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e8e8e8;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e8e8e8;
}

.table-body {
  position: relative;
}

.table-row {
  position: absolute;
  display: flex;
  height: 40px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.1s;
}

.table-row:hover {
  background: #f7f7f5;
}

.table-row.selected {
  background: #e8f4fd;
}

.cell {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-right: 1px solid #f0f0f0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-editor {
  width: 100%;
  height: 32px;
  border: 1px solid #2383e2;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
  outline: none;
}

.checkbox-cell,
.actions-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-tag {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-待处理 {
  background: #f7f7f5;
  color: #787774;
}

.status-进行中 {
  background: #e3f2fd;
  color: #1976d2;
}

.status-已完成 {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-已取消 {
  background: #ffebee;
  color: #c62828;
}

.priority-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.priority-低 {
  background: #f7f7f5;
  color: #787774;
}

.priority-中 {
  background: #fff3e0;
  color: #e65100;
}

.priority-高 {
  background: #ffebee;
  color: #c62828;
}

.priority-紧急 {
  background: #c62828;
  color: #ffffff;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-input {
  width: 45px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  text-align: right;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2383e2, #4fc3f7);
  transition: width 0.3s;
}

.hours-value {
  color: #2383e2;
  font-weight: 500;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
}

.action-btn-danger {
  color: #c62828;
}

.scroll-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 16px;
  background: rgba(0,0,0,0.8);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
}

/* 滚动条 */
.table-wrapper::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f7f7f5;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 6px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}
</style>
