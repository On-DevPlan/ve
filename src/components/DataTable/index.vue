<template>
  <div class="data-table-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="title">可视化数据面板</h2>
        <span class="subtitle">{{ tableData.length }} 行数据</span>
      </div>

      <div class="toolbar-right">
        <!-- 添加按钮 -->
        <button class="btn btn-primary" @click="addRow">
          <span class="icon">+</span> 添加
        </button>

        <!-- 删除按钮 -->
        <button class="btn btn-danger" @click="deleteSelectedRows" :disabled="selectedCount === 0">
          <span class="icon">×</span> 删除
        </button>

        <div class="divider"></div>

        <!-- 导入按钮 -->
        <button class="btn btn-secondary" @click="triggerImport">
          <span class="icon">↑</span> 导入
        </button>
        <input ref="fileInput" type="file" accept=".csv,.json" @change="handleFileImport" style="display: none">

        <!-- 导出菜单 -->
        <div class="dropdown" @click.stop>
          <button class="btn btn-secondary" @click="showExportMenu = !showExportMenu">
            <span class="icon">↓</span> 导出
          </button>
          <div v-show="showExportMenu" class="dropdown-menu">
            <button class="dropdown-item" @click.stop="exportData('csv')">导出 CSV</button>
            <button class="dropdown-item" @click.stop="exportData('json')">导出 JSON</button>
            <button class="dropdown-item" @click.stop="exportData('html')">导出 HTML</button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 刷新按钮 -->
        <button class="btn btn-secondary" @click="refreshGrid">
          <span class="icon">⟳</span>
        </button>
      </div>
    </div>

    <!-- 原生表格 - 更简单可靠 -->
    <div class="table-wrapper">
      <table class="notion-table">
        <thead>
          <tr>
            <th width="40"><input type="checkbox" v-model="allSelected" @change="toggleSelectAll"></th>
            <th width="60">ID</th>
            <th width="150">名称</th>
            <th>描述</th>
            <th width="100">状态</th>
            <th width="80">优先级</th>
            <th width="140">进度</th>
            <th width="100">负责人</th>
            <th width="110">截止日期</th>
            <th width="100">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.id" :class="{ 'selected': row.selected }" @click="selectRow(row)">
            <td @click.stop><input type="checkbox" v-model="row.selected"></td>
            <td><input v-model="row.id" class="cell-input" style="width: 50px"></td>
            <td><input v-model="row.name" class="cell-input"></td>
            <td><input v-model="row.description" class="cell-input"></td>
            <td>
              <select v-model="row.status" class="cell-select">
                <option>待处理</option>
                <option>进行中</option>
                <option>已完成</option>
                <option>已取消</option>
              </select>
              <span v-if="!editing" :class="['status-tag', `status-${getStatusClass(row.status)}`]">{{ row.status }}</span>
            </td>
            <td>
              <select v-model="row.priority" class="cell-select">
                <option>低</option>
                <option>中</option>
                <option>高</option>
                <option>紧急</option>
              </select>
            </td>
            <td>
              <div class="progress-cell">
                <input type="number" v-model.number="row.progress" min="0" max="100" class="progress-input">
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: Math.min(100, Math.max(0, row.progress || 0)) + '%' }"></div>
                </div>
              </div>
            </td>
            <td><input v-model="row.assignee" class="cell-input"></td>
            <td><input type="date" v-model="row.dueDate" class="cell-input"></td>
            <td @click.stop>
              <button class="action-btn" @click="duplicateRow(row)">复制</button>
              <button class="action-btn action-btn-danger" @click="deleteRow(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar" v-if="statusMessage">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// 示例数据
const sampleData = [
  { id: '1', name: '完成项目文档', description: '编写项目的技术文档', status: '进行中', priority: '高', progress: 75, assignee: '张三', dueDate: '2025-03-15', selected: false },
  { id: '2', name: '修复登录 Bug', description: '用户无法登录的问题', status: '待处理', priority: '紧急', progress: 0, assignee: '李四', dueDate: '2025-03-05', selected: false },
  { id: '3', name: '优化数据库查询', description: '提升查询性能', status: '已完成', priority: '中', progress: 100, assignee: '王五', dueDate: '2025-02-28', selected: false },
  { id: '4', name: '设计新功能原型', description: '新功能的 UI 原型设计', status: '进行中', priority: '中', progress: 40, assignee: '赵六', dueDate: '2025-03-20', selected: false },
  { id: '5', name: '编写单元测试', description: '为核心功能添加测试', status: '待处理', priority: '低', progress: 0, assignee: '张三', dueDate: '2025-03-25', selected: false },
]

