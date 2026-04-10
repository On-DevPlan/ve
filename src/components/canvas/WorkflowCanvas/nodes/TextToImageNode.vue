<script setup>
import { ref, reactive, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useImageGen } from '../composables/useImageGen'
import { useClipboard } from '../composables/useClipboard'

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    default: () => ({
      label: 'Text→Image',
      prompt: '',
      model: 'image-01',
      aspectRatio: '1:1',
      styleType: '',
      styleWeight: 0.8,
      n: 1,
      promptOptimizer: false,
      aigcWatermark: false,
      imageUrls: [],
      loading: false,
      error: null
    })
  }
})

// Share addNode via useClipboard's internal addNode
const { addNode: spawnImageNode } = useClipboard(null, () => {})

const MODEL_OPTIONS = [
  { value: 'image-01', label: 'image-01' },
  { value: 'image-01-live', label: 'image-01-live' }
]

const ASPECT_OPTIONS = [
  { value: '1:1', label: '1:1 (1024×1024)' },
  { value: '16:9', label: '16:9 (1280×720)' },
  { value: '4:3', label: '4:3 (1152×864)' },
  { value: '3:2', label: '3:2 (1248×832)' },
  { value: '2:3', label: '2:3 (832×1248)' },
  { value: '3:4', label: '3:4 (864×1152)' },
  { value: '9:16', label: '9:16 (720×1280)' },
  { value: '21:9', label: '21:9 (1344×576)' }
]

const STYLE_OPTIONS = [
  { value: '', label: '—' },
  { value: '漫画', label: '漫画' },
  { value: '元气', label: '元气' },
  { value: '中世纪', label: '中世纪' },
  { value: '水彩', label: '水彩' }
]

const form = reactive({
  prompt: props.data.prompt || '',
  model: props.data.model || 'image-01',
  aspectRatio: props.data.aspectRatio || '1:1',
  styleType: props.data.styleType || '',
  styleWeight: props.data.styleWeight ?? 0.8,
  n: props.data.n ?? 1,
  promptOptimizer: props.data.promptOptimizer ?? false,
  aigcWatermark: props.data.aigcWatermark ?? false
})

// Sync form → data on change
function syncData() {
  Object.assign(props.data, {
    prompt: form.prompt,
    model: form.model,
    aspectRatio: form.aspectRatio,
    styleType: form.styleType,
    styleWeight: form.styleWeight,
    n: form.n,
    promptOptimizer: form.promptOptimizer,
    aigcWatermark: form.aigcWatermark
  })
}

const { textToImage } = useImageGen(props.data)

const isLoading = computed(() => props.data.loading)
const hasError = computed(() => !!props.data.error)
const results = computed(() => props.data.imageUrls || [])

async function handleGenerate() {
  if (!form.prompt.trim()) {
    props.data.error = 'Please enter a prompt'
    return
  }
  syncData()
  try {
    await textToImage({
      prompt: form.prompt,
      model: form.model,
      styleType: form.styleType || undefined,
      styleWeight: form.styleWeight,
      aspectRatio: form.aspectRatio,
      n: form.n,
      promptOptimizer: form.promptOptimizer,
      aigcWatermark: form.aigcWatermark
    })
  } catch (e) {
    // error already set in data
  }
}

function createImageNode(imageUrl) {
  // Create an ImageNode at a position offset from this node
  const offset = Math.random() * 100
  const newNode = {
    id: `image-${Date.now()}`,
    type: 'image',
    position: { x: 500 + offset, y: 200 + offset },
    data: { label: 'Image', imageUrl, imageWidth: 200, imageHeight: 150 }
  }
  // We need to push to the global nodes array - use a custom event
  window.dispatchEvent(new CustomEvent('wf:add-image-node', { detail: newNode }))
}
</script>

<template>
  <div class="t2i-node">
    <Handle type="target" :position="Position.Left" />

    <div class="node-header">
      <span class="node-icon">🎨</span>
      <span class="node-title">Text→Image</span>
    </div>

    <div class="node-body">
      <textarea
        v-model="form.prompt"
        class="prompt-input"
        placeholder="Describe the image you want to generate..."
        rows="3"
        @blur="syncData"
      />

      <div class="row">
        <select v-model="form.model" class="sel" @change="syncData">
          <option v-for="m in MODEL_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <select v-model="form.aspectRatio" class="sel" @change="syncData">
          <option v-for="a in ASPECT_OPTIONS" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </div>

      <select v-if="form.model === 'image-01-live'" v-model="form.styleType" class="sel full" @change="syncData">
        <option v-for="s in STYLE_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>

      <div class="row">
        <label class="chk-label">
          <input type="checkbox" v-model="form.promptOptimizer" @change="syncData" />
          Prompt Opt
        </label>
        <label class="chk-label">
          <input type="checkbox" v-model="form.aigcWatermark" @change="syncData" />
          Watermark
        </label>
        <label class="chk-label">
          N
          <input type="number" v-model.number="form.n" min="1" max="9" class="n-input" @blur="syncData" />
        </label>
      </div>

      <button class="gen-btn" :disabled="isLoading || !form.prompt.trim()" @click="handleGenerate">
        {{ isLoading ? '⏳ Generating…' : '✨ Generate' }}
      </button>

      <div v-if="hasError" class="error-msg">{{ props.data.error }}</div>

      <div v-if="results.length" class="results">
        <div v-for="(url, i) in results" :key="i" class="result-thumb" @click="createImageNode(url)" :title="'Click to add to canvas'">
          <img :src="url" alt="Generated" />
        </div>
      </div>
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.t2i-node {
  position: relative;
  background: #fff;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  width: 260px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
  border-bottom: 1px solid #f0f0f0;
}

.node-icon { font-size: 16px; }
.node-title { font-size: 13px; font-weight: 600; color: #333; }

.node-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompt-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.prompt-input:focus { border-color: #3b82f6; }

.row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.sel {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 11px;
  background: #fafafa;
  outline: none;
  cursor: pointer;
}

.sel.full { width: 100%; }

.chk-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
}

.n-input {
  width: 32px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
  text-align: center;
}

.gen-btn {
  width: 100%;
  padding: 8px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.gen-btn:hover:not(:disabled) { background: #2563eb; }
.gen-btn:disabled { background: #ccc; cursor: not-allowed; }

.error-msg {
  font-size: 11px;
  color: #ef4444;
  padding: 4px 0;
  word-break: break-all;
}

.results {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.result-thumb {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}

.result-thumb:hover {
  border-color: #3b82f6;
  transform: scale(1.05);
}

.result-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
