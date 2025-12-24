export default {
  // 基本信息
  name: 'CyberTemple',
  title: '赛博寺庙',
  description: '供奉赛博菩萨的神圣空间 - GitHub、GLM、硅基流动',
  version: '1.0.0',

  // 分组和标签
  group: 'Three.js',
  category: '3D Scene',
  tags: ['threejs', '3d', 'cyberpunk', 'temple', 'interactive'],

  // 入口文件
  component: './index.vue',

  // 路由配置
  route: {
    path: '/cybertemple',
    meta: {
      title: '赛博寺庙',
      icon: '🛕'
    }
  },

  // 全屏模式
  fullscreen: true,

  // 外部依赖
  dependencies: ['three']
}
