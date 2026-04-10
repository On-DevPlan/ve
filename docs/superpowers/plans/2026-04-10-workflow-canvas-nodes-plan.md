# WorkflowCanvas Node Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a layered node infrastructure for WorkflowCanvas with ImageNode, InputNode, and TextNode, plus composables for node actions and clipboard handling.

**Architecture:** VueFlow custom node components registered via `markRaw`, with composables for shared logic. Entry component orchestrates canvas, toolbar, and property panel.

**Tech Stack:** Vue 3 + Vite + @vue-flow/core ^1.48.2

---

## Task 1: useNodeActions Composable

**Files:**
- Create: `src/components/canvas/WorkflowCanvas/composables/useNodeActions.js`

- [ ] **Step 1: Create useNodeActions.js with node CRUD and import/export**

```js
import { ref } from 'vue'

export function useNodeActions(nodes, edges) {
  const selectedNode = ref(null)

  const defaultData = {
    image: { label: 'Image', imageUrl: '', imageWidth: 200, imageHeight: 150 },
    input: { label: 'Input', inputText: '', placeholder: 'Enter content...' },
    text: { label: 'Text', content: 'Display content', fontSize: 14 }
  }

  function addNode(type, position = null) {
    const id = `${type}-${Date.now()}`
    const data = { ...defaultData[type] }
    const pos = position || {
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 150
    }
    nodes.value.push({ id, type, position: pos, data })
    return id
  }

  function removeNode(id) {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (selectedNode.value?.id === id) selectedNode.value = null
  }

  function clearAll() {
    nodes.value = []
    edges.value = []
    selectedNode.value = null
  }

  function exportJSON() {
    const data = { version: '1.0', nodes: nodes.value, edges: edges.value }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (data.nodes && data.edges) {
            nodes.value = data.nodes
            edges.value = data.edges
            resolve()
          } else {
            reject(new Error('Invalid workflow JSON'))
          }
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsText(file)
    })
  }

  function onNodeClick({ node }) {
    selectedNode.value = node
  }

  return {
    selectedNode,
    addNode,
    removeNode,
    clearAll,
    exportJSON,
    importJSON,
    onNodeClick
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/composables/useNodeActions.js
git commit -m "feat(WorkflowCanvas): add useNodeActions composable"
```

---

## Task 2: useClipboard Composable

**Files:**
- Create: `src/components/canvas/WorkflowCanvas/composables/useClipboard.js`

- [ ] **Step 1: Create useClipboard.js with paste and drop handling**

```js
import { ref } from 'vue'

export function useClipboard(nodes, addNodeFn) {
  const isDragging = ref(false)

  function readFileAsBlobURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const blob = new Blob([e.target.result], { type: file.type })
        resolve(URL.createObjectURL(blob))
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  async function handlePaste(event) {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        const blobUrl = await readFileAsBlobURL(file)
        const id = addNodeFn('image', { x: 400, y: 250 })
        const node = nodes.value.find(n => n.id === id)
        if (node) node.data.imageUrl = blobUrl
        return
      }
    }
  }

  async function handleDrop(event) {
    event.preventDefault()
    isDragging.value = false
    const files = event.dataTransfer?.files
    if (!files) return
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const rect = event.currentTarget.getBoundingClientRect()
        const position = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        }
        const blobUrl = await readFileAsBlobURL(file)
        const id = addNodeFn('image', position)
        const node = nodes.value.find(n => n.id === id)
        if (node) node.data.imageUrl = blobUrl
        return
      }
    }
  }

  function handleDragover(event) {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault()
      isDragging.value = true
    }
  }

  function handleDragleave() {
    isDragging.value = false
  }

  function enablePaste() {
    document.addEventListener('paste', handlePaste)
  }

  function disablePaste() {
    document.removeEventListener('paste', handlePaste)
  }

  return {
    isDragging,
    handleDrop,
    handleDragover,
    handleDragleave,
    enablePaste,
    disablePaste
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/composables/useClipboard.js
git commit -m "feat(WorkflowCanvas): add useClipboard composable"
```

---

## Task 3: ImageNode Component

**Files:**
- Create: `src/components/canvas/WorkflowCanvas/nodes/ImageNode.vue`

- [ ] **Step 1: Create ImageNode.vue**

