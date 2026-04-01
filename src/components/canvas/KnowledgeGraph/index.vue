<script setup>
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import G6 from '@antv/g6'

// 示例数据 - 人物关系图谱
const sampleData = {
  nodes: [
    { id: 'node1', label: '张三', type: 'person', group: '技术部' },
    { id: 'node2', label: '李四', type: 'person', group: '产品部' },
    { id: 'node3', label: '王五', type: 'person', group: '设计部' },
    { id: 'node4', label: '赵六', type: 'person', group: '技术部' },
    { id: 'node5', label: '前端组', type: 'team', group: '技术部' },
    { id: 'node6', label: '后端组', type: 'team', group: '技术部' },
    { id: 'node7', label: '产品组', type: 'team', group: '产品部' },
    { id: 'node8', label: 'UI设计', type: 'team', group: '设计部' },
    { id: 'node9', label: '项目经理', type: 'role', group: '管理层' },
    { id: 'node10', label: '技术总监', type: 'role', group: '管理层' }
  ],
  edges: [
    { source: 'node1', target: 'node5', label: '属于' },
    { source: 'node4', target: 'node5', label: '属于' },
    { source: 'node2', target: 'node7', label: '属于' },
    { source: 'node3', target: 'node8', label: '属于' },
    { source: 'node1', target: 'node2', label: '同事' },
    { source: 'node1', target: 'node3', label: '协作' },
    { source: 'node2', target: 'node3', label: '协作' },
    { source: 'node5', target: 'node6', label: '对接' },
    { source: 'node5', target: 'node7', label: '协作' },
    { source: 'node7', target: 'node8', label: '协作' },
    { source: 'node9', target: 'node2', label: '管理' },
    { source: 'node9', target: 'node3', label: '管理' },
    { source: 'node10', target: 'node1', label: '管理' },
    { source: 'node10', target: 'node4', label: '管理' },
    { source: 'node9', target: 'node10', label: '汇报' }
  ]
}

// 布局类型
const layoutTypes = [
  { value: 'force', label: '力导布局' },
  { value: 'circle', label: '环形布局' },
  { value: 'dagre', label: '层次布局' }
]

const currentLayout = ref('force')
const graphContainer = ref(null)
const graph = shallowRef(null)
const selectedNode = ref(null)
const searchQuery = ref('')
const filterType = ref('all')

// 节点颜色映射
const nodeColors = {
  person: '#3b82f6',
  team: '#22c55e',
  role: '#f59e0b',
  default: '#8b5cf6'
}

// 初始化图谱
function initGraph() {
  if (!graphContainer.value) return

  // 销毁旧图
  if (graph.value) {
    graph.value.destroy()
  }

  const width = graphContainer.value.offsetWidth
  const height = graphContainer.value.offsetHeight

  graph.value = new G6.Graph({
    container: graphContainer.value,
    width,
    height,
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node']
    },
    layout: {
      type: currentLayout.value,
      preventOverlap: true,
      nodeSize: 40,
      ...(currentLayout.value === 'force' && {
        forceSimulation: {
          linkDistance: 150,
          nodeStrength: -400,
          edgeStrength: 0.5
        }
      })
    },
    defaultNode: {
      size: 50,
      style: {
        fill: '#fff',
        stroke: '#3b82f6',
        lineWidth: 2
      },
      labelCfg: {
        style: {
          fill: '#333',
          fontSize: 12
        }
      }
    },
    defaultEdge: {
      size: 1.5,
      style: {
        stroke: '#ccc',
        endArrow: {
          path: G6.Arrow.triangle(6, 8, 0),
          fill: '#ccc'
        }
      },
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#666',
          fontSize: 10
        }
      }
    },
    nodeStateStyles: {
      hover: {
        stroke: '#3b82f6',
        lineWidth: 3
      },
      selected: {
        stroke: '#f59e0b',
        lineWidth: 3
      }
    },
    edgeStateStyles: {
      hover: {
        stroke: '#3b82f6',
        lineWidth: 2
      }
    }
  })

  // 绑定事件
  graph.value.on('node:mouseenter', (e) => {
    graph.value.setItemState(e.item, 'hover', true)
    // 高亮邻居
    highlightNeighbors(e.item)
  })

  graph.value.on('node:mouseleave', () => {
    clearAllStates()
  })

  graph.value.on('node:click', (e) => {
    selectedNode.value = e.item.getModel()
    graph.value.setItemState(e.item, 'selected', true)
  })

  graph.value.on('canvas:click', () => {
    selectedNode.value = null
    clearAllStates()
  })

  // 渲染数据
  renderData()
}

