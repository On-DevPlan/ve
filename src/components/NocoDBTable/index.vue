<template>
  <div class="nocodb-container">
    <!-- 顶部工具栏 -->
    <div class="header-toolbar">
      <div class="table-title">
        <h1>📋 项目任务管理</h1>
        <span class="table-info">{{ records.length }} 条记录</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="toggleView">
          <span class="icon">{{ viewIcon }}</span> {{ viewName }}
        </button>
        <button class="btn btn-secondary" @click="showFilter = !showFilter">
          <span class="icon">🔍</span> 筛选
        </button>
        <button class="btn btn-secondary" @click="showSort = !showSort">
          <span class="icon">⇅</span> 排序
        </button>
        <button class="btn btn-primary" @click="addRecord">
          <span class="icon">+</span> 新建记录
        </button>
      </div>
    </div>

    <!-- 筛选面板 -->
    <div v-if="showFilter" class="filter-panel">
      <h3>筛选条件</h3>
      <div class="filter-list">
        <div v-for="(filter, index) in filters" :key="index" class="filter-item">
          <select v-model="filter.field" class="filter-select">
            <option value="">选择字段</option>
            <option v-for="col in columns" :key="col.id" :value="col.id">{{ col.name }}</option>
          </select>
          <select v-model="filter.operator" class="filter-select">
            <option value="contains">包含</option>
            <option value="equals">等于</option>
            <option value="notEquals">不等于</option>
          </select>
          <input v-model="filter.value" class="filter-input" placeholder="值">
          <button class="btn-icon" @click="removeFilter(index)">×</button>
        </div>
        <button class="btn btn-secondary btn-sm" @click="addFilter">+ 添加条件</button>
      </div>
    </div>

    <!-- Grid 视图 -->
    <div v-if="currentView === 'grid'" class="grid-view">
      <table class="data-table">
        <thead>
          <tr>
            <th class="checkbox-col">
              <input type="checkbox" v-model="selectAll" @change="toggleSelectAll">
            </th>
            <th v-for="col in columns" :key="col.id" :style="{ width: col.width + 'px' }">
              <div class="th-content">
                <span>{{ col.name }}</span>
                <span class="th-icon" @click="sortBy(col.id)">⇅</span>
              </div>
            </th>
            <th class="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id" :class="{ selected: record.selected }">
            <td class="checkbox-col">
              <input type="checkbox" v-model="record.selected">
            </td>
            <td v-for="col in columns" :key="col.id">
              <component
                :is="getCellComponent(col.type)"
                :value="record[col.id]"
                :column="col"
                :record="record"
                @update:value="(val) => updateRecord(record.id, col.id, val)"
              />
            </td>
            <td class="actions-col">
              <button class="action-btn" @click="editRecord(record)">✏️</button>
              <button class="action-btn action-btn-danger" @click="deleteRecord(record.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Kanban 视图 -->
    <div v-if="currentView === 'kanban'" class="kanban-view">
      <div v-for="status in statuses" :key="status.value" class="kanban-column">
        <div class="kanban-header">
          <span class="status-dot" :style="{ background: status.color }"></span>
          <span class="status-name">{{ status.label }}</span>
          <span class="status-count">{{ getRecordsByStatus(status.value).length }}</span>
        </div>
        <div class="kanban-cards">
          <div v-for="record in getRecordsByStatus(status.value)" :key="record.id" class="kanban-card" @click="editRecord(record)">
            <h4>{{ record.name }}</h4>
            <p class="card-task">{{ record.task }}</p>
            <div class="card-meta">
              <span class="priority" :class="'priority-' + record.priority">{{ record.priority }}</span>
              <span class="assignee">{{ record.assignee }}</span>
            </div>
            <div class="card-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: record.progress + '%' }"></div>
              </div>
              <span>{{ record.progress }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Gallery 视图 -->
    <div v-if="currentView === 'gallery'" class="gallery-view">
      <div v-for="record in filteredRecords" :key="record.id" class="gallery-card" @click="editRecord(record)">
        <div class="card-image" :style="{ background: getAvatarColor(record.assignee) }">
          <span class="avatar-text">{{ record.assignee?.charAt(0) || '?' }}</span>
        </div>
        <div class="card-content">
          <h4>{{ record.name }}</h4>
          <p>{{ record.task }}</p>
          <div class="card-tags">
            <span class="tag" :class="'status-' + getStatusClass(record.status)">{{ record.status }}</span>
            <span class="tag priority-tag">{{ record.priority }}</span>
          </div>
          <div class="card-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: record.progress + '%' }"></div>
            </div>
            <span>{{ record.progress }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Form 视图 -->
    <div v-if="currentView === 'form'" class="form-view">
      <div class="form-container">
        <h2>{{ editingRecord ? '编辑记录' : '新建记录' }}</h2>
        <div class="form-fields">
          <div v-for="col in columns" :key="col.id" class="form-field">
            <label>{{ col.name }}</label>
            <component
              :is="getFormComponent(col.type)"
              :value="formData[col.id]"
              :column="col"
              @update:value="(val) => formData[col.id] = val"
            />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" @click="cancelEdit">取消</button>
          <button class="btn btn-primary" @click="saveRecord">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'

// 列定义
const columns = ref([
  { id: 'name', name: '任务名称', type: 'text', width: 150, required: true },
  { id: 'task', name: '任务类型', type: 'select', width: 120, options: ['代码审查', '需求分析', 'UI设计', '后端开发', '测试', '部署'] },
  { id: 'status', name: '状态', type: 'select', width: 100, options: ['待处理', '进行中', '已完成', '已取消'] },
  { id: 'priority', name: '优先级', type: 'select', width: 80, options: ['低', '中', '高', '紧急'] },
  { id: 'progress', name: '进度', type: 'number', width: 100, min: 0, max: 100 },
  { id: 'assignee', name: '负责人', type: 'text', width: 100 },
  { id: 'deadline', name: '截止日期', type: 'date', width: 120 },
])

// 状态选项
const statuses = [
  { label: '待处理', value: '待处理', color: '#f7f7f5' },
  { label: '进行中', value: '进行中', color: '#e3f2fd' },
  { label: '已完成', value: '已完成', color: '#e8f5e9' },
  { label: '已取消', value: '已取消', color: '#ffebee' },
]

// 视图类型
const views = ['grid', 'kanban', 'gallery', 'form']
const viewIcons = { grid: '📊', kanban: '📋', gallery: '🖼️', form: '📝' }
const viewNames = { grid: '表格视图', kanban: '看板视图', gallery: '卡片视图', form: '表单视图' }

// 状态
const currentView = ref('grid')
const showFilter = ref(false)
const showSort = ref(false)
const selectAll = ref(false)
const editingRecord = ref(null)
const formData = ref({})
const filters = ref([])

// 示例数据
const records = ref([
  { id: 1, name: '用户登录功能', task: '后端开发', status: '进行中', priority: '高', progress: 65, assignee: '张三', deadline: '2025-03-15', selected: false },
  { id: 2, name: '首页UI设计', task: 'UI设计', status: '已完成', priority: '中', progress: 100, assignee: '李四', deadline: '2025-03-10', selected: false },
  { id: 3, name: 'API文档编写', task: '文档', status: '待处理', priority: '低', progress: 0, assignee: '王五', deadline: '2025-03-20', selected: false },
  { id: 4, name: '单元测试', task: '测试', status: '进行中', priority: '中', progress: 40, assignee: '赵六', deadline: '2025-03-18', selected: false },
  { id: 5, name: '需求评审', task: '需求分析', status: '已完成', priority: '紧急', progress: 100, assignee: '张三', deadline: '2025-03-01', selected: false },
  { id: 6, name: '数据库优化', task: '后端开发', status: '待处理', priority: '高', progress: 0, assignee: '钱七', deadline: '2025-03-25', selected: false },
])

// 计算属性
const viewIcon = computed(() => viewIcons[currentView.value])
const viewName = computed(() => viewNames[currentView.value])

const filteredRecords = computed(() => {
  let result = records.value

  // 应用筛选
  filters.value.forEach(filter => {
    if (filter.field && filter.value) {
      result = result.filter(r => {
        const val = String(r[filter.field] || '').toLowerCase()
        const searchTerm = filter.value.toLowerCase()
        switch (filter.operator) {
          case 'contains': return val.includes(searchTerm)
          case 'equals': return val === searchTerm
          case 'notEquals': return val !== searchTerm
          default: return true
        }
      })
    }
  })

  return result
})

// 方法
function toggleView() {
  const currentIndex = views.indexOf(currentView.value)
  currentView.value = views[(currentIndex + 1) % views.length]
}

function addRecord() {
  editingRecord.value = null
  formData.value = { status: '待处理', priority: '中', progress: 0 }
  currentView.value = 'form'
}

function editRecord(record) {
  editingRecord.value = record
  formData.value = { ...record }
  currentView.value = 'form'
}

function cancelEdit() {
  editingRecord.value = null
  formData.value = {}
  currentView.value = 'grid'
}

function saveRecord() {
  if (editingRecord.value) {
    Object.assign(editingRecord.value, formData.value)
  } else {
    records.value.push({
      id: Date.now(),
      ...formData.value,
      selected: false
    })
  }
  currentView.value = 'grid'
  editingRecord.value = null
  formData.value = {}
}

function updateRecord(id, field, value) {
  const record = records.value.find(r => r.id === id)
  if (record) {
    record[field] = value
  }
}

function deleteRecord(id) {
  const index = records.value.findIndex(r => r.id === id)
  if (index !== -1) {
    records.value.splice(index, 1)
  }
}

function toggleSelectAll() {
  records.value.forEach(r => r.selected = selectAll.value)
}

function addFilter() {
  filters.value.push({ field: '', operator: 'contains', value: '' })
}

function removeFilter(index) {
  filters.value.splice(index, 1)
}

function sortBy(field) {
  records.value.sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')))
}

function getRecordsByStatus(status) {
  return filteredRecords.value.filter(r => r.status === status)
}

function getStatusClass(status) {
  const map = { '待处理': 'todo', '进行中': 'progress', '已完成': 'done', '已取消': 'cancelled' }
  return map[status] || 'default'
}

function getAvatarColor(name) {
  const colors = ['#e3f2fd', '#fce4ec', '#f3e5f5', '#e8f5e9', '#fff3e0', '#e0f7fa']
  const index = (name?.charCodeAt(0) || 0) % colors.length
  return colors[index]
}

// 单元格组件
function TextCell(props) {
  return h('input', {
    value: props.value,
    class: 'cell-input',
    onInput: (e) => props['onUpdate:value'](e.target.value)
  })
}

function SelectCell(props) {
  return h('select', {
    value: props.value,
    class: 'cell-select',
    onChange: (e) => props['onUpdate:value'](e.target.value)
  }, props.column.options.map(opt => h('option', { value: opt }, opt)))
}

function NumberCell(props) {
  return h('input', {
    type: 'number',
    value: props.value,
    class: 'cell-input',
    min: props.column.min,
    max: props.column.max,
    onInput: (e) => props['onUpdate:value'](parseInt(e.target.value) || 0)
  })
}

function DateCell(props) {
  return h('input', {
    type: 'date',
    value: props.value,
    class: 'cell-input',
    onInput: (e) => props['onUpdate:value'](e.target.value)
  })
}

function ProgressCell(props) {
  return h('div', { class: 'progress-cell' }, [
    h('input', {
      type: 'number',
      value: props.value,
      class: 'progress-input',
      onInput: (e) => props['onUpdate:value'](parseInt(e.target.value) || 0)
    }),
    h('div', { class: 'progress-track' }, [
      h('div', { class: 'progress-fill', style: { width: (props.value || 0) + '%' } })
    ])
  ])
}

function getCellComponent(type) {
  const map = { text: TextCell, select: SelectCell, number: NumberCell, date: DateCell, progress: ProgressCell }
  return map[type] || TextCell
}

function getFormComponent(type) {
  return getCellComponent(type)
}
</script>

<style scoped>
.nocodb-container {
  height: 100%;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
}

.header-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
}

.table-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #37352f;
}

