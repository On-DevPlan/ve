export default {
  name: 'RevoGridTable',
  title: 'RevoGrid 高性能表格',
  description: '虚拟滚动高性能表格，支持百万行数据、Excel导航、自定义单元格',
  version: '1.0.0',
  group: 'DataTable',
  category: 'Spreadsheet',
  tags: ['spreadsheet', 'virtual-scroll', 'performance', 'revogrid'],
  component: './index.vue',
  route: {
    path: '/revogrid',
    meta: { title: 'RevoGrid 表格', icon: '⚡' }
  },
  fullscreen: true,
  dependencies: ['@revolist/revogrid']
}
