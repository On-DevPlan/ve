export default {
  // 组件基本信息
  name: 'Barrage3D',
  title: '3D弹幕墙',
  description: '使用Three.js创建的3D弹幕墙效果，支持流式滚动和交互',
  version: '1.0.0',

  // 分组信息
  group: 'Three.js',
  category: '3D Effects',
  tags: ['threejs', '3d', 'barrage', 'animation', 'interactive'],

  // 入口文件
  component: './index.vue',

  // 资源声明
  resources: {
    // 外部依赖
    dependencies: ['three'],

    // 静态资源（相对于当前目录）
    assets: [],

    // 预加载资源
    preload: []
  },

  // 组件配置
  config: {
    // 默认配置
    defaultProps: {
      width: '100%',
      height: '100vh',
      autoPlay: true
    },

    // 性能相关
    performance: {
      lazy: true, // 支持懒加载
      suspense: true, // 使用Suspense包装
      cache: true // 启用缓存
    },

    // 路由相关
    route: {
      path: '/barrage3d',
      name: 'Barrage3D',
      meta: {
        title: '3D弹幕墙',
        icon: '🎬',
        keepAlive: false
      }
    }
  },

  // 预览配置
  preview: {
    // 缩略图（相对于当前目录）
    thumbnail: './preview.png',
    // 演示配置
    demo: {
      showCode: false,
      showControls: true,
      defaultTab: 'demo'
    }
  },

  // 作者和文档信息
  author: 'Demo Team',
  docs: {
    readme: './README.md',
    api: './api.md'
  }
}