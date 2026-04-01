export default {
  name: 'NocoDBTable',
  title: 'NocoDB 智能表格',
  description: 'Airtable 风格的智能表格，支持多种视图、字段类型、关系映射',
  version: '1.0.0',
  group: 'DataTable',
  category: 'SmartTable',
  tags: ['airtable', 'nocodb', 'smart-table', 'multi-view', 'relations'],
  component: './index.vue',
  route: {
    path: '/nocodb',
    meta: { title: 'NocoDB 智能表格', icon: '🗃️' }
  },
  fullscreen: true,
  dependencies: []
}
