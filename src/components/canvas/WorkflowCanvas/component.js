export default {
  name: 'WorkflowCanvas',
  title: '工作流编排画布',
  description: '拖拽节点、连线、端口校验、属性面板、序列化/导入导出、自动布局 - 基于 Vue Flow',
  version: '1.0.0',
  group: 'Canvas',
  category: 'Workflow',
  tags: ['workflow', 'dag', 'nodes', 'edges', 'automation'],
  component: './index.vue',
  route: {
    path: '/workflow-canvas',
    meta: {
      title: '工作流编排',
      icon: '🔀'
    }
  },
  fullscreen: true,
  dependencies: ['@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', '@vue-flow/minimap']
}
