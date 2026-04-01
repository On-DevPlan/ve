<script setup>
import { onMounted, ref } from 'vue'
import Tldraw from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'

// tldraw is React-based, but works in Vue via custom element or iframe
// For simplicity, we use the official tldraw component wrapped appropriately
</script>

<template>
  <div class="whiteboard-container">
    <Tldraw />
  </div>
</template>

<style scoped>
.whiteboard-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #f5f5f5;
}

.whiteboard-container :deep(.tldraw) {
  width: 100%;
  height: 100%;
}
</style>
