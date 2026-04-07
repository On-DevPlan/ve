<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  initialSpeed: { type: Number, default: 40 }
})

// 配置 marked 选项
marked.setOptions({
  gfm: true,
  breaks: true
})

const content = ref('')
const rawContent = ref('')
const isStreaming = ref(false)
const currentSpeed = ref(props.initialSpeed)
const cursorVisible = ref(true)
let cursorInterval = null
let streamTimeout = null

const speedOptions = [
  { label: '极速', value: 8 },
  { label: '快速', value: 25 },
  { label: '正常', value: 50 },
  { label: '慢速', value: 100 },
  { label: '龟速', value: 200 }
]

const sampleTexts = [
  {
    title: '代码示例',
    content: `## 快速排序算法

\`\`\`javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);

  return [...quickSort(left), ...middle, ...quickSort(right)];
}

// 使用示例
const sorted = quickSort([64, 34, 25, 12, 22, 11, 90]);
console.log(sorted);
\`\`\`

> **时间复杂度**: O(n log n) 平均情况
> **空间复杂度**: O(log n)`
  },
  {
    title: '技术文档',
    content: `# Vue 3 Composition API

## 响应式系统

Vue 3 引入了全新的响应式系统，基于 \`Proxy\` 实现。

### ref vs reactive

| 函数 | 适用场景 | 特点 |
|------|---------|------|
| \`ref\` | 基本类型 | 需要 \`.value\` 访问 |
| \`reactive\` | 对象类型 | 直接访问，深响应 |

### 生命周期

\`\`\`typescript
import { onMounted, onUpdated, onUnmounted } from 'vue'

onMounted(() => {
  console.log('组件挂载')
})
\`\`\`

> 组合式 API 让我们能更好地组织逻辑`
  },
  {
    title: '诗歌鉴赏',
    content: `# 静夜思

> **床前明月光，疑是地上霜。**
> **举头望明月，低头思故乡。**

---

*此诗语言清新朴素、构思细致，意境深远。*
*诗人通过月光这一意象，表达了深深的思乡之情。*

---

### 词语注释

- **明月光**：明亮的月光
- **疑**：好像
- **思故乡**：想念家乡`
  }
]

// 使用 marked 解析 Markdown
const renderedContent = computed(() => {
  if (!content.value) return ''
  return marked.parse(content.value)
})

function startCursor() {
  cursorInterval = setInterval(() => {
    cursorVisible.value = !cursorVisible.value
  }, 530)
}

function stopCursor() {
  if (cursorInterval) {
    clearInterval(cursorInterval)
    cursorInterval = null
  }
}

function clearContent() {
  stopStream()
  content.value = ''
  rawContent.value = ''
  stopCursor()
}

function stopStream() {
  isStreaming.value = false
  if (streamTimeout) {
    clearTimeout(streamTimeout)
    streamTimeout = null
  }
}

function startStream(text) {
  clearContent()
  rawContent.value = text
  isStreaming.value = true
  startCursor()

  let index = 0
  const chars = text.split('')
  const len = chars.length

  // 根据速度调整每次输出的字符数
  function getChunkSize() {
    if (currentSpeed.value <= 15) return 4
    if (currentSpeed.value <= 35) return 2
    return 1
  }

  function streamNext() {
    if (!isStreaming.value || index >= len) {
      isStreaming.value = false
      stopCursor()
      return
    }

    const chunkSize = getChunkSize()
    const end = Math.min(index + chunkSize, len)
    content.value = text.substring(0, end)
    index = end

    // 动态延迟，速度越快延迟越短
    const baseDelay = currentSpeed.value
    const delay = currentSpeed.value < 30 ? baseDelay * 0.6 : baseDelay

    streamTimeout = setTimeout(streamNext, delay)
  }

  streamTimeout = setTimeout(streamNext, currentSpeed.value)
}

function setSpeed(speed) {
  currentSpeed.value = speed
}

// 监听速度变化，如果正在播放则重启流
watch(currentSpeed, (newSpeed) => {
  if (isStreaming.value && rawContent.value) {
    const remaining = rawContent.value.substring(
      rawContent.value.indexOf(content.value) + content.value.length
    )
    if (remaining.length > 0) {
      stopStream()
      isStreaming.value = true
      startCursor()
      let index = content.value.length
      const chars = rawContent.value.split('')
      const len = chars.length

      function streamNext() {
        if (!isStreaming.value || index >= len) {
          isStreaming.value = false
          stopCursor()
          return
        }
        const chunkSize = newSpeed <= 15 ? 4 : newSpeed <= 35 ? 2 : 1
        const end = Math.min(index + chunkSize, len)
        content.value = rawContent.value.substring(0, end)
        index = end
        const delay = newSpeed < 30 ? newSpeed * 0.6 : newSpeed
        streamTimeout = setTimeout(streamNext, delay)
      }
      streamTimeout = setTimeout(streamNext, newSpeed)
    }
  }
})

onUnmounted(() => {
  stopStream()
  stopCursor()
})
</script>

