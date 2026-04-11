<script setup>
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow, SelectionMode } from '@vue-flow/core'
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
import GroupNode from './nodes/GroupNode.vue'
import TextToImageNode from './nodes/TextToImageNode.vue'
import ImageToImageNode from './nodes/ImageToImageNode.vue'
import { useNodeActions } from './composables/useNodeActions'
import { useClipboard } from './composables/useClipboard'
import { useKeyboard } from './composables/useKeyboard'
import { saveApiConfig, apiConfig } from './composables/useImageGen'

import Toolbar from './components/Toolbar.vue'
import ApiConfigModal from './components/ApiConfigModal.vue'
import ContextMenu from './components/ContextMenu.vue'
import PropertyPanel from './components/PropertyPanel.vue'

// --- State ---
const nodes = ref([])
const edges = ref([])

// Composables
const { selectedNode, addNode, removeNode, clearAll, exportJSON, importJSON, onNodeClick, onNodeFocus, onNodeBlur, groupSelected, ungroupSelected } = useNodeActions(nodes, edges)
const { isDragging, handleDrop, handleDragover, handleDragleave, enablePaste, disablePaste } = useClipboard(nodes, addNode)

// --- VueFlow ---
const { onConnect, addEdges, fitView } = useVueFlow()
onConnect((params) => addEdges([params]))

// --- Node registry ---
const nodeTypes = {
  image: markRaw(ImageNode),
  textInput: markRaw(InputNode),
  text: markRaw(TextNode),
  group: markRaw(GroupNode),
  textToImage: markRaw(TextToImageNode),
  imageToImage: markRaw(ImageToImageNode)
}

// Toolbar buttons
const toolbarButtons = [
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'textInput', label: 'Input', icon: '📝' },
  { type: 'text', label: 'Text', icon: '📄' },
  { type: 'textToImage', label: 'T→Image', icon: '🎨' },
  { type: 'imageToImage', label: 'I→Image', icon: '🖼️' }
]

// --- Context menu ---
const contextMenu = ref({ visible: false, x: 0, y: 0, nodeId: null })

function onNodeContextMenu({ event, node }) {
  event.preventDefault()
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, nodeId: node.id }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleContextDelete() {
  if (contextMenu.value.nodeId) removeNode(contextMenu.value.nodeId)
  closeContextMenu()
}

// --- Image node spawn from generation results ---
function onAddImageNode(event) {
  nodes.value.push(event.detail)
}

// --- API Config handlers ---
function handleSaveApiConfig({ endpoint, apiKey: key, model }) {
  saveApiConfig(endpoint, key, model)
  showApiConfig.value = false
}

// Grouping handlers
function handleGroup() {
  groupSelected()
}

function handleUngroup() {
  ungroupSelected()
}

// --- Import handler ---
function handleImport(event) {
  const file = event.target.files?.[0]
  if (file) {
    importJSON(file)
    event.target.value = ''
  }
}

// --- Lifecycle ---
onMounted(() => {
  enablePaste()
  setTimeout(() => fitView(), 100)
  window.addEventListener('wf:add-image-node', onAddImageNode)
  document.addEventListener('click', closeContextMenu)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu() })
})

onUnmounted(() => {
  disablePaste()
  window.removeEventListener('wf:add-image-node', onAddImageNode)
  document.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <div
    class="workflow-canvas"
    :class="{ 'drag-over': isDragging }"
    @drop="handleDrop"
    @dragover="handleDragover"
    @dragleave="handleDragleave"
  >
    <!-- Toolbar -->
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
        <button
          class="action-btn"
          :disabled="!selectedNode"
          @click="selectedNode && removeNode(selectedNode.id)"
        >
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
        <button class="action-btn" @click="handleGroup">
          📦 Group
        </button>
        <button class="action-btn" @click="handleUngroup">
          📭 Ungroup
        </button>
      </div>
    </div>

    <!-- Canvas -->
    <div class="canvas-wrapper">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :default-viewport="{ x: 0, y: 0, zoom: 0.8 }"
        fit-view-on-init
        :pan-on-drag="false"
        :selection-mode="SelectionMode.Full"
        :selection-key-code="'Shift'"
        :multi-selection-key-code="'Shift'"
        @node-click="onNodeClick"
        @node-focus="onNodeFocus"
        @node-blur="onNodeBlur"
        @node-context-menu="onNodeContextMenu"
      >
        <Background pattern-color="#aaa" :gap="16" />
        <Controls />
        <MiniMap />
      </VueFlow>
    </div>

    <!-- Property Panel -->
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
            X: {{ Math.round(selectedNode.position?.x ?? 0) }},
            Y: {{ Math.round(selectedNode.position?.y ?? 0) }}
          </span>
        </div>
        <div v-if="selectedNode.type === 'image'" class="prop-item">
          <label>Image URL:</label>
          <span class="prop-value">{{ selectedNode.data?.imageUrl || '(empty)' }}</span>
        </div>
        <div v-if="selectedNode.type === 'textInput'" class="prop-item">
          <label>Input Text:</label>
          <textarea
            class="prop-input"
            :value="selectedNode.data?.inputText || ''"
            @input="e => selectedNode.data.inputText = e.target.value"
            placeholder="Enter text..."
          />
        </div>
        <div v-if="selectedNode.type === 'text'" class="prop-item">
          <label>Content:</label>
          <textarea
            class="prop-input"
            :value="selectedNode.data?.content || ''"
            @input="e => selectedNode.data.content = e.target.value"
            placeholder="Enter text..."
          />
        </div>
        <div v-if="selectedNode.type === 'text'" class="prop-item">
          <label>Font Size:</label>
          <input
            type="number"
            class="prop-input"
            :value="selectedNode.data?.fontSize || 14"
            @input="e => selectedNode.data.fontSize = Number(e.target.value)"
            min="8"
            max="72"
          />
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
  position: relative;
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
  margin-right: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.action-btn {
  display: inline-flex;
  align-items: center;
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
  cursor: pointer;
}

.canvas-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.canvas-wrapper.drag-over::after {
  content: 'Drop image here';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  border: 2px dashed #3b82f6;
  z-index: 10;
  font-size: 18px;
  color: #3b82f6;
  pointer-events: none;
}

.property-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 260px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
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
  color: #1a1a1a;
  word-break: break-all;
}

.prop-input {
  width: 100%;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}

.prop-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Vue Flow overrides */
:deep(.vue-flow) {
  background: #f5f5f5;
}

:deep(.vue-flow__minimap) {
  background: #fff;
  border-radius: 8px;
}
</style>
