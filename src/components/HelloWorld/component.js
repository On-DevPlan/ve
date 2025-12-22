export default {
  // 组件基本信息
  name: 'HelloWorld',
  title: 'Hello World',
  description: '经典的Hello World组件，展示基本的消息展示功能',
  version: '1.0.0',

  // 分组信息
  group: 'Basic',
  category: 'Display',
  tags: ['basic', 'text', 'demo', 'beginner'],

  // 入口文件
  component: './index.vue',

  // 资源声明
  resources: {
    // 外部依赖
    dependencies: [],

    // 静态资源（相对于当前目录）
    assets: [],

    // 预加载资源
    preload: []
  },

  // 组件配置
  config: {
    // 默认配置
    defaultProps: {
      msg: 'Hello World!',
      showIcon: true,
      animated: false
    },

    // 性能相关
    performance: {
      lazy: false,
      suspense: false,
      cache: true
    },

    // 路由相关
    route: {
      path: '/helloworld',
      name: 'HelloWorld',
      meta: {
        title: 'Hello World',
        icon: '👋',
        keepAlive: true
      }
    }
  },

  // 预览配置
  preview: {
    // 缩略图（相对于当前目录）
    thumbnail: './preview.png',
    // 演示配置
    demo: {
      showCode: true,
      showControls: true,
      defaultTab: 'demo',
      style: {
        background: '#f0f0f0'
      }
    }
  },

  // 作者和文档信息
  author: 'Demo Team',
  docs: {
    readme: './README.md',
    api: './api.md'
  }
}