<template>
  <div class="md-stream-marked">
    <div class="bg-gradient"></div>
    <div class="bg-grid"></div>

    <!-- 顶部控制栏 -->
    <header class="header">
      <div class="header-left">
        <span class="badge">marked.js</span>
        <span class="title">Markdown 流式输出</span>
      </div>
      <div class="header-right">
        <span v-if="isStreaming" class="status-dot"></span>
        <span class="status-text">{{ isStreaming ? '播放中' : '就绪' }}</span>
      </div>
    </header>

    <!-- 控制面板 -->
    <div class="controls">
      <div class="control-section">
        <span class="section-label">速度</span>
        <div class="speed-track">
          <button
            v-for="opt in speedOptions"
            :key="opt.value"
            :class="['speed-btn', { active: currentSpeed === opt.value }]"
            @click="setSpeed(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="control-section">
        <span class="section-label">示例</span>
        <div class="sample-track">
          <button
            v-for="sample in sampleTexts"
            :key="sample.title"
            class="sample-btn"
            @click="startStream(sample.content)"
            :disabled="isStreaming"
          >
            {{ sample.title }}
          </button>
        </div>
      </div>

      <div class="control-section actions">
        <button
          class="action-btn pause"
          @click="stopStream"
          :disabled="!isStreaming"
        >
          {{ isStreaming ? '⏸ 暂停' : '▶ 继续' }}
        </button>
        <button class="action-btn reset" @click="clearContent">
          🗑 清空
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <main class="content-area">
      <div class="paper">
        <article class="markdown-body" v-html="renderedContent"></article>
        <span v-if="isStreaming || content.length > 0" class="cursor" :class="{ visible: cursorVisible }">▋</span>
      </div>
    </main>

    <!-- 底部信息 -->
    <footer class="footer">
      <span>基于 <strong>marked.js</strong> 解析 · 支持 GFM 语法</span>
    </footer>
  </div>
</template>

<style scoped>
.md-stream-marked {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  overflow: hidden;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(88, 166, 255, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

/* 顶部栏 */
.header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(13, 17, 23, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge {
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 控制面板 */
.controls {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: rgba(22, 27, 34, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-wrap: wrap;
}

.control-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.speed-track, .sample-track {
  display: flex;
  gap: 4px;
}

.speed-btn, .sample-btn, .action-btn {
  padding: 5px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.speed-btn:hover, .sample-btn:hover, .action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.speed-btn.active {
  background: rgba(88, 166, 255, 0.15);
  border-color: rgba(88, 166, 255, 0.5);
  color: #58a6ff;
}

.sample-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.actions {
  margin-left: auto;
}

.action-btn.pause {
  border-color: rgba(251, 146, 60, 0.4);
  color: #fb923c;
}

.action-btn.pause:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn.reset {
  border-color: rgba(248, 113, 113, 0.4);
  color: #f87171;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  display: flex;
  justify-content: center;
}

.paper {
  width: 100%;
  max-width: 800px;
  min-height: 400px;
  position: relative;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 20px 50px rgba(0, 0, 0, 0.4);
}

.markdown-body {
  padding: 32px 36px;
  line-height: 1.85;
  color: #e6edf3;
}

.cursor {
  display: inline-block;
  color: #58a6ff;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.08s;
}

.cursor.visible {
  opacity: 1;
}

/* Markdown 样式 - GitHub Dark 风格 */
.markdown-body :deep(h1) {
  font-size: 1.75em;
  font-weight: 600;
  margin: 0 0 28px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: #f0f6fc;
}

.markdown-body :deep(h2) {
  font-size: 1.4em;
  font-weight: 600;
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #f0f6fc;
}

.markdown-body :deep(h3) {
  font-size: 1.15em;
  font-weight: 600;
  margin: 24px 0 12px;
  color: #c9d1d9;
}

.markdown-body :deep(h4), .markdown-body :deep(h5), .markdown-body :deep(h6) {
  font-size: 1em;
  font-weight: 600;
  margin: 16px 0 8px;
  color: #8b949e;
}

.markdown-body :deep(p) {
  margin: 14px 0;
}

.markdown-body :deep(strong) {
  color: #f0f6fc;
  font-weight: 600;
}

.markdown-body :deep(em) {
  color: #c9d1d9;
  font-style: italic;
}

.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 20px;
  background: rgba(56, 139, 253, 0.1);
  border-left: 3px solid #388bfd;
  border-radius: 0 6px 6px 0;
  color: #8b949e;
}

.markdown-body :deep(blockquote strong) {
  color: #58a6ff;
}

.markdown-body :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  margin: 28px 0;
}

.markdown-body :deep(ul), .markdown-body :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin: 6px 0;
}

.markdown-body :deep(ul > li) {
  list-style-type: disc;
}

.markdown-body :deep(ul ul > li) {
  list-style-type: circle;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.markdown-body :deep(thead) {
  background: rgba(255, 255, 255, 0.05);
}

.markdown-body :deep(tr) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.markdown-body :deep(tr:last-child) {
  border-bottom: none;
}

.markdown-body :deep(th), .markdown-body :deep(td) {
  padding: 10px 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  font-weight: 600;
  color: #f0f6fc;
  font-size: 13px;
}

.markdown-body :deep(td) {
  color: #c9d1d9;
  font-size: 13px;
}

/* 代码块 - GitHub Dark 风格 */
.markdown-body :deep(pre) {
  margin: 16px 0;
  padding: 16px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #c9d1d9;
  background: none;
  padding: 0;
  border: none;
  border-radius: 0;
}

.markdown-body :deep(code) {
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: rgba(110, 118, 129, 0.2);
  border: 1px solid rgba(110, 118, 129, 0.3);
  border-radius: 4px;
  color: #f0883e;
}

/* 页脚 */
.footer {
  position: relative;
  z-index: 10;
  padding: 10px 24px;
  background: rgba(13, 17, 23, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  text-align: center;
}

.footer span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.footer strong {
  color: rgba(255, 255, 255, 0.5);
}
</style>
