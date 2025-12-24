export default {
  // 基本信息
  name: 'Barrage3D',
  title: '3D弹幕墙',
  description: '使用Three.js创建的3D弹幕墙效果，支持流式滚动和交互',
  version: '1.0.0',

  // 分组和标签
  group: 'Three.js',
  category: '3D Effects',
  tags: ['threejs', '3d', 'barrage', 'animation', 'interactive'],

  // 入口文件
  component: './index.vue',

  // 路由配置
  route: {
    path: '/barrage3d',
    meta: {
      title: '3D弹幕墙',
      icon: '🎬'
    }
  },

  // 全屏模式（这个组件需要整个屏幕）
  fullscreen: true,

  // 外部依赖（仅列出必要的）
  dependencies: ['three']
}