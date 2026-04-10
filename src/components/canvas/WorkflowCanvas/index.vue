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
import { saveApiConfig, apiConfig } from './composables/useImageGen'

import Toolbar from './components/Toolbar.vue'
import ApiConfigModal from './components/ApiConfigModal.vue'
import ContextMenu from './components/ContextMenu.vue'
import PropertyPanel from './components/PropertyPanel.vue'

// --- State ---
const nodes = ref([])
const edges = ref([])

// API Config
const showApiConfig = ref(false)
const apiEndpoint = ref(apiConfig.value.endpoint)
const apiKey = ref(apiConfig.value.apiKey)
const apiModel = ref(apiConfig.value.model || 'image-01')

// --- Composables ---
const {
  selectedNode, focusedNodeId, addNode, removeNode,
  clearAll, exportJSON, importJSON,
  onNodeClick, onNodeFocus, onNodeBlur
} = useNodeActions(nodes, edges)

const {
  isDragging, handleDrop, handleDragover,
  handleDragleave, enablePaste, disablePaste
} = useClipboard(nodes, addNode, showApiConfig)

useKeyboard(focusedNodeId, showApiConfig)

// --- VueFlow ---
const { onConnect, addEdges, fitView } = useVueFlow()
onConnect((params) => addEdges([params]))

// --- Node registry ---
const nodeTypes = {
  image: markRaw(ImageNode),
  textInput: markRaw(InputNode),
  text: markRaw(TextNode),
  textToImage: markRaw(TextToImageNode),
  imageToImage: markRaw(ImageToImageNode)
}

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
    <!-- Sub-components -->
    <Toolbar
      :selected-node="selectedNode"
      :toolbar-buttons="toolbarButtons"
      @add-node="addNode"
      @delete-node="removeNode"
      @clear-all="clearAll"
      @export-json="exportJSON"
      @import-json="importJSON"
      @open-api-config="showApiConfig = true"
    />

    <ApiConfigModal
      v-if="showApiConfig"
      :endpoint="apiEndpoint"
      :api-key="apiKey"
      :model="apiModel"
      @save="handleSaveApiConfig"
      @cancel="showApiConfig = false"
    />

    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @delete="handleContextDelete"
      @close="closeContextMenu"
    />

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
        @node-context-menu="onNodeContextMenu"
      >
        <Background pattern-color="#aaa" :gap="16" />
        <Controls />
        <MiniMap />
      </VueFlow>
    </div>

    <PropertyPanel
      v-if="selectedNode"
      :node="selectedNode"
      @close="selectedNode = null"
      @update="() => {}"
    />
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

/* Vue Flow overrides */
:deep(.vue-flow) {
  background: #f5f5f5;
}

:deep(.vue-flow__minimap) {
  background: #fff;
  border-radius: 8px;
}
</style>
