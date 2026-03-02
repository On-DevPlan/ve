<template>
  <div class="jspreadsheet-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="title">Jspreadsheet 表格</h2>
        <span class="subtitle">Excel 风格电子表格</span>
      </div>
      <div class="toolbar-right">
        <button class="btn" @click="insertRow">+ 行</button>
        <button class="btn" @click="insertColumn">+ 列</button>
        <button class="btn" @click="downloadCSV">导出 CSV</button>
        <button class="btn" @click="downloadJSON">导出 JSON</button>
      </div>
    </div>

    <!-- Jspreadsheet 表格 -->
    <div ref="spreadsheetRef" class="spreadsheet"></div>

    <!-- 公式帮助 -->
    <div class="formula-help">
      <strong>支持公式:</strong> =SUM(A1:A10), =AVERAGE(B1:B5), =MAX(C1:C20), =MIN(D1:D10), =COUNT(E1:E100)
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import jspreadsheet from 'jspreadsheet-ce'
import 'jspreadsheet-ce/dist/jspreadsheet.css'

const spreadsheetRef = ref(null)
let jspreadsheetInstance = null

// 初始数据
const initialData = [
  ['产品', 'Q1销量', 'Q2销量', 'Q3销量', 'Q4销量', '总计'],
  ['iPhone', '=SUM(B2:E2)', 1200, 1500, 1800, '=SUM(B2:E2)'],
  ['iPad', 800, 900, 850, 1000, '=SUM(B3:E3)'],
  ['MacBook', 500, 600, 750, 900, '=SUM(B4:E4)'],
  ['AirPods', 2000, 2500, 3000, 3500, '=SUM(B5:E5)'],
  ['Watch', 1500, 1800, 2000, 2200, '=SUM(B6:E6)'],
  ['', '', '', '', '', ''],
  ['季度总计', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)', '=SUM(E2:E6)', '=SUM(F2:F6)'],
]

// 列配置
const columns = [
  { type: 'text', width: 120 },
  { type: 'text', width: 100, mask: '#,##0' },
  { type: 'text', width: 100, mask: '#,##0' },
  { type: 'text', width: 100, mask: '#,##0' },
  { type: 'text', width: 100, mask: '#,##0' },
  { type: 'text', width: 100, mask: '#,##0' },
]

onMounted(() => {
  jspreadsheetInstance = jspreadsheet(spreadsheetRef.value, {
    data: initialData,
    columns: columns,
    minDimensions: [10, 20],
    allowInsertColumn: true,
    allowInsertRow: true,
    allowDeleteRow: true,
    allowDeleteColumn: true,
    allowRenameColumn: true,
    allowComments: true,
    contextMenu: true,
    lazyLoading: true,
    tableOverflow: true,
    tableHeight: 'calc(100vh - 140px)',
    tableWidth: '100%',
    about: false,
    toolbar: false,
  })
})

onBeforeUnmount(() => {
  if (jspreadsheetInstance) {
    jspreadsheetInstance.destroy()
  }
})

function insertRow() {
  if (jspreadsheetInstance) {
    jspreadsheetInstance.insertRow()
  }
}

function insertColumn() {
  if (jspreadsheetInstance) {
    jspreadsheetInstance.insertColumn()
  }
}

function downloadCSV() {
  if (jspreadsheetInstance) {
    jspreadsheetInstance.downloadCSV()
  }
}

function downloadJSON() {
  if (jspreadsheetInstance) {
    const data = jspreadsheetInstance.getData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'spreadsheet-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }
}
</script>

<style scoped>
.jspreadsheet-container {
  height: 100%;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

.spreadsheet {
  padding: 16px;
  overflow: auto;
}

.formula-help {
  position: fixed;
  bottom: 16px;
  left: 16px;
  padding: 10px 16px;
  background: #37352f;
  color: #ffffff;
  font-size: 12px;
  border-radius: 8px;
  max-width: 400px;
}

/* Jspreadsheet 样式覆盖 */
:deep(.jexcel_container) {
  font-size: 13px;
}

:deep(.jexcel_content) {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

:deep(.jexcel thead td) {
  background: #f7f7f5;
  color: #787774;
  font-weight: 500;
}

:deep(.jexcel tbody tr:hover) {
  background: #f7f7f5;
}

:deep(.jexcel td) {
  border-color: #e8e8e8;
}

:deep(.jexcel_selected) {
  background: #e8f4fd !important;
}

:deep(.jexcel_highlighted) {
  background: #fff3cd !important;
}
</style>
