<script setup>
import { Excalidraw } from 'vue-excalidraw'
import { ref } from 'vue'

const excalidrawRef = ref(null)

// 导出为图片
async function exportImage() {
  if (excalidrawRef.value) {
    const api = excalidrawRef.value.ready()
    if (api) {
      const img = await api.createImage()
      img.download()
    }
  }
}
</script>

<template>
  <div class="whiteboard-container">
    <div class="toolbar">
      <span class="toolbar-title">白板画布 - Excalidraw</span>
    </div>
    <div class="canvas-wrapper">
      <Excalidraw ref="excalidrawRef" />
    </div>
  </div>
</template>

<style scoped>
.whiteboard-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.toolbar {
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.canvas-wrapper {
  flex: 1;
  min-height: 0;
}

.canvas-wrapper :deep(.excalidraw) {
  width: 100%;
  height: 100%;
}
</style>
