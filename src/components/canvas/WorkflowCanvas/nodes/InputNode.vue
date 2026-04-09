<script setup>
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    default: () => ({
      label: 'Input',
      inputText: '',
      placeholder: 'Enter content...'
    })
  }
})
</script>

<template>
  <div class="input-node">
    <Handle type="target" :position="Position.Left" />
    <div class="node-body">
      <div class="node-header">{{ data?.label }}</div>
      <textarea
        v-model="data.inputText"
        :placeholder="data?.placeholder"
        rows="3"
      ></textarea>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.input-node {
  background: #fff;
  border: 2px solid #10b981;
  border-radius: 12px;
  min-width: 180px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.node-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  max-height: 120px;
  overflow-y: auto;
}

textarea:focus {
  outline: none;
  border-color: #10b981;
}
</style>
