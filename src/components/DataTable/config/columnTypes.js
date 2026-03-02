// AG Grid 列类型定义

export const columnTypes = {
  // 文本列
  text: {
    filter: 'agTextColumnFilter',
    sortable: true,
    editable: true,
    cellEditor: 'agTextCellEditor',
  },

  // 数字列
  number: {
    filter: 'agNumberColumnFilter',
    sortable: true,
    editable: true,
    cellEditor: 'agNumberCellEditor',
    valueFormatter: (params) => {
      if (params.value == null) return ''
      return params.value.toLocaleString()
    },
  },

  // 日期列
  date: {
    filter: 'agDateColumnFilter',
    sortable: true,
    editable: true,
    cellEditor: 'agDateCellEditor',
    valueFormatter: (params) => {
      if (!params.value) return ''
      const date = new Date(params.value)
      return date.toLocaleDateString('zh-CN')
    },
  },

  // 单选列
  select: {
    filter: true,
    sortable: true,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => ({
      values: params.colDef?.values || [],
    }),
  },

  // 公式列（只读）
  formula: {
    filter: false,
    sortable: true,
    editable: false,
    valueGetter: (params) => {
      const formula = params.colDef?.formula
      if (typeof formula === 'function') {
        return formula(params)
      }
      if (typeof formula === 'string') {
        return evaluateFormula(formula, params)
      }
      return null
    },
  },

  // 标签列（带颜色）
  tag: {
    filter: true,
    sortable: true,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => ({
      values: params.colDef?.values || [],
    }),
    cellClass: (params) => {
      const value = params.value
      const colorMap = params.colDef?.colorMap || {}
      return [`tag-cell tag-${value}`, colorMap[value] || 'tag-default']
    },
  },

  // 进度条列
  progress: {
    filter: 'agNumberColumnFilter',
    sortable: true,
    editable: true,
    cellEditor: 'agNumberCellEditor',
    valueFormatter: (params) => {
      if (params.value == null) return '0%'
      return `${Math.min(100, Math.max(0, params.value))}%`
    },
    cellClass: ['progress-cell'],
  },

  // 复选框列
  checkbox: {
    filter: true,
    sortable: true,
    editable: true,
    cellRenderer: 'agCheckboxCellRenderer',
    valueGetter: (params) => params.data?.[params.colDef?.field] || false,
    valueSetter: (params) => {
      params.data[params.colDef.field] = params.newValue
      return true
    },
  },
}

// 默认列配置
export const defaultColDef = {
  flex: 1,
  minWidth: 100,
  resizable: true,
  headerClass: 'notion-header',
  cellClass: 'notion-cell',
  sortable: true,
  filter: true,
  editable: true,
  flex: 1,
  minWidth: 120,
}

// 预定义列配置
export const presetColumns = {
  id: {
    field: 'id',
    headerName: 'ID',
    type: 'text',
    width: 80,
    editable: false,
    pinned: 'left',
  },
  name: {
    field: 'name',
    headerName: '名称',
    type: 'text',
    minWidth: 150,
  },
  status: {
    field: 'status',
    headerName: '状态',
    type: 'tag',
    values: ['待处理', '进行中', '已完成', '已取消'],
    colorMap: {
      '待处理': 'tag-gray',
      '进行中': 'tag-blue',
      '已完成': 'tag-green',
      '已取消': 'tag-red',
    },
  },
  priority: {
    field: 'priority',
    headerName: '优先级',
    type: 'select',
    values: ['低', '中', '高', '紧急'],
  },
  progress: {
    field: 'progress',
    headerName: '进度',
    type: 'number',
  },
  assignee: {
    field: 'assignee',
    headerName: '负责人',
    type: 'text',
  },
  dueDate: {
    field: 'dueDate',
    headerName: '截止日期',
    type: 'date',
  },
  createdAt: {
    field: 'createdAt',
    headerName: '创建时间',
    type: 'date',
    editable: false,
  },
}

// 简单公式求值
function evaluateFormula(formula, params) {
  try {
    // 简单的公式解析
    const data = params.data
    const api = params.api

    // SUM 函数
    if (formula.startsWith('SUM(')) {
      const range = formula.match(/SUM\(([^)]+)\)/)?.[1]
      if (range) {
        const cols = range.split(',')
        return cols.reduce((sum, col) => sum + (parseFloat(data[col?.trim()]) || 0), 0)
      }
    }

    // AVERAGE 函数
    if (formula.startsWith('AVERAGE(')) {
      const range = formula.match(/AVERAGE\(([^)]+)\)/)?.[1]
      if (range) {
        const cols = range.split(',')
        const values = cols.map(col => parseFloat(data[col?.trim()]) || 0)
        return values.reduce((a, b) => a + b, 0) / values.length
      }
    }

    // COUNT 函数
    if (formula.startsWith('COUNT(')) {
      const range = formula.match(/COUNT\(([^)]+)\)/)?.[1]
      if (range) {
        const cols = range.split(',')
        return cols.filter(col => data[col?.trim()] != null).length
      }
    }

    return null
  } catch (e) {
    console.error('Formula evaluation error:', e)
    return null
  }
}