// 状态
const tableData = ref([...sampleData])
const showExportMenu = ref(false)
const fileInput = ref(null)
const statusMessage = ref('')
const editing = ref(true) // 始终处于编辑模式
let nextId = 6

// 计算属性
const selectedCount = computed(() => tableData.value.filter(r => r.selected).length)
const allSelected = computed({
  get: () => tableData.value.length > 0 && tableData.value.every(r => r.selected),
  set: (value) => {
    tableData.value.forEach(r => r.selected = value)
  }
})

// 获取状态样式类
function getStatusClass(status) {
  const classMap = {
    '待处理': 'todo',
    '进行中': 'progress',
    '已完成': 'done',
    '已取消': 'cancelled'
  }
  return classMap[status] || 'default'
}

// 选择行
function selectRow(row) {
  // 点击行时不做特殊处理，复选框单独处理
}

// 全选/取消全选
function toggleSelectAll() {
  // handled by v-model
}

// 添加新行
function addRow() {
  const newRow = {
    id: String(nextId++),
    name: '新项目',
    description: '',
    status: '待处理',
    priority: '中',
    progress: 0,
    assignee: '',
    dueDate: '',
    selected: false
  }
  tableData.value.push(newRow)
  showStatus('已添加新行')
}

// 复制行
function duplicateRow(row) {
  const newRow = {
    ...row,
    id: String(nextId++),
    name: row.name + ' (副本)',
    selected: false
  }
  tableData.value.push(newRow)
  showStatus('已复制行')
}

// 删除单行
function deleteRow(row) {
  const index = tableData.value.findIndex(r => r.id === row.id)
  if (index !== -1) {
    tableData.value.splice(index, 1)
    showStatus('已删除行')
  }
}

// 删除选中行
function deleteSelectedRows() {
  const count = selectedCount.value
  if (count === 0) return
  tableData.value = tableData.value.filter(row => !row.selected)
  showStatus(`已删除 ${count} 行`)
}

// 导出数据
function exportData(format) {
  showExportMenu.value = false

  const filename = `data-export-${new Date().toISOString().split('T')[0]}`

  switch (format) {
    case 'csv':
      exportToCSV(filename)
      break
    case 'json':
      exportToJSON(filename)
      break
    case 'html':
      exportToHTML(filename)
      break
  }
  showStatus(`已导出 ${format.toUpperCase()}`)
}

// 导出 CSV
function exportToCSV(filename) {
  const headers = ['ID', '名称', '描述', '状态', '优先级', '进度', '负责人', '截止日期']
  const rows = tableData.value.map(row =>
    [row.id, row.name, row.description, row.status, row.priority, row.progress, row.assignee, row.dueDate]
      .map(v => `"${v || ''}"`).join(',')
  )
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8')
}

// 导出 JSON
function exportToJSON(filename) {
  const json = JSON.stringify(tableData.value, null, 2)
  downloadFile(json, `${filename}.json`, 'application/json')
}

// 导出 HTML
function exportToHTML(filename) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>数据导出</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <table>
    <tr><th>ID</th><th>名称</th><th>描述</th><th>状态</th><th>优先级</th><th>进度</th><th>负责人</th><th>截止日期</th></tr>
    ${tableData.value.map(row =>
      `<tr><td>${row.id}</td><td>${row.name}</td><td>${row.description}</td><td>${row.status}</td><td>${row.priority}</td><td>${row.progress}%</td><td>${row.assignee}</td><td>${row.dueDate}</td></tr>`
    ).join('\n')}
  </table>
