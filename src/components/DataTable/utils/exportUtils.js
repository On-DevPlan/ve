/**
 * 导入导出工具 - 支持 Excel、CSV、JSON 格式
 */

/**
 * 导出为 CSV
 */
export function exportToCSV(gridApi, filename = 'data-export.csv') {
  if (!gridApi) return

  // 获取所有行数据
  const rowData = []
  gridApi.forEachNodeAfterFilterAndSort(node => rowData.push(node.data))

  if (rowData.length === 0) {
    console.warn('No data to export')
    return
  }

  // 获取列定义
  const columns = gridApi.getColumns()
  const headers = columns.map(col => col.getColDef().headerName || col.getColId())

  // 构建 CSV 内容
  const csvRows = []

  // 添加表头
  csvRows.push(headers.map(h => `"${h}"`).join(','))

  // 添加数据行
  rowData.forEach(row => {
    const values = columns.map(col => {
      const field = col.getColId()
      const value = row[field]
      // 处理包含逗号、引号或换行的值
      if (value == null) return '""'
      const strValue = String(value)
      const escaped = strValue.replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  })

  // 添加 BOM 以支持 Excel 正确识别 UTF-8
  const BOM = '\uFEFF'
  const csvContent = BOM + csvRows.join('\n')

  // 下载文件
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8')
}

/**
 * 导出为 JSON
 */
export function exportToJSON(gridApi, filename = 'data-export.json') {
  if (!gridApi) return

  const rowData = []
  gridApi.forEachNodeAfterFilterAndSort(node => rowData.push(node.data))

  if (rowData.length === 0) {
    console.warn('No data to export')
    return
  }

  const jsonContent = JSON.stringify(rowData, null, 2)
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8')
}

/**
 * 导出为 Excel (使用 CSV 格式，Excel 可以打开)
 */
export function exportToExcel(gridApi, filename = 'data-export.xlsx') {
  // 使用 CSV 格式，带 .xlsx 扩展名，Excel 可以正确打开
  exportToCSV(gridApi, filename)
}

/**
 * 导出为 Markdown 表格
 */
export function exportToMarkdown(gridApi, filename = 'data-export.md') {
  if (!gridApi) return

  const rowData = []
  gridApi.forEachNodeAfterFilterAndSort(node => rowData.push(node.data))

  if (rowData.length === 0) {
    console.warn('No data to export')
    return
  }

  const columns = gridApi.getColumns()
  const headers = columns.map(col => col.getColDef().headerName || col.getColId())

  // 构建 Markdown 表格
  const mdRows = []

  // 表头
  mdRows.push('| ' + headers.join(' | ') + ' |')
  mdRows.push('| ' + headers.map(() => '---').join(' | ') + ' |')

  // 数据行
  rowData.forEach(row => {
    const values = columns.map(col => {
      const field = col.getColId()
      const value = row[field]
      return value != null ? String(value) : ''
    })
    mdRows.push('| ' + values.join(' | ') + ' |')
  })

  const mdContent = mdRows.join('\n')
  downloadFile(mdContent, filename, 'text/markdown;charset=utf-8')
}

/**
 * 从 CSV 文件导入
 */
export function importFromCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.split(/\r?\n/).filter(line => line.trim())

        if (lines.length < 2) {
          reject(new Error('CSV 文件为空或格式不正确'))
          return
        }

        // 解析表头
        const headers = parseCSVLine(lines[0])

        // 解析数据行
        const data = []
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          if (values.length > 0) {
            const row = {}
            headers.forEach((header, index) => {
              row[header] = values[index] || ''
            })
            data.push(row)
          }
        }

        resolve(data)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * 从 JSON 文件导入
 */
export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (Array.isArray(data)) {
          resolve(data)
        } else {
          reject(new Error('JSON 格式不正确，需要数组格式'))
        }
      } catch (error) {
        reject(new Error('JSON 解析失败: ' + error.message))
      }
    }

    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * 从 Excel 文件导入 (使用 CSV 解析)
 */
export function importFromExcel(file) {
  // Excel 导入需要额外的库支持
  // 这里简单使用 CSV 解析，用户可以将 Excel 另存为 CSV
  return importFromCSV(file)
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的引号
        current += '"'
        i++
      } else {
        // 切换引号状态
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 字段分隔符
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // 添加最后一个字段
  result.push(current.trim())

  return result
}

/**
 * 下载文件
 */
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

/**
 * 复制表格数据到剪贴板
 */
export function copyToClipboard(gridApi) {
  if (!gridApi) return

  const rowData = []
  gridApi.forEachNodeAfterFilterAndSort(node => rowData.push(node.data))

  if (rowData.length === 0) return

  const columns = gridApi.getColumns()
  const headers = columns.map(col => col.getColDef().headerName || col.getColId())

  // 构建 TSV 格式（制表符分隔）
  const tsvRows = [headers.join('\t')]
  rowData.forEach(row => {
    const values = columns.map(col => {
      const field = col.getColId()
      return row[field] != null ? String(row[field]) : ''
    })
    tsvRows.push(values.join('\t'))
  })

  const tsvContent = tsvRows.join('\n')

  // 写入剪贴板
  if (navigator.clipboard) {
    navigator.clipboard.writeText(tsvContent).catch(err => {
      console.error('复制失败:', err)
    })
  } else {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = tsvContent
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

/**
 * 从剪贴板粘贴数据
 */
export function pasteFromClipboard() {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard) {
      navigator.clipboard.readText()
        .then(text => {
          // 尝试解析 TSV 或 CSV 格式
          const lines = text.split(/\r?\n/).filter(line => line.trim())
          if (lines.length > 0) {
            const separator = lines[0].includes('\t') ? '\t' : ','
            const headers = parseCSVLine(lines[0].replace(/\t/g, ','))
            const data = []

            for (let i = 1; i < lines.length; i++) {
              const values = parseCSVLine(lines[i].replace(/\t/g, ','))
              if (values.length > 0) {
                const row = {}
                headers.forEach((header, index) => {
                  row[header] = values[index] || ''
                })
                data.push(row)
              }
            }

            resolve(data)
          } else {
            reject(new Error('剪贴板为空'))
          }
        })
        .catch(reject)
    } else {
      reject(new Error('浏览器不支持剪贴板 API'))
    }
  })
}
