export default {
  name: 'DataTable',
  title: '可视化数据面板',
  description: 'Notion 风格的数据表格，支持 CRUD、导入导出、内联编辑',
  version: '2.0.0',
  group: 'Data',
  category: 'Table',
  tags: ['table', 'data', 'crud', 'notion', 'excel'],
  component: './index.vue',
  route: {
    path: '/datatable',
    meta: { title: '数据面板', icon: '📊' }
  },
  fullscreen: true,
  dependencies: ['vxe-table']
}
