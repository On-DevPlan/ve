<script setup>
import { ref, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    default: () => ({
      label: 'Image',
      imageUrl: '',
      imageWidth: 200,
      imageHeight: 150
    })
  }
})

const fileInput = ref(null)

const hasImage = computed(() => !!props.data.imageUrl)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const arrayBuffer = e.target.result
    const blob = new Blob([arrayBuffer], { type: file.type })
    props.data.imageUrl = URL.createObjectURL(blob)
  }
  reader.readAsArrayBuffer(file)

  // Reset input so same file can be selected again
  event.target.value = ''
}
</script>

<template>
  <div class="image-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-content" @click="openFilePicker">
      <div v-if="!hasImage" class="upload-zone">
        <span class="upload-icon">🖼️</span>
        <span class="upload-text">Click / Paste / Drop</span>
      </div>
      <img
        v-else
        :src="data.imageUrl"
        :style="{
          maxWidth: `${data.imageWidth}px`,
          maxHeight: `${data.imageHeight}px`
        }"
        alt="Node image"
      />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      @change="handleFileSelect"
      hidden
    />

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.image-node {
  background: #fff;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  min-width: 120px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-content {
  padding: 12px;
  cursor: pointer;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background: #fafafa;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone:hover {
  border-color: #3b82f6;
  background: #f0f7ff;
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 12px;
  color: #666;
  text-align: center;
}

img {
  display: block;
  border-radius: 4px;
}
</style>