</body>
</html>`
  downloadFile(html, `${filename}.html`, 'text/html')
}

// 下载文件
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 触发导入
function triggerImport() {
  fileInput.value?.click()
}

// 处理文件导入
async function handleFileImport(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const extension = file.name.split('.').pop()?.toLowerCase()

  try {
    let data = []

    if (extension === 'json') {
      const text = await file.text()
      data = JSON.parse(text)
    } else if (extension === 'csv') {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const row = { id: String(nextId++), selected: false }
          headers.forEach((h, idx) => {
            if (h === '进度') {
              row[h] = parseInt(values[idx]) || 0
            } else {
              row[h] = values[idx] || ''
            }
          })
          data.push(row)
        }
      }
    } else {
      showStatus('不支持的文件格式')
      return
    }

    if (data.length > 0) {
      tableData.value = data
      showStatus(`已导入 ${data.length} 行数据`)
    }
  } catch (error) {
    console.error('Import error:', error)
    showStatus('导入失败: ' + error.message)
  }

  event.target.value = ''
}

// 刷新表格
function refreshGrid() {
  // 强制重新渲染
  const temp = [...tableData.value]
  tableData.value = []
  setTimeout(() => tableData.value = temp, 0)
  showStatus('表格已刷新')
}

// 显示状态消息
function showStatus(message) {
  statusMessage.value = message
  setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

// 点击外部关闭下拉菜单
function handleClickOutside(e) {
  if (!e.target.closest('.dropdown')) {
    showExportMenu.value = false
  }
}

onMounted(() => {
  console.log('DataTable mounted, rows:', tableData.value.length)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* 容器 */
.data-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7f7f5;
  border-bottom: 1px solid #e8e8e8;
}

.toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #37352f;
}

.subtitle {
  font-size: 13px;
  color: #787774;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #ffffff;
  color: #37352f;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover:not(:disabled) {
  background: #f7f7f5;
  border-color: #d3d3d3;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2383e2;
  color: #ffffff;
  border-color: #2383e2;
}

.btn-primary:hover:not(:disabled) {
  background: #1a6fc7;
}

.btn-danger {
  color: #df5452;
  border-color: #ffc8c8;
}

.btn-danger:hover:not(:disabled) {
  background: #fff0f0;
}

.btn-secondary {
  background: #f7f7f5;
  border-color: #e8e8e8;
}

.icon {
  font-size: 14px;
  line-height: 1;
}

.divider {
  width: 1px;
  height: 24px;
  background: #e8e8e8;
  margin: 0 4px;
}

/* 下拉菜单 */
.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  padding: 4px 0;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  font-size: 13px;
  background: none;
  border: none;
  color: #37352f;
  cursor: pointer;
  border-radius: 0;
}

.dropdown-item:hover {
  background: #f7f7f5;
}

/* 表格容器 */
.table-wrapper {
  flex: 1;
  overflow: auto;
}

/* Notion 风格表格 */
.notion-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.notion-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.notion-table th {
  background: #f7f7f5;
  color: #787774;
  font-weight: 500;
  text-align: left;
  padding: 0 8px;
  height: 36px;
  border-bottom: 1px solid #e8e8e8;
  border-right: 1px solid #e8e8e8;
  white-space: nowrap;
}

.notion-table td {
  padding: 0;
  height: 36px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
}

.notion-table tbody tr:hover {
  background: #f7f7f5;
}

.notion-table tbody tr.selected {
  background: #e8f4fd;
}

/* 单元格输入 */
.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 8px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.cell-input:focus {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #2383e2;
}

.cell-select {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 8px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  border-radius: 0;
}

.cell-select:focus {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #2383e2;
}

/* 状态标签 */
.status-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-todo {
  background: #f7f7f5;
  color: #787774;
}

.status-progress {
  background: #e3f2fd;
  color: #1976d2;
}

.status-done {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-cancelled {
  background: #ffebee;
  color: #c62828;
}

/* 进度条单元格 */
.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 100%;
}

.progress-input {
  width: 45px;
  border: none;
  background: transparent;
  padding: 0 4px;
  font-size: 12px;
  text-align: right;
  outline: none;
}

.progress-input:focus {
  background: #ffffff;
  border-radius: 2px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
  min-width: 30px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2383e2, #4fc3f7);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 操作按钮 */
.action-btn {
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #ffffff;
  color: #37352f;
  cursor: pointer;
  margin-right: 4px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: #f7f7f5;
  border-color: #d3d3d3;
}

.action-btn-danger {
  color: #df5452;
  border-color: #ffc8c8;
}

.action-btn-danger:hover {
  background: #fff0f0;
}

/* 状态栏 */
.status-bar {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 16px;
  background: #37352f;
  color: #ffffff;
  font-size: 13px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.2s ease;
  z-index: 1000;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  background: #d3d3d3;
  border-radius: 6px;
  border: 3px solid #f7f7f5;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #b3b3b3;
}
</style>
