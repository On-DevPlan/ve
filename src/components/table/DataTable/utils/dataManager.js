/**
 * 数据管理工具 - 处理 CRUD 操作和公式计算
 */

export class DataManager {
  constructor() {
    this.data = []
    this.nextId = 1
  }

  /**
   * 加载初始数据
   */
  loadData(initialData = []) {
    this.data = initialData.map((row, index) => ({
      ...row,
      id: row.id || `row-${index + 1}`,
    }))
    this.nextId = this.data.length + 1
    return [...this.data]
  }

  /**
   * 获取所有数据
   */
  getData() {
    return [...this.data]
  }

  /**
   * 根据ID获取单行数据
   */
  getRowById(id) {
    return this.data.find(row => row.id === id)
  }

  /**
   * 添加新行
   */
  addRow(rowData = {}) {
    const newRow = {
      id: rowData.id || `row-${this.nextId++}`,
      createdAt: rowData.createdAt || new Date().toISOString(),
      ...rowData,
    }
    this.data.push(newRow)
    return newRow
  }

  /**
   * 批量添加行
   */
  addRows(rowsData) {
    return rowsData.map(row => this.addRow(row))
  }

  /**
   * 更新行数据
   */
  updateRow(id, newData) {
    const index = this.data.findIndex(row => row.id === id)
    if (index !== -1) {
      this.data[index] = {
        ...this.data[index],
        ...newData,
        id, // 确保ID不被修改
      }
      return this.data[index]
    }
    return null
  }

  /**
   * 删除行
   */
  deleteRow(id) {
    const index = this.data.findIndex(row => row.id === id)
    if (index !== -1) {
      const deleted = this.data.splice(index, 1)[0]
      return deleted
    }
    return null
  }

  /**
   * 批量删除行
   */
  deleteRows(ids) {
    return ids.map(id => this.deleteRow(id)).filter(Boolean)
  }

  /**
   * 清空所有数据
   */
  clear() {
    this.data = []
    this.nextId = 1
  }

  /**
   * 获取数据统计
   */
  getStats() {
    return {
      total: this.data.length,
      nextId: this.nextId,
    }
  }

  /**
   * 应用公式计算
   */
  applyFormula(formula, columnDef, api) {
    const { field } = columnDef
    this.data.forEach(row => {
      try {
        if (typeof formula === 'function') {
          row[field] = formula({ data: row, api, colDef: columnDef })
        }
      } catch (e) {
        console.error('Formula error:', e)
      }
    })
    return [...this.data]
  }

  /**
   * 数据聚合
   */
  aggregate(column, operation = 'sum') {
    const values = this.data.map(row => parseFloat(row[column]) || 0)

    switch (operation.toLowerCase()) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0)
      case 'avg':
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
      case 'count':
        return this.data.filter(row => row[column] != null).length
      default:
        return null
    }
  }

  /**
   * 分组统计
   */
  groupBy(column, aggregations = {}) {
    const groups = {}

    this.data.forEach(row => {
      const key = row[column] || '未分类'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(row)
    })

    // 计算聚合值
    const result = {}
    Object.entries(groups).forEach(([key, rows]) => {
      result[key] = {
        count: rows.length,
      }

      Object.entries(aggregations).forEach(([aggCol, operation]) => {
        const values = rows.map(r => parseFloat(r[aggCol]) || 0)
        switch (operation.toLowerCase()) {
          case 'sum':
            result[key][aggCol] = values.reduce((a, b) => a + b, 0)
            break
          case 'avg':
            result[key][aggCol] = values.reduce((a, b) => a + b, 0) / values.length
            break
          case 'min':
            result[key][aggCol] = Math.min(...values)
            break
          case 'max':
            result[key][aggCol] = Math.max(...values)
            break
        }
      })
    })

    return result
  }

  /**
   * 搜索数据
   */
  search(query, columns = []) {
    if (!query) return [...this.data]

    const lowerQuery = query.toLowerCase()
    return this.data.filter(row => {
      if (columns.length === 0) {
        // 搜索所有字段
        return Object.values(row).some(
          val => val != null && String(val).toLowerCase().includes(lowerQuery)
        )
      } else {
        // 搜索指定字段
        return columns.some(col =>
          row[col] != null && String(row[col]).toLowerCase().includes(lowerQuery)
        )
      }
    })
  }

  /**
   * 排序数据
   */
  sort(column, order = 'asc') {
    return [...this.data].sort((a, b) => {
      const aVal = a[column]
      const bVal = b[column]

      if (aVal == null) return 1
      if (bVal == null) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return order === 'desc' ? -comparison : comparison
    })
  }

  /**
   * 导出为 JSON
   */
  toJSON() {
    return JSON.stringify(this.data, null, 2)
  }

  /**
   * 从 JSON 导入
   */
  fromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      return this.loadData(data)
    } catch (e) {
      console.error('JSON import error:', e)
      return null
    }
  }
}

// 默认数据模板
export const sampleData = [
  {
    id: 'task-1',
    name: '完成项目文档',
    status: '进行中',
    priority: '高',
    progress: 75,
    assignee: '张三',
    dueDate: '2025-03-15',
    createdAt: '2025-03-01',
  },
  {
    id: 'task-2',
    name: '修复登录 Bug',
    status: '待处理',
    priority: '紧急',
    progress: 0,
    assignee: '李四',
    dueDate: '2025-03-05',
    createdAt: '2025-03-02',
  },
  {
    id: 'task-3',
    name: '优化数据库查询',
    status: '已完成',
    priority: '中',
    progress: 100,
    assignee: '王五',
    dueDate: '2025-02-28',
    createdAt: '2025-02-20',
  },
  {
    id: 'task-4',
    name: '设计新功能原型',
    status: '进行中',
    priority: '中',
    progress: 40,
    assignee: '赵六',
    dueDate: '2025-03-20',
    createdAt: '2025-02-25',
  },
  {
    id: 'task-5',
    name: '编写单元测试',
    status: '待处理',
    priority: '低',
    progress: 0,
    assignee: '张三',
    dueDate: '2025-03-25',
    createdAt: '2025-03-01',
  },
]
