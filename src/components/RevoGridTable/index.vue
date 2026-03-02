<template>
  <div class="revogrid-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="title">RevoGrid 高性能表格</h2>
        <span class="subtitle">{{ rows.length }} 行 × {{ columns.length }} 列</span>
      </div>
      <div class="toolbar-right">
        <button class="btn" @click="addRows(1000)">+ 1000行</button>
        <button class="btn" @click="addRows(10000)">+ 10000行</button>
        <button class="btn" @click="clearData">清空</button>
        <button class="btn" @click="resetData">重置</button>
        <button class="btn btn-primary" @click="exportData">导出</button>
      </div>
    </div>

    <!-- RevoGrid -->
    <revo-grid
      class="grid"
      :columns="columns"
      :source="rows"
      :theme="theme"
      :readonly="false"
      :range="true"
      :resize="true"
      :keyboard="true"
      @afteredit="onEdit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import '@revolist/revogrid/revogrid.css'

// 生成示例数据
const generateData = (count) => {
  const statuses = ['待处理', '进行中', '已完成', '已取消']
  const priorities = ['低', '中', '高', '紧急']
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']
  const tasks = ['代码审查', '需求分析', 'UI设计', '后端开发', '测试', '部署', '文档编写', 'Bug修复']

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `任务-${i + 1}`,
    task: tasks[i % tasks.length],
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    progress: Math.floor(Math.random() * 101),
    assignee: names[i % names.length],
    hours: Math.floor(Math.random() * 40) + 1,
    deadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  }))
}

// 列定义
const columns = ref([
  { prop: 'id', name: 'ID', size: 70, readonly: true },
  { prop: 'name', name: '任务名称', size: 150 },
  { prop: 'task', name: '任务类型', size: 120 },
  {
    prop: 'status',
    name: '状态',
    size: 100,
    cellTemplate: (createElement, props) => {
      const colors = {
        '待处理': '#f7f7f5',
        '进行中': '#e3f2fd',
        '已完成': '#e8f5e9',
        '已取消': '#ffebee'
      }
      const textColors = {
        '待处理': '#787774',
        '进行中': '#1976d2',
        '已完成': '#2e7d32',
        '已取消': '#c62828'
      }
      return createElement('span', {
        style: {
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          background: colors[props.model[props.prop]] || '#f7f7f5',
          color: textColors[props.model[props.prop]] || '#787774'
        }
      }, props.model[props.prop])
    }
  },
  { prop: 'priority', name: '优先级', size: 80 },
  {
    prop: 'progress',
    name: '进度',
    size: 150,
    cellTemplate: (createElement, props) => {
      const value = props.model[props.prop] || 0
      return createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }
      }, [
        createElement('div', {
          style: {
            flex: 1,
            height: '4px',
            background: '#e8e8e8',
            borderRadius: '2px',
            overflow: 'hidden'
          }
        }, [
          createElement('div', {
            style: {
              width: value + '%',
              height: '100%',
              background: 'linear-gradient(90deg, #2383e2, #4fc3f7)'
            }
          })
        ]),
        createElement('span', {
          style: { fontSize: '12px', color: '#787774', minWidth: '32px', textAlign: 'right' }
        }, value + '%')
      ])
    }
  },
  { prop: 'assignee', name: '负责人', size: 100 },
  { prop: 'hours', name: '工时', size: 80 },
  { prop: 'deadline', name: '截止日期', size: 120 },
])

// 数据
const rows = ref(generateData(50))
const theme = ref('compactCompact')

// 添加行
function addRows(count) {
  const newRows = generateData(count)
  const startId = rows.value.length > 0 ? Math.max(...rows.value.map(r => r.id)) + 1 : 1
  newRows.forEach((row, i) => {
    row.id = startId + i
  })
  rows.value = [...rows.value, ...newRows]
}

// 清空数据
function clearData() {
  rows.value = []
}

// 重置数据
function resetData() {
  rows.value = generateData(50)
}

// 导出数据
function exportData() {
  const data = JSON.stringify(rows.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `revogrid-data-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// 编辑事件
function onEdit(event) {
  console.log('Cell edited:', event.detail)
}

onMounted(() => {
  console.log('RevoGrid mounted with', rows.value.length, 'rows')
})
</script>

<style scoped>
.revogrid-container {
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
  background: #f7f7f5;
  border-bottom: 1px solid #e8e8e8;
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
  color: #37352f;
}

.subtitle {
  font-size: 13px;
  color: #787774;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #ffffff;
  color: #37352f;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover {
  background: #f7f7f5;
  border-color: #d3d3d3;
}

.btn-primary {
  background: #2383e2;
  color: #ffffff;
  border-color: #2383e2;
}

.btn-primary:hover {
  background: #1a6fc7;
}

.grid {
  flex: 1;
  min-height: 0;
}

/* RevoGrid 样式覆盖 */
:deep(revo-grid) {
  height: 100%;
  font-size: 13px;
}

:deep(.rgHeaderCell) {
  background: #f7f7f5 !important;
  color: #787774 !important;
  font-weight: 500;
}

:deep(.rgRow) {
  border-bottom: 1px solid #f0f0f0;
}

:deep(.rgRow:hover) {
  background: #f7f7f5 !important;
}

:deep(.rgCell) {
  padding: 0 8px;
}

:deep(.rgCell:focus) {
  outline: 2px solid #2383e2;
  outline-offset: -2px;
}

:deep(.rgSelection) {
  background: rgba(35, 131, 226, 0.1) !important;
}
</style>
