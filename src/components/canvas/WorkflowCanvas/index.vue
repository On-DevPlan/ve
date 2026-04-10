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
import TextToImageNode from './nodes/TextToImageNode.vue'
import ImageToImageNode from './nodes/ImageToImageNode.vue'
import { useNodeActions } from './composables/useNodeActions'
import { useClipboard } from './composables/useClipboard'
import { useKeyboard } from './composables/useKeyboard'
import { saveApiConfig, hasApiKey, apiConfig } from './composables/useImageGen'

// State
const nodes = ref([])
const edges = ref([])

// API Config (declared first so composables can reference it)
const showApiConfig = ref(false)
const apiEndpoint = ref(apiConfig.value.endpoint)
const apiKey = ref(apiConfig.value.apiKey)
const apiModel = ref(apiConfig.value.model || 'image-01')

// Composables
const { selectedNode, focusedNodeId, addNode, removeNode, clearAll, exportJSON, importJSON, onNodeClick, onNodeFocus, onNodeBlur } = useNodeActions(nodes, edges)
const { isDragging, handleDrop, handleDragover, handleDragleave, enablePaste, disablePaste } = useClipboard(nodes, addNode, showApiConfig)
useKeyboard(focusedNodeId, showApiConfig)

// Node types - MUST use markRaw
const nodeTypes = {
  image: markRaw(ImageNode),
  textInput: markRaw(InputNode),
  text: markRaw(TextNode),
  textToImage: markRaw(TextToImageNode),
  imageToImage: markRaw(ImageToImageNode)
}

// VueFlow connection handler
const { onConnect, addEdges, fitView } = useVueFlow()
onConnect((params) => addEdges([params]))

// Toolbar buttons
const toolbarButtons = [
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'textInput', label: 'Input', icon: '📝' },
  { type: 'text', label: 'Text', icon: '📄' },
  { type: 'textToImage', label: 'T→Image', icon: '🎨' },
  { type: 'imageToImage', label: 'I→Image', icon: '🖼️' }
]

function handleSaveApiConfig() {
  saveApiConfig(apiEndpoint.value, apiKey.value, apiModel.value)
  showApiConfig.value = false
}

// Handle image nodes spawned from generation results
function onAddImageNode(event) {
  nodes.value.push(event.detail)
}

// Import handler
function handleImport(event) {
  const file = event.target.files?.[0]
  if (file) {
    importJSON(file).catch(err => console.error('Import failed:', err))
    event.target.value = ''
  }
}

// Lifecycle
onMounted(() => {
  enablePaste()
  setTimeout(() => fitView(), 100)
  window.addEventListener('wf:add-image-node', onAddImageNode)
})

onUnmounted(() => {
  disablePaste()
  window.removeEventListener('wf:add-image-node', onAddImageNode)
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
        <button class="action-btn api-btn" @click="showApiConfig = true">
          🔐 API
        </button>
      </div>
    </div>

    <!-- API Config Modal -->
    <div v-if="showApiConfig" class="modal-overlay" @click.self="showApiConfig = false">
      <div class="modal">
        <div class="modal-header">
          <span>🔐 API Configuration</span>
          <button class="close-btn" @click="showApiConfig = false">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Endpoint</label>
            <input v-model="apiEndpoint" type="text" placeholder="https://api.minimaxi.com" class="modal-input" />
          </div>
          <div class="field">
            <label>API Key</label>
            <input v-model="apiKey" type="password" placeholder="Enter your API key" class="modal-input" />
          </div>
          <div class="field">
            <label>Default Model</label>
            <select v-model="apiModel" class="modal-input">
              <option value="image-01">image-01</option>
              <option value="image-01-live">image-01-live</option>
            </select>
          </div>
          <p class="hint">API key is stored in localStorage and never sent anywhere except the specified endpoint.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showApiConfig = false">Cancel</button>
            <button class="modal-save" @click="handleSaveApiConfig">Save</button>
          </div>
        </div>
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
        @node-click="onNodeClick"
        @node-focus="onNodeFocus"
        @node-blur="onNodeBlur"
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

/* API Config Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
  font-weight: 600;
  font-size: 15px;
}

.modal-header .close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.modal-header .close-btn:hover {
  background: #e8e8e8;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.modal-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.modal-input:focus { border-color: #3b82f6; }

.hint {
  font-size: 11px;
  color: #999;
  margin: 0 0 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-cancel {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}

.modal-save {
  padding: 8px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #fff;
}

.modal-save:hover { background: #2563eb; }

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
