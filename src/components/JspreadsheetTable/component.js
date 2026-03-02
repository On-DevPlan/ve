export default {
  name: 'JspreadsheetTable',
  title: 'Jspreadsheet 表格',
  description: 'Excel 风格的电子表格，支持公式、合并单元格、复制粘贴',
  version: '1.0.0',
  group: 'DataTable',
  category: 'Spreadsheet',
  tags: ['spreadsheet', 'excel', 'formula', 'jspreadsheet'],
  component: './index.vue',
  route: {
    path: '/jspreadsheet',
    meta: { title: 'Jspreadsheet 表格', icon: '📊' }
  },
  fullscreen: true,
  dependencies: ['jspreadsheet-ce', 'jexcel']
}
