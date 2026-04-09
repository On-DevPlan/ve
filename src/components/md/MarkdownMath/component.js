export default {
  name: 'MarkdownMath',
  title: 'MD数学渲染',
  description: 'Markdown + LaTeX 数学公式渲染，支持行内公式和块级公式',
  version: '1.0.0',
  group: 'Basic',
  category: 'Text',
  tags: ['markdown', 'latex', 'math', 'katex', 'formula'],
  component: './index.vue',
  route: {
    path: '/markdown-math',
    meta: {
      title: 'MD数学渲染',
      icon: '∑'
    }
  },
  fullscreen: true
}
