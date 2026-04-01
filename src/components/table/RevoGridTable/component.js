export default {
  name: 'RevoGridTable',
  title: '高性能虚拟表格',
  description: '虚拟滚动高性能表格，支持百万行数据、Excel导航、自定义单元格',
  version: '2.0.0',
  group: 'DataTable',
  category: 'Spreadsheet',
  tags: ['virtual-scroll', 'performance', 'large-data', 'excel-nav'],
  component: './index.vue',
  route: {
    path: '/revogrid',
    meta: { title: '高性能表格', icon: '⚡' }
  },
  fullscreen: true,
  dependencies: []
}
