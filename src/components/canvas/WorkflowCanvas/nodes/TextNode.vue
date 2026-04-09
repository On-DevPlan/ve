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
      label: 'Text',
      content: 'Display content',
      fontSize: 14
    })
  }
})
</script>

<template>
  <div class="text-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-content">
      <div class="node-header">{{ data?.label }}</div>
      <div
        class="node-text"
        :style="{ fontSize: `${data?.fontSize || 14}px` }"
      >{{ data?.content }}</div>
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.text-node {
  position: relative;
  background: #fff;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  min-width: 120px;
  max-width: 300px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-content {
  padding: 12px;
}

.node-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

.node-text {
  color: #666;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