.table-info {
  font-size: 13px;
  color: #787774;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #ffffff;
  color: #37352f;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn:hover {
  background: #f7f7f5;
}

.btn-primary {
  background: #2383e2;
  color: #ffffff;
  border-color: #2383e2;
}

.btn-primary:hover {
  background: #1a6fc7;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.filter-panel {
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
}

.filter-panel h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #37352f;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-select, .filter-input {
  padding: 6px 8px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 13px;
}

.filter-select {
  width: 120px;
}

.filter-input {
  flex: 1;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  cursor: pointer;
}

/* Grid 视图 */
.grid-view {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
}

.data-table {
  width: 100%;
  background: #ffffff;
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.data-table th {
  background: #f7f7f5;
  padding: 12px;
  text-align: left;
  font-weight: 500;
  color: #787774;
  border-bottom: 1px solid #e8e8e8;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.th-icon {
  cursor: pointer;
  opacity: 0.5;
  font-size: 12px;
}

.th-icon:hover {
  opacity: 1;
}

.data-table td {
  padding: 0;
  border-bottom: 1px solid #f0f0f0;
}

.data-table tbody tr:hover {
  background: #f7f7f5;
}

.data-table tbody tr.selected {
  background: #e8f4fd;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.actions-col {
  width: 80px;
  text-align: center;
}

.cell-input, .cell-select {
  width: 100%;
  height: 40px;
  border: none;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
}

.cell-input:focus, .cell-select:focus {
  background: #f0f7ff;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 40px;
}

.progress-input {
  width: 50px;
  border: none;
  font-size: 13px;
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

.action-btn {
  padding: 4px 8px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
}

.action-btn-danger:hover {
  color: #c62828;
}

/* Kanban 视图 */
.kanban-view {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  overflow-x: auto;
}

.kanban-column {
  flex: 0 0 280px;
  background: #f7f7f5;
  border-radius: 8px;
  padding: 12px;
  max-height: 100%;
  overflow-y: auto;
}

.kanban-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-name {
  flex: 1;
  font-weight: 500;
  color: #37352f;
}

.status-count {
  font-size: 12px;
  color: #787774;
  padding: 2px 8px;
  background: rgba(0,0,0,0.05);
  border-radius: 10px;
}

.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kanban-card {
  background: #ffffff;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.kanban-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.kanban-card h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #37352f;
}

.card-task {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #787774;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.priority {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f7f7f5;
  color: #787774;
}

.priority-高 {
  background: #fff3e0;
  color: #e65100;
}

.priority-紧急 {
  background: #ffebee;
  color: #c62828;
}

.assignee {
  font-size: 12px;
  color: #787774;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #787774;
}

/* Gallery 视图 */
.gallery-view {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px 24px;
  overflow-y: auto;
}

.gallery-card {
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.gallery-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  transform: translateY(-4px);
}

.card-image {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 32px;
  color: #ffffff;
  font-weight: 600;
}

.card-content {
  padding: 16px;
}

.card-content h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: #37352f;
}

.card-content > p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #787774;
}

.card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
}

.status-todo { background: #f7f7f5; color: #787774; }
.status-progress { background: #e3f2fd; color: #1976d2; }
.status-done { background: #e8f5e9; color: #2e7d32; }
.status-cancelled { background: #ffebee; color: #c62828; }

.priority-tag {
  background: #f7f7f5;
  color: #787774;
}

/* Form 视图 */
.form-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.form-container {
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}

.form-container h2 {
  margin: 0 0 24px 0;
  font-size: 18px;
  color: #37352f;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #37352f;
}

.form-field input,
.form-field select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>
