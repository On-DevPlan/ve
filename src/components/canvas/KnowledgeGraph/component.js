export default {
  name: 'KnowledgeGraph',
  title: '知识图谱探索',
  description: '力导/层次布局、邻居高亮、过滤、聚合(Cluster)、渐进加载 - 基于 AntV G6',
  version: '1.0.0',
  group: 'Canvas',
  category: 'Graph',
  tags: ['knowledge-graph', 'network', 'force-directed', 'exploration'],
  component: './index.vue',
  route: {
    path: '/knowledge-graph',
    meta: {
      title: '知识图谱',
      icon: '🕸️'
    }
  },
  fullscreen: true,
  dependencies: ['@antv/g6']
}
