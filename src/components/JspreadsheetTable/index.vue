<template>
  <div class="excel-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="title">Excel 电子表格</h2>
        <span class="subtitle">{{ rows }} 行 × {{ cols }} 列</span>
      </div>
      <div class="toolbar-right">
        <button class="btn" @click="insertRow" title="插入行">
          <span>+</span> 行
        </button>
        <button class="btn" @click="insertColumn" title="插入列">
          <span>+</span> 列
        </button>
        <button class="btn" @click="deleteRow" title="删除行">
          <span>-</span> 行
        </button>
        <button class="btn" @click="deleteColumn" title="删除列">
          <span>-</span> 列
        </button>
        <div class="divider"></div>
        <button class="btn" @click="undo" :disabled="historyIndex <= 0" title="撤销">
          <span>↶</span>
        </button>
        <button class="btn" @click="redo" :disabled="historyIndex >= history.length - 1" title="重做">
          <span>↷</span>
        </button>
        <div class="divider"></div>
        <button class="btn" @click="exportCSV">导出 CSV</button>
        <button class="btn btn-primary" @click="recalculate">
          <span>🔄</span> 重新计算
        </button>
      </div>
    </div>

    <!-- 公式栏 -->
    <div class="formula-bar">
      <div class="cell-indicator">
        <input v-model="selectedCell" class="cell-input" readonly>
      </div>
      <div class="formula-input-wrapper">
        <span class="formula-prefix">fx</span>
        <input
          v-model="formulaInput"
          class="formula-input"
          placeholder="输入值或公式 (如: =SUM(A1:A10))"
          @keydown.enter="applyFormula"
          @keydown.escape="clearFormula"
        >
      </div>
    </div>

    <!-- 列标题 -->
    <div class="spreadsheet-wrapper">
      <div class="column-headers">
        <div class="corner-cell"></div>
        <div
          v-for="col in columns"
          :key="col"
          class="column-header"
          :class="{ selected: selectedCol === col }"
          @click="selectColumn(col)"
        >
          {{ col }}
        </div>
      </div>

      <!-- 表格主体 -->
      <div class="spreadsheet-body">
        <!-- 行号 -->
        <div class="row-headers">
          <div
            v-for="row in rows"
            :key="row"
            class="row-header"
            :class="{ selected: selectedRow === row }"
            @click="selectRow(row)"
          >
            {{ row }}
          </div>
        </div>

        <!-- 单元格网格 -->
        <div class="cell-grid" :style="{ gridTemplateColumns: `120px repeat(${cols}, 1fr)` }">
          <div
            v-for="cell in allCells"
            :key="cell.id"
            class="cell"
            :class="{
              selected: isSelected(cell.row, cell.col),
              editing: editingCell === cell.id,
              hasFormula: hasFormula(cell.row, cell.col)
            }"
            :style="{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }"
            @click="selectCell(cell.row, cell.col)"
            @dblclick="editCell(cell.row, cell.col)"
          >
            <input
              v-if="editingCell === cell.id"
              :ref="el => setCellRef(el, cell.id)"
              v-model="tempValue"
              class="cell-editor"
              @blur="finishEditing"
              @keydown.enter="finishEditing"
              @keydown.esc="cancelEditing"
              @keydown.tab.prevent="handleTab($event, cell.row, cell.col)"
            >
            <span v-else class="cell-value" :class="getCellClass(cell.row, cell.col)">
              {{ getDisplayValue(cell.row, cell.col) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span class="status-item">选中: {{ selectedCell }}</span>
      <span class="status-item">值: {{ getCellValue(selectedRow, selectedCol) }}</span>
      <span class="status-item">{{ readyState }}</span>
    </div>

    <!-- 公式帮助面板 -->
    <div class="formula-help" v-if="showFormulaHelp">
      <div class="help-header">
        <span>📐 公式帮助</span>
        <button class="help-close" @click="showFormulaHelp = false">×</button>
      </div>
      <div class="help-content">
        <div class="help-section">
          <strong>基础公式:</strong>
          <ul>
            <li><code>=SUM(A1:B10)</code> - 求和</li>
            <li><code>=AVERAGE(A1:A10)</code> - 平均值</li>
            <li><code>=MAX(A1:B10)</code> - 最大值</li>
            <li><code>=MIN(A1:B10)</code> - 最小值</li>
            <li><code>=COUNT(A1:A10)</code> - 计数</li>
            <li><code>=A1+B1</code> - 加法</li>
            <li><code>=A1*2</code> - 乘法</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 帮助按钮 -->
    <button class="help-toggle" @click="showFormulaHelp = !showFormulaHelp">
      ?
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

// 配置
const rows = ref(50)
const cols = ref(15)

// 列名 (A, B, C, ..., Z, AA, AB, ...)
const columns = computed(() => {
  const result = []
  for (let i = 0; i < cols.value; i++) {
    let col = ''
    let num = i
    do {
      col = String.fromCharCode(65 + (num % 26)) + col
      num = Math.floor(num / 26) - 1
    } while (num >= 0)
    result.push(col)
  }
  return result
})

// 所有单元格
const allCells = computed(() => {
  const cells = []
  for (let r = 1; r <= rows.value; r++) {
    for (let c = 1; c <= cols.value; c++) {
      cells.push({ id: `${r}-${c}`, row: r, col: c })
    }
  }
  return cells
})

// 单元格数据 { "1-1": { value: "100", formula: "" } }
const cellData = ref({})
const formulas = ref({})

// 状态
const selectedRow = ref(1)
const selectedCol = ref('A')
const editingCell = ref(null)
const tempValue = ref('')
const formulaInput = ref('')
const showFormulaHelp = ref(false)
const cellRefs = ref({})
const history = ref([])
const historyIndex = ref(-1)
const readyState = ref('就绪')

// 选中的单元格标识
const selectedCell = computed(() => `${selectedCol.value}${selectedRow.value}`)

// 保存历史
function saveHistory() {
  const state = JSON.stringify({ data: cellData.value, formulas: formulas.value })
  // 删除当前历史之后的所有记录
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(state)
  historyIndex.value = history.value.length - 1
  // 限制历史长度
  if (history.value.length > 100) {
    history.value.shift()
    historyIndex.value--
  }
}

// 撤销
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = JSON.parse(history.value[historyIndex.value])
    cellData.value = state.data
    formulas.value = state.formulas
    recalculate()
    readyState.value = '已撤销'
  }
}

