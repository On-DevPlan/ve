export default {
  // 基本信息
  name: 'map',
  title: '中国地图可视化',
  description: '基于ECharts的交互式中国地图，支持散点标记、飞线动画、省份高亮等交互效果',
  version: '1.0.0',

  // 分组和标签
  group: 'Visualization',
  category: 'Map',
  tags: ['echarts', 'map', 'china', 'visualization', 'interactive'],

  // 入口文件
  component: './index.vue',

  // 路由配置
  route: {
    path: '/map',
    meta: {
      title: '中国地图',
      icon: '🗺️'
    }
  },

  // 全屏模式
  fullscreen: true,

  // 外部依赖
  dependencies: ['echarts']
}
