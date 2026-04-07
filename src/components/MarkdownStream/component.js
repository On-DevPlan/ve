export default {
  name: 'MarkdownStream',
  title: 'MD流式输出',
  description: '高质量Markdown流式输出渲染器，支持节流控制，打字机效果',
  version: '1.0.0',
  group: 'Basic',
  category: 'Text',
  tags: ['markdown', 'stream', 'typing', 'renderer', 'throttle'],
  component: './index.vue',
  route: {
    path: '/markdown-stream',
    meta: {
      title: 'MD流式输出',
      icon: '📝'
    }
  },
  fullscreen: true
}