// 重做
function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = JSON.parse(history.value[historyIndex.value])
    cellData.value = state.data
    formulas.value = state.formulas
    recalculate()
    readyState.value = '已重做'
  }
}

// 获取单元格键
function getCellKey(row, col) {
  const colIndex = columns.value.indexOf(col)
  return `${row}-${colIndex + 1}`
}

// 获取单元格值
function getCellValue(row, col) {
  const key = getCellKey(row, col)
  return cellData.value[key]?.value || ''
}

// 设置单元格值
function setCellValue(row, col, value, formula = null) {
  const key = getCellKey(row, col)
  if (!cellData.value[key]) {
    cellData.value[key] = {}
  }
  cellData.value[key].value = value
  if (formula) {
    formulas.value[key] = formula
  } else {
    delete formulas.value[key]
  }
  saveHistory()
  recalculate()
}

// 是否有公式
function hasFormula(row, col) {
  const key = getCellKey(row, col)
  return !!formulas.value[key]
}

// 获取显示值
function getDisplayValue(row, col) {
  const key = getCellKey(row, col)
  const formula = formulas.value[key]
  if (formula) {
    return evaluateFormula(formula)
  }
  return cellData.value[key]?.value || ''
}

// 计算单元格样式
function getCellClass(row, col) {
  const value = getDisplayValue(row, col)
  if (value === '' || value === undefined) return ''

  // 数字右对齐
  if (!isNaN(parseFloat(value))) return 'align-right'

  // 公式结果加粗
  const key = getCellKey(row, col)
  if (formulas.value[key]) return 'formula-result'

  return ''
}