```vue
<script setup>
import { ref, computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) }
})

const fileInput = ref(null)

const hasImage = computed(() => !!props.data.imageUrl)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const blob = new Blob([e.target.result], { type: file.type })
    const url = URL.createObjectURL(blob)
    props.data.imageUrl = url
  }
  reader.readAsArrayBuffer(file)
}
</script>

<template>
  <div class="image-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-header">
      <span class="node-label">{{ data.label }}</span>
    </div>

    <div class="image-content" @click="triggerUpload">
      <img v-if="hasImage" :src="data.imageUrl" class="image-preview" />
      <div v-else class="upload-zone">
        <span class="upload-icon">🖼️</span>
        <span class="upload-text">Click / Paste / Drop</span>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="handleFileChange"
    />

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.image-node {
  background: #fff;
  border: 2px solid #8b5cf6;
  border-radius: 12px;
  min-width: 160px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.node-header {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
}

.node-label {
  font-size: 12px;
  font-weight: 600;
  color: #8b5cf6;
}

.image-content {
  cursor: pointer;
  padding: 8px;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  color: #888;
}

.upload-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.upload-text {
  font-size: 11px;
}

.image-preview {
  max-width: 200px;
  max-height: 150px;
  border-radius: 6px;
  display: block;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/nodes/ImageNode.vue
git commit -m "feat(WorkflowCanvas): add ImageNode component"
```

---

## Task 4: InputNode Component

**Files:**
- Create: `src/components/canvas/WorkflowCanvas/nodes/InputNode.vue`

- [ ] **Step 1: Create InputNode.vue**

```vue
<script setup>
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) }
})
</script>

<template>
  <div class="input-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-header">
      <span class="node-label">{{ data.label }}</span>
    </div>

    <div class="input-content">
      <textarea
        v-model="data.inputText"
        :placeholder="data.placeholder"
        class="text-input"
        rows="3"
      />
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.input-node {
  background: #fff;
  border: 2px solid #10b981;
  border-radius: 12px;
  min-width: 160px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.node-header {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
}

.node-label {
  font-size: 12px;
  font-weight: 600;
  color: #10b981;
}

.input-content {
  padding: 8px;
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.text-input:focus {
  outline: none;
  border-color: #10b981;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/nodes/InputNode.vue
git commit -m "feat(WorkflowCanvas): add InputNode component"
```

---

## Task 5: TextNode Component

**Files:**
- Create: `src/components/canvas/WorkflowCanvas/nodes/TextNode.vue`

- [ ] **Step 1: Create TextNode.vue**

```vue
<script setup>
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({}) }
})
</script>

<template>
  <div class="text-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-header">
      <span class="node-label">{{ data.label }}</span>
    </div>

    <div class="text-content" :style="{ fontSize: (data.fontSize || 14) + 'px' }">
      {{ data.content }}
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.text-node {
  background: #fff;
  border: 2px solid #f59e0b;
  border-radius: 12px;
  min-width: 120px;
  max-width: 300px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.node-header {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
}

.node-label {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
}

.text-content {
  padding: 12px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 24px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/nodes/TextNode.vue
git commit -m "feat(WorkflowCanvas): add TextNode component"
```

---

## Task 6: Rewrite index.vue (Entry Component)

**Files:**
- Modify: `src/components/canvas/WorkflowCanvas/index.vue`

- [ ] **Step 1: Rewrite index.vue with node types registration and composables**

