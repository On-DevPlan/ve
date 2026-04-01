export default {
  name: 'Whiteboard',
  title: '通用白板',
  description: '卡片/便签、箭头连线、导出图片 - 基于 tldraw 的零配置白板',
  version: '1.0.0',
  group: 'Canvas',
  category: 'Drawing',
  tags: ['whiteboard', 'canvas', 'sticky-notes', 'drawing'],
  component: './index.vue',
  route: {
    path: '/whiteboard',
    meta: {
      title: '通用白板',
      icon: '📝'
    }
  },
  fullscreen: true,
  dependencies: ['@tldraw/tldraw']
}