// 选择单元格
function selectCell(row, col) {
  selectedRow.value = row
  selectedCol.value = columns.value[col - 1]
  const value = getCellValue(row, col)
  const key = getCellKey(row, col)
  formulaInput.value = formulas.value[key] || value
  readyState.value = `选中: ${selectedCell.value}`
}

// 选择整行
function selectRow(row) {
  selectedRow.value = row
  readyState.value = `选中第 ${row} 行`
}

// 选择整列
function selectColumn(col) {
  selectedCol.value = col
  readyState.value = `选中列 ${col}`
}

// 是否选中
function isSelected(row, col) {
  return row === selectedRow.value && columns.value[col - 1] === selectedCol.value
}

// 编辑单元格
function editCell(row, col) {
  const key = getCellKey(row, col)
  editingCell.value = key
  tempValue.value = getCellValue(row, col)
  formulaInput.value = formulas.value[key] || tempValue.value
  nextTick(() => {
    const input = cellRefs.value[key]
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 完成编辑
function finishEditing() {
  if (!editingCell.value) return

  const [row, col] = editingCell.value.split('-').map(Number)
  const colName = columns.value[col - 1]

  let value = tempValue.value
  let formula = null

  if (value.toString().startsWith('=')) {
    formula = value
    value = evaluateFormula(value)
  }

  setCellValue(row, colName, value, formula)
  editingCell.value = null
  formulaInput.value = formula || value
}

// 取消编辑
function cancelEditing() {
  editingCell.value = null
  tempValue.value = ''
}

// 应用公式
function applyFormula() {
  const input = formulaInput.value.trim()
  if (input.startsWith('=')) {
    const value = evaluateFormula(input)
    setCellValue(selectedRow.value, selectedCol.value, value, input)
  } else {
    setCellValue(selectedRow.value, selectedCol.value, input)
  }
}

// 清除公式
function clearFormula() {
  formulaInput.value = ''
}

// Tab 键处理
function handleTab(event, row, col) {
  const nextCol = col + 1
  if (nextCol <= cols.value) {
    finishEditing()
    nextTick(() => {
      selectCell(row, nextCol)
      editCell(row, nextCol)
    })
  }
}

// 设置单元格引用
function setCellRef(el, key) {
  if (el) {
    cellRefs.value[key] = el
  }
}

// 解析单元格引用 (如 "A1" -> { row: 1, col: 0 })
function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const col = match[1]
  const row = parseInt(match[2])
  const colIndex = columns.value.indexOf(col)
  if (colIndex === -1 || row < 1 || row > rows.value) return null
  return { row, col: colIndex + 1 }
}

// 获取单元格引用的值
function getRefValue(ref) {
  const parsed = parseCellRef(ref)
  if (!parsed) return 0
  const value = getDisplayValue(parsed.row, columns.value[parsed.col - 1])
  return parseFloat(value) || 0
}

// 解析范围 (如 "A1:B10" -> [{row:1,col:1}, {row:10,col:2}])
function parseRange(range) {
  const parts = range.split(':')
  if (parts.length !== 2) return null

  const start = parseCellRef(parts[0])
  const end = parseCellRef(parts[1])

  if (!start || !end) return null

  const cells = []
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push({ row: r, col: c })
    }
  }
  return cells
}

