<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  id: { type: String, required: true },
  data: { type: Object, default: () => ({ label: 'Input', inputText: '', placeholder: 'Enter content...' }) }
})
</script>

<template>
  <div class="input-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-content">
      <div class="node-label">{{ data?.label }}</div>
      <div class="input-wrapper">
        <textarea v-model="data.inputText" :placeholder="data?.placeholder"></textarea>
      </div>
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.input-node {
  position: relative;
  background: #fff;
  border: 2px solid #10b981;
  border-radius: 12px;
  min-width: 120px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-content {
  padding: 12px;
}

.node-label {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

.input-wrapper {
  width: 180px;
}

textarea {
  display: block;
  width: 100%;
  height: 60px;
  padding: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  resize: none;
}

textarea:focus {
  outline: none;
  border-color: #10b981;
}
</style>