// 渲染数据
function renderData() {
  if (!graph.value) return

  // 应用过滤
  let nodes = [...sampleData.nodes]
  let edges = [...sampleData.edges]

  if (filterType.value !== 'all') {
    nodes = nodes.filter(n => n.type === filterType.value)
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }

  // 应用搜索
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    nodes = nodes.filter(n => n.label.toLowerCase().includes(q))
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }

  // 更新节点样式
  nodes = nodes.map(node => ({
    ...node,
    type: 'circle',
    size: node.type === 'team' ? 60 : 50,
    style: {
      fill: '#fff',
      stroke: nodeColors[node.type] || nodeColors.default,
      lineWidth: 2
    },
    label: node.label
  }))

  graph.value.data({ nodes, edges })
  graph.value.render()
}

// 高亮邻居节点
function highlightNeighbors(node) {
  if (!graph.value) return

  const model = node.getModel()
  const neighbors = graph.value.getNeighbors(node)

  neighbors.forEach(neighbor => {
    graph.value.setItemState(neighbor, 'hover', true)
  })

  // 高亮连接的边
  const edges = graph.value.getEdges()
  edges.forEach(edge => {
    const source = edge.getModel().source
    const target = edge.getModel().target
    if (source === model.id || target === model.id) {
      edge.update({ style: { stroke: '#3b82f6', lineWidth: 2 } })
    }
  })
}

// 清除所有状态
function clearAllStates() {
  if (!graph.value) return

  const nodes = graph.value.getNodes()
  const edges = graph.value.getEdges()

  nodes.forEach(node => {
    graph.value.clearItemStates(node)
  })

  edges.forEach(edge => {
    edge.update({ style: { stroke: '#ccc', lineWidth: 1.5 } })
  })
}

// 切换布局
function changeLayout() {
  if (graph.value) {
    graph.value.updateLayout({ type: currentLayout.value })
    graph.value.render()
  }
}

// 适应画布
function fitView() {
  if (graph.value) {
    graph.value.fitView(20)
  }
}

onMounted(() => {
  initGraph()
  window.addEventListener('resize', initGraph)
})

onUnmounted(() => {
  window.removeEventListener('resize', initGraph)
  if (graph.value) {
    graph.value.destroy()
  }
})
</script>

<template>
  <div class="knowledge-graph">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-section">
        <span class="toolbar-label">布局:</span>
        <select v-model="currentLayout" class="toolbar-select" @change="changeLayout">
          <option v-for="lt in layoutTypes" :key="lt.value" :value="lt.value">
            {{ lt.label }}
          </option>
        </select>
      </div>
      <div class="toolbar-section">
        <span class="toolbar-label">筛选:</span>
        <select v-model="filterType" class="toolbar-select" @change="renderData">
          <option value="all">全部</option>
          <option value="person">人员</option>
          <option value="team">团队</option>
          <option value="role">角色</option>
        </select>
      </div>
      <div class="toolbar-section search-section">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索节点..."
          class="search-input"
          @input="renderData"
        />
      </div>
      <div class="toolbar-section">
        <button class="action-btn" @click="fitView">
          🎯 适应画布
        </button>
      </div>
    </div>

    <!-- 图谱容器 -->
    <div class="graph-wrapper" ref="graphContainer"></div>

    <!-- 选中节点信息 -->
    <div v-if="selectedNode" class="info-panel">
      <div class="panel-header">
        <span>节点信息</span>
        <button class="close-btn" @click="selectedNode = null">×</button>
      </div>
      <div class="panel-content">
        <div class="info-item">
          <label>名称:</label>
          <span>{{ selectedNode.label }}</span>
        </div>
        <div class="info-item">
          <label>类型:</label>
          <span class="type-badge" :style="{ background: nodeColors[selectedNode.type] }">
            {{ selectedNode.type === 'person' ? '人员' : selectedNode.type === 'team' ? '团队' : '角色' }}
          </span>
        </div>
        <div class="info-item">
          <label>部门:</label>
          <span>{{ selectedNode.group }}</span>
        </div>
        <div class="info-item">
          <label>ID:</label>
          <span class="mono">{{ selectedNode.id }}</span>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot" style="background: #3b82f6"></span>
        <span>人员</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="background: #22c55e"></span>
        <span>团队</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="background: #f59e0b"></span>
        <span>角色</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-graph {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  gap: 20px;
  flex-wrap: wrap;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-section {
  flex: 1;
  max-width: 200px;
}

.toolbar-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.toolbar-select {
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
  cursor: pointer;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
}

.action-btn {
  padding: 8px 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #2563eb;
}

.graph-wrapper {
  flex: 1;
  min-height: 0;
}

.info-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 220px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
  font-size: 14px;
}

.close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
}

.panel-content {
  padding: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item label {
  font-size: 12px;
  color: #888;
}

.info-item span {
  font-size: 13px;
  color: #1a1a1f;
}

.type-badge {
  padding: 2px 8px;
  border-radius: 10px;
  color: #fff;
  font-size: 11px;
}

.mono {
  font-family: monospace;
  font-size: 12px;
}

.legend {
  position: absolute;
  left: 20px;
  bottom: 20px;
  background: #fff;
  padding: 12px 16px;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