// 计算公式
function evaluateFormula(formula) {
  try {
    const expr = formula.substring(1).toUpperCase()

    // SUM(A1:B10)
    const sumMatch = expr.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (sumMatch) {
      const range = parseRange(`${sumMatch[1]}:${sumMatch[2]}`)
      if (range) {
        return range.reduce((sum, cell) => {
          const colName = columns.value[cell.col - 1]
          return sum + (parseFloat(getDisplayValue(cell.row, colName)) || 0)
        }, 0)
      }
    }

    // AVERAGE(A1:B10)
    const avgMatch = expr.match(/^AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (avgMatch) {
      const range = parseRange(`${avgMatch[1]}:${avgMatch[2]}`)
      if (range) {
        const values = range.map(cell => {
          const colName = columns.value[cell.col - 1]
          return parseFloat(getDisplayValue(cell.row, colName)) || 0
        })
        return values.reduce((a, b) => a + b, 0) / values.length
      }
    }

    // MAX(A1:B10)
    const maxMatch = expr.match(/^MAX\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (maxMatch) {
      const range = parseRange(`${maxMatch[1]}:${maxMatch[2]}`)
      if (range) {
        return Math.max(...range.map(cell => {
          const colName = columns.value[cell.col - 1]
          return parseFloat(getDisplayValue(cell.row, colName)) || 0
        }))
      }
    }

    // MIN(A1:B10)
    const minMatch = expr.match(/^MIN\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (minMatch) {
      const range = parseRange(`${minMatch[1]}:${minMatch[2]}`)
      if (range) {
        return Math.min(...range.map(cell => {
          const colName = columns.value[cell.col - 1]
          return parseFloat(getDisplayValue(cell.row, colName)) || 0
        }))
      }
    }

    // COUNT(A1:B10)
    const countMatch = expr.match(/^COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (countMatch) {
      const range = parseRange(`${countMatch[1]}:${countMatch[2]}`)
      if (range) {
        return range.filter(cell => {
          const colName = columns.value[cell.col - 1]
          const val = getDisplayValue(cell.row, colName)
          return val !== '' && !isNaN(parseFloat(val))
        }).length
      }
    }

    // 简单算术表达式 A1+B1*2
    const mathExpr = expr.replace(/([A-Z]+\d+)/g, (match) => {
      return getRefValue(match)
    })
    const result = Function(`"use strict"; return (${mathExpr})`)()
    return isNaN(result) ? '#ERROR' : Math.round(result * 10000) / 10000

  } catch (e) {
    console.error('Formula error:', e)
    return '#ERROR'
  }
}

// 重新计算所有公式
function recalculate() {
  readyState.value = '计算中...'
  setTimeout(() => {
    Object.keys(formulas.value).forEach(key => {
      const [row, col] = key.split('-').map(Number)
      const colName = columns.value[col - 1]
      const value = evaluateFormula(formulas.value[key])
      cellData.value[key].value = value
    })
    readyState.value = `计算完成 - ${new Date().toLocaleTimeString()}`
  }, 10)
}

// 插入行
function insertRow() {
  rows.value++
  readyState.value = `已插入第 ${rows.value} 行`
}

// 插入列
function insertColumn() {
  cols.value++
  readyState.value = `已插入列 ${columns.value[columns.value.length - 1]}`
}

// 删除行
function deleteRow() {
  if (rows.value > 1) {
    rows.value--
    readyState.value = `已删除第 ${rows.value + 1} 行`
  }
}

// 删除列
function deleteColumn() {
  if (cols.value > 1) {
    cols.value--
    readyState.value = `已删除最后一列`
  }
}

// 导出 CSV
function exportCSV() {
  const csvData = []
  csvData.push(['', ...columns.value])

  for (let r = 1; r <= rows.value; r++) {
    const rowData = [r]
    for (let c = 0; c < cols.value; c++) {
      const col = columns.value[c]
      rowData.push(getDisplayValue(r, col))
    }
    csvData.push(rowData)
  }

  const csv = '\uFEFF' + csvData.map(row => row.map(v => `"${v || ''}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `spreadsheet-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
  readyState.value = 'CSV 已导出'
}

// 键盘快捷键
function handleKeydown(e) {
  if (editingCell.value) return

  const { row, col } = { row: selectedRow.value, col: columns.value.indexOf(selectedCol.value) + 1 }

  switch (e.key) {
    case 'ArrowUp':
      if (row > 1) selectCell(row - 1, col)
      e.preventDefault()
      break
    case 'ArrowDown':
      if (row < rows.value) selectCell(row + 1, col)
      e.preventDefault()
      break
    case 'ArrowLeft':
      if (col > 1) selectCell(row, col - 1)
      e.preventDefault()
      break
    case 'ArrowRight':
      if (col < cols.value) selectCell(row, col + 1)
      e.preventDefault()
      break
    case 'Delete':
      setCellValue(row, selectedCol.value, '')
      formulaInput.value = ''
      e.preventDefault()
      break
    case 'Enter':
      editCell(row, col)
      e.preventDefault()
      break
    case 'F2':
      editCell(row, col)
      e.preventDefault()
      break
  }
}

onMounted(() => {
  // 初始化示例数据
  setCellValue(1, 'A', '产品', null)
  setCellValue(1, 'B', 'Q1销量', null)
  setCellValue(1, 'C', 'Q2销量', null)
  setCellValue(1, 'D', 'Q3销量', null)
  setCellValue(1, 'E', 'Q4销量', null)
  setCellValue(1, 'F', '总计', null)

  setCellValue(2, 'A', 'iPhone', null)
  setCellValue(2, 'B', '1200', null)
  setCellValue(2, 'C', '1500', null)
  setCellValue(2, 'D', '1800', null)
  setCellValue(2, 'E', '2000', null)
  setCellValue(2, 'F', '=SUM(B2:E2)', '=SUM(B2:E2)')

  setCellValue(3, 'A', 'iPad', null)
  setCellValue(3, 'B', '800', null)
  setCellValue(3, 'C', '900', null)
  setCellValue(3, 'D', '850', null)
  setCellValue(3, 'E', '1000', null)
  setCellValue(3, 'F', '=SUM(B3:E3)', '=SUM(B3:E3)')

  setCellValue(4, 'A', 'MacBook', null)
  setCellValue(4, 'B', '500', null)
  setCellValue(4, 'C', '600', null)
  setCellValue(4, 'D', '750', null)
  setCellValue(4, 'E', '900', null)
  setCellValue(4, 'F', '=SUM(B4:E4)', '=SUM(B4:E4)')

  setCellValue(5, 'A', 'AirPods', null)
  setCellValue(5, 'B', '2000', null)
  setCellValue(5, 'C', '2500', null)
  setCellValue(5, 'D', '3000', null)
  setCellValue(5, 'E', '3500', null)
  setCellValue(5, 'F', '=SUM(B5:E5)', '=SUM(B5:E5)')

  setCellValue(7, 'A', '季度总计', null)
  setCellValue(7, 'B', '=SUM(B2:B5)', '=SUM(B2:B5)')
  setCellValue(7, 'C', '=SUM(C2:C5)', '=SUM(C2:C5)')
  setCellValue(7, 'D', '=SUM(D2:D5)', '=SUM(D2:D5)')
  setCellValue(7, 'E', '=SUM(E2:E5)', '=SUM(E2:E5)')
  setCellValue(7, 'F', '=SUM(F2:F5)', '=SUM(F2:F5)')

  // 保存初始状态
  saveHistory()

  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.excel-container {
  height: 100%;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #217346;
  border-bottom: 1px solid #1a5c38;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
}

.toolbar-right {
  display: flex;
  gap: 4px;
}

.btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 3px;
  background: rgba(255,255,255,0.1);
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #107c41;
  border-color: #0b5c2f;
}

.btn-primary:hover {
  background: #0b5c2f;
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255,255,255,0.3);
  margin: 0 4px;
}

/* 公式栏 */
.formula-bar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: #f3f2f1;
  border-bottom: 1px solid #e1dfdd;
  gap: 8px;
}

.cell-indicator {
  width: 50px;
}

.cell-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #e1dfdd;
  background: #ffffff;
  border-radius: 2px;
  font-size: 12px;
  text-align: center;
  font-weight: 600;
}

.formula-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e1dfdd;
  border-radius: 2px;
}

.formula-prefix {
  padding: 0 8px;
  color: #666;
  font-style: italic;
  font-family: serif;
}

.formula-input {
  flex: 1;
  padding: 4px 8px;
  border: none;
  outline: none;
  font-size: 13px;
}

/* 表格容器 */
.spreadsheet-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.column-headers {
  display: flex;
  padding-left: 40px;
  background: #f3f2f1;
  border-bottom: 1px solid #d2d2d2;
}

.corner-cell {
  position: absolute;
  left: 0;
  top: 0;
  width: 40px;
  height: 20px;
  background: #f3f2f1;
  border-right: 1px solid #d2d2d2;
  border-bottom: 1px solid #d2d2d2;
}

.column-header {
  min-width: 100px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #d2d2d2;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.column-header:hover {
  background: #e1dfdd;
}

.column-header.selected {
  background: #d2e3fc;
}

.spreadsheet-body {
  flex: 1;
  display: flex;
  overflow: auto;
}

.row-headers {
  width: 40px;
  background: #f3f2f1;
  border-right: 1px solid #d2d2d2;
}

.row-header {
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e1dfdd;
  font-size: 11px;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.row-header:hover {
  background: #e1dfdd;
}

.row-header.selected {
  background: #d2e3fc;
}

.cell-grid {
  position: relative;
  min-width: min-content;
  min-height: min-content;
}

.cell {
  width: 100px;
  height: 20px;
  border-right: 1px solid #e1dfdd;
  border-bottom: 1px solid #e1dfdd;
  display: flex;
  align-items: center;
  padding: 0 4px;
  cursor: cell;
  position: relative;
  user-select: none;
}

.cell:hover {
  background: #f8f8f8;
}

.cell.selected {
  outline: 2px solid #107c41;
  outline-offset: -2px;
  z-index: 1;
}

.cell.editing {
  outline: 2px solid #107c41;
  background: #ffffff;
  z-index: 2;
}

.cell.hasFormula {
  background: linear-gradient(90deg, transparent 0%, transparent calc(100% - 4px), rgba(16, 124, 65, 0.3) 100%);
}

.cell-value {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  pointer-events: none;
}

.cell-value.align-right {
  text-align: right;
}

.cell-value.formula-result {
  font-weight: 500;
}

.cell-editor {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0 4px;
  font-size: 12px;
  font-family: inherit;
}

/* 状态栏 */
.status-bar {
  display: flex;
  gap: 24px;
  padding: 4px 12px;
  background: #f3f2f1;
  border-top: 1px solid #e1dfdd;
  font-size: 11px;
  color: #666;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 公式帮助 */
.formula-help {
  position: fixed;
  bottom: 40px;
  left: 20px;
  width: 280px;
  background: #ffffff;
  border: 1px solid #e1dfdd;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 1000;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f3f2f1;
  border-bottom: 1px solid #e1dfdd;
  border-radius: 8px 8px 0 0;
  font-weight: 500;
}

.help-close {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 18px;
  color: #666;
}

.help-content {
  padding: 12px 16px;
}

.help-section {
  font-size: 12px;
}

.help-section ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.help-section li {
  margin: 4px 0;
}

.help-section code {
  background: #f3f2f1;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

.help-toggle {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #107c41;
  color: #ffffff;
  border: none;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1000;
}

.help-toggle:hover {
  background: #0b5c2f;
}

/* 滚动条 */
:deep(.spreadsheet-body)::-webkit-scrollbar {
  width: 14px;
  height: 14px;
}

:deep(.spreadsheet-body)::-webkit-scrollbar-track {
  background: #f3f2f1;
}

:deep(.spreadsheet-body)::-webkit-scrollbar-thumb {
  background: #c8c8c8;
  border-radius: 0;
}

:deep(.spreadsheet-body)::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

:deep(.spreadsheet-body)::-webkit-scrollbar-corner {
  background: #f3f2f1;
}
</style>
