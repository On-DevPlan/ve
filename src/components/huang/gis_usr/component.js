export default {
  // === Basic Information ===
  name: 'GISUser',
  title: '演唱会 - 用户侧',
  description: '演唱会巡演路线展示系统（用户模式）- 展示巡演路线、站点信息、播放动画',
  version: '1.0.0',

  // === Grouping & Tags ===
  group: 'Huang',
  category: '旅行日记',
  tags: ['gis', 'map', 'travel', 'concert', '用户展示', '演唱会'],

  // === Entry Point ===
  component: './index.vue',

  // === Routing ===
  route: {
    path: '/components/gis-user',
    meta: {
      title: 'GIS 旅行日记 - 用户展示',
      icon: '🎵'
    }
  },

  // === Display Options ===
  fullscreen: true,

  // === Dependencies ===
  dependencies: ['ol']
}
