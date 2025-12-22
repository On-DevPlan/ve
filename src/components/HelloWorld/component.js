export default {
  // 基本信息
  name: 'HelloWorld',
  title: 'Hello World',
  description: '经典的Hello World组件，展示基本的消息展示功能',
  version: '1.0.0',

  // 分组和标签
  group: 'Basic',
  category: 'Display',
  tags: ['basic', 'text', 'demo', 'beginner'],

  // 入口文件
  component: './index.vue',

  // 路由配置
  route: {
    path: '/helloworld',
    meta: {
      title: 'Hello World',
      icon: '👋'
    }
  },

  // 全屏模式（可选）
  fullscreen: true,

  // 默认属性
  defaultProps: {
    msg: 'Hello World!',
    showIcon: true,
    animated: false
  }
}