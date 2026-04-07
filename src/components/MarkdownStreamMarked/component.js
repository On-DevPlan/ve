export default {
  name: 'MarkdownStreamMarked',
  title: 'MD流式输出-marked版',
  description: '基于marked库的Markdown流式渲染器，高保真渲染，打字机效果',
  version: '1.0.0',
  group: 'Basic',
  category: 'Text',
  tags: ['markdown', 'stream', 'typing', 'marked', 'renderer'],
  component: './index.vue',
  route: {
    path: '/markdown-stream-marked',
    meta: {
      title: 'MD流式输出-marked版',
      icon: '📜'
    }
  },
  fullscreen: true
}