```vue
<script setup>
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import ImageNode from './nodes/ImageNode.vue'
import InputNode from './nodes/InputNode.vue'
import TextNode from './nodes/TextNode.vue'
import { useNodeActions } from './composables/useNodeActions'
import { useClipboard } from './composables/useClipboard'

const nodes = ref([])
const edges = ref([])

const { selectedNode, addNode, removeNode, clearAll, exportJSON, importJSON, onNodeClick } = useNodeActions(nodes, edges)

const { isDragging, handleDrop, handleDragover, handleDragleave, enablePaste, disablePaste } = useClipboard(nodes, addNode)

const nodeTypes = {
  image: markRaw(ImageNode),
  input: markRaw(InputNode),
  text: markRaw(TextNode)
}

const { onConnect, addEdges, fitView } = useVueFlow()

onConnect((params) => addEdges([params]))

const toolbarButtons = [
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'input', label: 'Input', icon: '📝' },
  { type: 'text', label: 'Text', icon: '📄' }
]

function handleImport(event) {
  const file = event.target.files?.[0]
  if (file) {
    importJSON(file).catch(err => console.error('Import failed:', err))
    event.target.value = ''
  }
}

onMounted(() => {
  enablePaste()
  setTimeout(() => fitView(), 100)
})

onUnmounted(() => {
  disablePaste()
})
</script>

<template>
  <div
    class="workflow-canvas"
    @drop="handleDrop"
    @dragover="handleDragover"
    @dragleave="handleDragleave"
  >
    <div class="toolbar">
      <div class="toolbar-section">
        <span class="toolbar-label">Add Node:</span>
        <button
          v-for="btn in toolbarButtons"
          :key="btn.type"
          class="toolbar-btn"
          @click="addNode(btn.type)"
        >
          <span>{{ btn.icon }}</span>
          <span>{{ btn.label }}</span>
        </button>
      </div>
      <div class="toolbar-section">
        <button class="action-btn" :disabled="!selectedNode" @click="selectedNode && removeNode(selectedNode.id)">
          🗑️ Delete
        </button>
        <button class="action-btn" @click="clearAll">
          🧹 Clear
        </button>
        <button class="action-btn" @click="exportJSON">
          💾 Export
        </button>
        <label class="action-btn import-btn">
          📂 Import
          <input type="file" accept=".json" @change="handleImport" hidden />
        </label>
      </div>
    </div>

    <div class="canvas-wrapper" :class="{ 'drag-over': isDragging }">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :default-viewport="{ x: 0, y: 0, zoom: 0.8 }"
        fit-view-on-init
        @node-click="onNodeClick"
      >
        <Background pattern-color="#aaa" :gap="16" />
        <Controls />
        <MiniMap />
      </VueFlow>
    </div>

    <div v-if="selectedNode" class="property-panel">
      <div class="panel-header">
        <span>Properties</span>
        <button class="close-btn" @click="selectedNode = null">×</button>
      </div>
      <div class="panel-content">
        <div class="prop-item">
          <label>ID:</label>
          <span class="prop-value">{{ selectedNode.id }}</span>
        </div>
        <div class="prop-item">
          <label>Type:</label>
          <span class="prop-value">{{ selectedNode.type }}</span>
        </div>
        <div class="prop-item">
          <label>Position:</label>
          <span class="prop-value">
            X: {{ Math.round(selectedNode.position.x) }},
            Y: {{ Math.round(selectedNode.position.y) }}
          </span>
        </div>
        <template v-if="selectedNode.type === 'image'">
          <div class="prop-item">
            <label>Image URL:</label>
            <span class="prop-value" style="word-break:break-all;font-size:11px">
              {{ selectedNode.data.imageUrl || '(empty)' }}
            </span>
          </div>
        </template>
        <template v-else-if="selectedNode.type === 'input'">
          <div class="prop-item">
            <label>Text:</label>
            <textarea v-model="selectedNode.data.inputText" rows="3" class="prop-input" />
          </div>
        </template>
        <template v-else-if="selectedNode.type === 'text'">
          <div class="prop-item">
            <label>Content:</label>
            <textarea v-model="selectedNode.data.content" rows="3" class="prop-input" />
          </div>
          <div class="prop-item">
            <label>Font Size:</label>
            <input type="number" v-model.number="selectedNode.data.fontSize" min="10" max="48" class="prop-input" />
          </div>
        </template>
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
  position: relative;
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
  border: 1px solid #ddd;
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

.canvas-wrapper.drag-over::after {
  content: 'Drop image here';
  position: absolute;
  inset: 0;
  background: rgba(139, 92, 246, 0.1);
  border: 3px dashed #8b5cf6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #8b5cf6;
  pointer-events: none;
  z-index: 10;
}

:deep(.vue-flow) {
  background: #f5f5f5;
}

:deep(.vue-flow__edge-path) {
  stroke: #666;
  stroke-width: 2;
}

:deep(.vue-flow__minimap) {
  background: #fff;
  border-radius: 8px;
}

.property-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 260px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 100;
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
  margin-bottom: 4px;
}

.prop-value {
  font-size: 13px;
  color: #1a1a1f;
  word-break: break-all;
}

.prop-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.prop-input:focus {
  outline: none;
  border-color: #3b82f6;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/index.vue
git commit -m "feat(WorkflowCanvas): rewrite entry with node types and composables"
```

---

## Task 7: Update component.js

**Files:**
- Modify: `src/components/canvas/WorkflowCanvas/component.js`

- [ ] **Step 1: Update component.js**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/WorkflowCanvas/component.js
git commit -m "feat(WorkflowCanvas): update component.js for new node types"
```

---

## Spec Coverage Check

- [x] ImageNode with paste/drag/upload — Task 3
- [x] InputNode with multi-line text input — Task 4
- [x] TextNode with read-only display — Task 5
- [x] useNodeActions composable (add/remove/clear/export/import) — Task 1
- [x] useClipboard composable (paste/drop handlers) — Task 1 & 2
- [x] Entry index.vue with toolbar, canvas, property panel — Task 6
- [x] Directory structure: nodes/ + composables/ — Tasks 1-5
- [x] markRaw node registration — Task 6
- [x] Drag-drop overlay indicator — Task 6

No TBD/TODO placeholders. All types consistent across tasks.
