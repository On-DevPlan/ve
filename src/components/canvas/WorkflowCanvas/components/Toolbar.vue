<script setup>
const props = defineProps({
  selectedNode: { type: Object, default: null },
  toolbarButtons: { type: Array, required: true }
})

const emit = defineEmits(['add-node', 'delete-node', 'clear-all', 'export-json', 'import-json', 'open-api-config'])

function handleImport(event) {
  const file = event.target.files?.[0]
  if (file) {
    emit('import-json', file)
    event.target.value = ''
  }
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-section">
      <span class="toolbar-label">Add Node:</span>
      <button
        v-for="btn in toolbarButtons"
        :key="btn.type"
        class="toolbar-btn"
        @click="emit('add-node', btn.type)"
      >
        <span>{{ btn.icon }}</span>
        <span>{{ btn.label }}</span>
      </button>
    </div>
    <div class="toolbar-section">
      <button
        class="action-btn"
        :disabled="!selectedNode"
        @click="selectedNode && emit('delete-node', selectedNode.id)"
      >
        🗑️ Delete
      </button>
      <button class="action-btn" @click="emit('clear-all')">
        🧹 Clear
      </button>
      <button class="action-btn" @click="emit('export-json')">
        💾 Export
      </button>
      <label class="action-btn import-btn">
        📂 Import
        <input type="file" accept=".json" @change="handleImport" hidden />
      </label>
      <button class="action-btn api-btn" @click="emit('open-api-config')">
        🔐 API
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
