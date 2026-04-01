<script setup>
import { ref, computed, onMounted } from 'vue'
import { VueFlow, useVueFlow, Position } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

// 默认节点类型定义
const nodeTypes = {
  start: {
    type: 'start',
    label: '开始',
    icon: '▶',
    color: '#22c55e',
    outputs: ['output']
  },
  task: {
    type: 'task',
    label: '任务',
    icon: '📋',
    color: '#3b82f6',
    inputs: ['input'],
    outputs: ['output']
  },
  condition: {
    type: 'condition',
    label: '条件',
    icon: '❓',
    color: '#f59e0b',
    inputs: ['input'],
    outputs: ['output-yes', 'output-no']
  },
  end: {
    type: 'end',
    label: '结束',
    icon: '⏹',
    color: '#ef4444',
    inputs: ['input']
  }
}

// 初始节点
const initialNodes = ref([
  {
    id: 'start-1',
    type: 'start',
    position: { x: 100, y: 200 },
    data: { label: '开始', icon: '▶', color: '#22c55e' }
  },
  {
    id: 'task-1',
    type: 'task',
    position: { x: 300, y: 200 },
    data: { label: '输入数据', icon: '📋', color: '#3b82f6' }
  },
  {
    id: 'task-2',
    type: 'task',
    position: { x: 500, y: 200 },
    data: { label: '处理', icon: '⚙️', color: '#3b82f6' }
  },
  {
    id: 'condition-1',
    type: 'condition',
    position: { x: 700, y: 200 },
    data: { label: '是否成功?', icon: '❓', color: '#f59e0b' }
  },
  {
    id: 'end-success',
    type: 'end',
    position: { x: 900, y: 100 },
    data: { label: '成功', icon: '✅', color: '#22c55e' }
  },
  {
    id: 'end-fail',
    type: 'end',
    position: { x: 900, y: 300 },
    data: { label: '失败', icon: '❌', color: '#ef4444' }
  }
])

// 初始边
const initialEdges = ref([
  { id: 'e1-2', source: 'start-1', target: 'task-1', label: '', animated: true },
  { id: 'e2-3', source: 'task-1', target: 'task-2', label: '' },
  { id: 'e3-4', source: 'task-2', target: 'condition-1', label: '' },
  { id: 'e4-5', source: 'condition-1', target: 'end-success', label: '是', sourceHandle: 'output-yes' },
  { id: 'e4-6', source: 'condition-1', target: 'end-fail', label: '否', sourceHandle: 'output-no' }
])

const nodes = ref([...initialNodes.value])
const edges = ref([...initialEdges.value])
const selectedNode = ref(null)

// Vue Flow 实例
const { onConnect, addEdges, onNodeClick, fitView } = useVueFlow()

// 连接处理
onConnect((params) => {
  addEdges([params])
})

// 节点点击
onNodeClick(({ node }) => {
  selectedNode.value = node
})

// 添加节点
function addNode(type) {
  const typeConfig = nodeTypes[type]
  const newNode = {
    id: `${type}-${Date.now()}`,
    type: type,
    position: { x: 400 + Math.random() * 100, y: 300 + Math.random() * 100 },
    data: { label: typeConfig.label, icon: typeConfig.icon, color: typeConfig.color }
  }
  nodes.value.push(newNode)
}

// 删除选中节点
function deleteSelectedNode() {
  if (selectedNode.value) {
    nodes.value = nodes.value.filter(n => n.id !== selectedNode.value.id)
    edges.value = edges.value.filter(e => e.source !== selectedNode.value.id && e.target !== selectedNode.value.id)
    selectedNode.value = null
  }
}

// 导出 JSON
function exportJSON() {
  const data = {
    version: '1.0',
    nodes: nodes.value,
    edges: edges.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'workflow.json'
  a.click()
  URL.revokeObjectURL(url)
}

// 导入 JSON
function importJSON(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (data.nodes && data.edges) {
          nodes.value = data.nodes
          edges.value = data.edges
        }
      } catch (err) {
        console.error('Failed to import JSON:', err)
      }
    }
    reader.readAsText(file)
  }
}

// 自动布局
function autoLayout() {
  // 简单的层次布局
  const levels = { start: 0, task: 1, condition: 2, end: 3 }
  nodes.value.forEach(node => {
    const level = levels[node.type] ?? 1
    node.position = {
      x: 100 + level * 200,
      y: 150 + (nodes.value.filter(n => levels[n.type] === level).indexOf(node)) * 80
    }
  })
  fitView()
}

// 工具栏按钮配置
const toolbarButtons = [
  { type: 'start', label: '开始', icon: '▶' },
  { type: 'task', label: '任务', icon: '📋' },
  { type: 'condition', label: '条件', icon: '❓' },
  { type: 'end', label: '结束', icon: '⏹' }
]

