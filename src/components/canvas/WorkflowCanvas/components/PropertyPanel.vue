<script setup>
defineProps({
  node: { type: Object, required: true }
})

const emit = defineEmits(['close', 'update'])
</script>

<template>
  <div class="property-panel">
    <div class="panel-header">
      <span>Properties</span>
      <button class="close-btn" @click="emit('close')">×</button>
    </div>
    <div class="panel-content">
      <div class="prop-item">
        <label>ID:</label>
        <span class="prop-value">{{ node.id }}</span>
      </div>
      <div class="prop-item">
        <label>Type:</label>
        <span class="prop-value">{{ node.type }}</span>
      </div>
      <div class="prop-item">
        <label>Position:</label>
        <span class="prop-value">
          X: {{ Math.round(node.position?.x ?? 0) }},
          Y: {{ Math.round(node.position?.y ?? 0) }}
        </span>
      </div>

      <!-- image node -->
      <template v-if="node.type === 'image'">
        <div class="prop-item">
          <label>Image URL:</label>
          <span class="prop-value">{{ node.data?.imageUrl || '(empty)' }}</span>
        </div>
      </template>

      <!-- textInput node -->
      <template v-if="node.type === 'textInput'">
        <div class="prop-item">
          <label>Input Text:</label>
          <textarea
            class="prop-input"
            :value="node.data?.inputText || ''"
            @input="e => { node.data.inputText = e.target.value; emit('update') }"
            placeholder="Enter text..."
          />
        </div>
      </template>

      <!-- text node -->
      <template v-if="node.type === 'text'">
        <div class="prop-item">
          <label>Content:</label>
          <textarea
            class="prop-input"
            :value="node.data?.content || ''"
            @input="e => { node.data.content = e.target.value; emit('update') }"
            placeholder="Enter text..."
          />
        </div>
        <div class="prop-item">
          <label>Font Size:</label>
          <input
            type="number"
            class="prop-input"
            :value="node.data?.fontSize || 14"
            @input="e => { node.data.fontSize = Number(e.target.value); emit('update') }"
            min="8"
            max="72"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
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
</style>
