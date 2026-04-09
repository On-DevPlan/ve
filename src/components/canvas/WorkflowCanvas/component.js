export default {
  name: 'WorkflowCanvas',
  title: 'Workflow Canvas',
  description: 'Node-based workflow canvas with ImageNode, InputNode, and TextNode - supports paste/drag/upload images, text input, and text display nodes',
  version: '1.1.0',
  group: 'Canvas',
  category: 'Workflow',
  tags: ['workflow', 'dag', 'nodes', 'edges', 'canvas', 'image', 'input'],
  component: './index.vue',
  route: {
    path: '/workflow-canvas',
    meta: {
      title: 'Workflow Canvas',
      icon: '🔀'
    }
  },
  fullscreen: true,
  dependencies: ['@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', '@vue-flow/minimap']
}