onMounted(() => {
  setTimeout(() => fitView(), 100)
})
</script>

<template>
  <div class="workflow-canvas">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-section">
        <span class="toolbar-label">添加节点:</span>
        <button
          v-for="btn in toolbarButtons"
          :key="btn.type"
          class="toolbar-btn"
          :style="{ borderColor: nodeTypes[btn.type].color }"
          @click="addNode(btn.type)"
        >
          <span>{{ btn.icon }}</span>
          <span>{{ btn.label }}</span>
        </button>
      </div>
      <div class="toolbar-section">
        <button class="action-btn" @click="deleteSelectedNode" :disabled="!selectedNode">
          🗑️ 删除
        </button>
        <button class="action-btn" @click="autoLayout">
          📐 自动布局
        </button>
        <button class="action-btn" @click="exportJSON">
          💾 导出
        </button>
        <label class="action-btn import-btn">
          📂 导入
          <input type="file" accept=".json" @change="importJSON" hidden />
        </label>
      </div>
    </div>

    <!-- 画布 -->
    <div class="canvas-wrapper">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="['start', 'task', 'condition', 'end']"
        :default-viewport="{ x: 0, y: 0, zoom: 0.8 }"
        fit-view-on-init
        :class="{ 'has-selection': selectedNode }"
      >
        <Background pattern-color="#aaa" :gap="16" />
        <Controls />
        <MiniMap />

        <!-- 自定义节点模板 -->
        <template #node-start=" { data, id }">
          <div class="flow-node start-node" :style="{ borderColor: data.color }">
            <span class="node-icon">{{ data.icon }}</span>
            <span class="node-label">{{ data.label }}</span>
          </div>
        </template>

        <template #node-task="{ data }">
          <div class="flow-node task-node" :style="{ borderColor: data.color }">
            <span class="node-icon">{{ data.icon }}</span>
            <span class="node-label">{{ data.label }}</span>
          </div>
        </template>

        <template #node-condition="{ data }">
          <div class="flow-node condition-node" :style="{ borderColor: data.color }">
            <span class="node-icon">{{ data.icon }}</span>
            <span class="node-label">{{ data.label }}</span>
          </div>
        </template>

        <template #node-end="{ data }">
          <div class="flow-node end-node" :style="{ borderColor: data.color }">
            <span class="node-icon">{{ data.icon }}</span>
            <span class="node-label">{{ data.label }}</span>
          </div>
        </template>
      </VueFlow>
    </div>

    <!-- 属性面板 -->
    <div v-if="selectedNode" class="property-panel">
      <div class="panel-header">
        <span>属性面板</span>
        <button class="close-btn" @click="selectedNode = null">×</button>
      </div>
      <div class="panel-content">
        <div class="prop-item">
          <label>ID:</label>
          <span class="prop-value">{{ selectedNode.id }}</span>
        </div>
        <div class="prop-item">
          <label>类型:</label>
          <span class="prop-value">{{ selectedNode.type }}</span>
        </div>
        <div class="prop-item">
          <label>位置:</label>
          <span class="prop-value">
            X: {{ Math.round(selectedNode.position.x) }},
            Y: {{ Math.round(selectedNode.position.y) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fff;
  border: 2px solid;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #f5f5f5;
}

.action-btn {
  padding: 8px 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #2563eb;
}

.action-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.import-btn {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.canvas-wrapper {
  flex: 1;
  min-height: 0;
}

.flow-node {
  padding: 12px 20px;
  background: #fff;
  border: 2px solid;
  border-radius: 12px;
  min-width: 80px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: grab;
}

.flow-node:active {
  cursor: grabbing;
}

.start-node { border-color: #22c55e; }
.task-node { border-color: #3b82f6; }
.condition-node { border-color: #f59e0b; }
.end-node { border-color: #ef4444; }

.node-icon {
  display: block;
  font-size: 20px;
  margin-bottom: 4px;
}

.node-label {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.property-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 240px;
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

.prop-item {
  margin-bottom: 12px;
}

.prop-item:last-child {
  margin-bottom: 0;
}

.prop-item label {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}

.prop-value {
  font-size: 13px;
  color: #1a1a1f;
  word-break: break-all;
}

/* Vue Flow 样式覆盖 */
:deep(.vue-flow) {
  background: #f5f5f5;
}

:deep(.vue-flow__edge-path) {
  stroke: #666;
  stroke-width: 2;
}

:deep(.vue-flow__edge.animated .vue-flow__edge-path) {
  stroke: #3b82f6;
  stroke-dasharray: 5;
  animation: dash 0.5s linear infinite;
}

@keyframes dash {
  to { stroke-dashoffset: -10; }
}

:deep(.vue-flow__minimap) {
  background: #fff;
  border-radius: 8px;
}
</style>
