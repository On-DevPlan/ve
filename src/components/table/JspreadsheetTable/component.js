export default {
  name: 'JspreadsheetTable',
  title: 'Excel 电子表格',
  description: 'Excel 风格的电子表格，支持公式、合并单元格、复制粘贴',
  version: '2.0.0',
  group: 'DataTable',
  category: 'Spreadsheet',
  tags: ['spreadsheet', 'excel', 'formula', 'cell-editor'],
  component: './index.vue',
  route: {
    path: '/jspreadsheet',
    meta: { title: 'Excel 表格', icon: '📊' }
  },
  fullscreen: true,
  dependencies: []
}
