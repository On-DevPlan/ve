<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  throttleDelay: { type: Number, default: 30 }
})

const content = ref('')
const rawContent = ref('')
const isStreaming = ref(false)
const currentSpeed = ref(30)
const cursorVisible = ref(true)
let cursorInterval = null
let streamTimeout = null

const speedOptions = [
  { label: '极速', value: 10 },
  { label: '快速', value: 30 },
  { label: '正常', value: 60 },
  { label: '慢速', value: 120 },
  { label: '逐字', value: 300 }
]

const sampleTexts = [
  {
    title: '代码示例',
    content: `## 快速排序算法

\`\`\`javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr

  const pivot = arr[Math.floor(arr.length / 2)]
  const left = arr.filter(x => x < pivot)
  const middle = arr.filter(x => x === pivot)
  const right = arr.filter(x => x > pivot)

  return [...quickSort(left), ...middle, ...quickSort(right)]
}

// 使用示例
const arr = [3, 6, 8, 10, 1, 2, 1]
console.log(quickSort(arr))
\`\`\`

> 时间复杂度: **O(n log n)** 平均情况，**O(n²)** 最坏情况
> 空间复杂度: **O(log n)**`
  },
  {
    title: '技术文档',
    content: `# Vue 3 组合式 API

## 核心概念

**组合式 API** 是 Vue 3 引入的一种新的编写组件逻辑的方式。

### 响应式系统

Vue 3 使用 \`ref\` 和 \`reactive\` 来创建响应式状态：

- \`ref()\` - 用于基本类型，可追踪变化
- \`reactive()\` - 用于对象类型

### 生命周期钩子

| 钩子名称 | 调用时机 |
|---------|---------|
| onMounted | 组件挂载完成后 |
| onUpdated | 组件更新后 |
| onUnmounted | 组件卸载后 |

### 依赖注入

使用 \`provide\` 和 \`inject\` 实现跨层级通信：

\`\`\`javascript
// 父组件
import { provide } from 'vue'
provide('theme', 'dark')

// 子组件
import { inject } from 'vue'
const theme = inject('theme')
\`\`\``
  },
  {
    title: '优雅散文',
    content: `# 静夜思

窗前的月光洒落，
如银纱轻覆大地。

> **床前明月光，疑是地上霜。**
> **举头望明月，低头思故乡。**

---

*此诗语言清新朴素，言短意深，展现了诗人对故乡的深切思念。*`
  }
]

const renderedContent = computed(() => {
  return parseMarkdown(content.value)
})

function parseMarkdown(text) {
  let html = text

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block"><code class="lang-${lang}">${escapeHtml(code.trim())}</code></pre>`
  })

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 标题
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // 引用
  html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 水平线
  html = html.replace(/^---$/gm, '<hr>')

  // 无序列表
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')

  // 表格
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim())
    if (cells.some(c => /^-+$/.test(c.trim()))) {
      return ''
    }
    const isHeader = cells.some(c => c.trim().startsWith('**'))
    const tag = isHeader ? 'th' : 'td'
    const cellHtml = cells.map(c => {
      let text = c.trim().replace(/^\*\*(.+)\*\*$/, '$1')
      return `<${tag}>${text}</${tag}>`
    }).join('')
    return `<tr>${cellHtml}</tr>`
  })
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')

  // 段落
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>')

  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '')

  return html
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

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

  function streamNext() {
    if (!isStreaming.value || index >= chars.length) {
      isStreaming.value = false
      stopCursor()
      return
    }

    const chunkSize = currentSpeed.value < 50 ? 3 : 1
    const end = Math.min(index + chunkSize, chars.length)
    content.value = text.substring(0, end)
    index = end

    const delay = currentSpeed.value < 50 ? currentSpeed.value / 3 : currentSpeed.value
    streamTimeout = setTimeout(streamNext, delay)
  }

  streamTimeout = setTimeout(streamNext, currentSpeed.value)
}

function setSpeed(speed) {
  currentSpeed.value = speed
}

onUnmounted(() => {
  stopStream()
  stopCursor()
})
</script>

<template>
  <div class="markdown-stream">
    <div class="background"></div>

    <!-- 控制面板 -->
    <div class="controls">
      <div class="control-group">
        <span class="label">速度:</span>
        <div class="speed-buttons">
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

      <div class="control-group">
        <span class="label">示例:</span>
        <div class="sample-buttons">
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

      <div class="action-buttons">
        <button
          class="action-btn stop"
          @click="stopStream"
          :disabled="!isStreaming"
        >
          ⏸ 暂停
        </button>
        <button class="action-btn clear" @click="clearContent">
          🗑 清空
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-wrapper">
      <div class="markdown-body" v-html="renderedContent"></div>
      <span v-if="isStreaming" class="cursor" :class="{ visible: cursorVisible }">▋</span>
    </div>
  </div>
</template>

<style scoped>
.markdown-stream {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

/* 控制面板 */
.controls {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
}

.speed-buttons, .sample-buttons {
  display: flex;
  gap: 6px;
}

.speed-btn, .sample-btn, .action-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.speed-btn:hover, .sample-btn:hover, .action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.speed-btn.active {
  background: rgba(99, 179, 237, 0.3);
  border-color: rgba(99, 179, 237, 0.6);
  color: #63b3ed;
}

.sample-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.action-btn.stop {
  border-color: rgba(237, 137, 54, 0.5);
  color: #ed8936;
}

.action-btn.stop:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.clear {
  border-color: rgba(239, 83, 80, 0.5);
  color: #fc8181;
}

/* 内容区域 */
.content-wrapper {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.markdown-body {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
  color: #e2e8f0;
}

.cursor {
  display: inline-block;
  color: #63b3ed;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.1s;
}

.cursor.visible {
  opacity: 1;
}

/* Markdown 样式 */
.markdown-body :deep(h1) {
  font-size: 2em;
  font-weight: 700;
  margin: 0 0 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid rgba(99, 179, 237, 0.3);
  color: #90cdf4;
}

.markdown-body :deep(h2) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 32px 0 16px;
  color: #81e6d9;
}

.markdown-body :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 24px 0 12px;
  color: #9f7aea;
}

.markdown-body :deep(h4), .markdown-body :deep(h5), .markdown-body :deep(h6) {
  font-size: 1em;
  font-weight: 600;
  margin: 16px 0 8px;
  color: #fbb6ce;
}

.markdown-body :deep(p) {
  margin: 12px 0;
}

.markdown-body :deep(strong) {
  color: #fbd38d;
  font-weight: 600;
}

.markdown-body :deep(em) {
  color: #fbb6ce;
  font-style: italic;
}

.markdown-body :deep(blockquote) {
  margin: 16px 0;
  padding: 12px 20px;
  background: rgba(99, 179, 237, 0.1);
  border-left: 4px solid #63b3ed;
  border-radius: 0 8px 8px 0;
  color: rgba(255, 255, 255, 0.85);
}

.markdown-body :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99, 179, 237, 0.5), transparent);
  margin: 24px 0;
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
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.markdown-body :deep(tr) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.markdown-body :deep(tr:last-child) {
  border-bottom: none;
}

.markdown-body :deep(th), .markdown-body :deep(td) {
  padding: 10px 16px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(99, 179, 237, 0.2);
  font-weight: 600;
  color: #90cdf4;
}

.markdown-body :deep(td) {
  color: rgba(255, 255, 255, 0.9);
}

/* 代码块 */
.markdown-body :deep(.code-block) {
  margin: 16px 0;
  padding: 16px 20px;
  background: #0d1117;
  border: 1px solid rgba(99, 179, 237, 0.2);
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-body :deep(.code-block code) {
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #c9d1d9;
}

.markdown-body :deep(.inline-code) {
  padding: 2px 6px;
  background: rgba(99, 179, 237, 0.15);
  border: 1px solid rgba(99, 179, 237, 0.3);
  border-radius: 4px;
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.9em;
  color: #9be9a8;
}
</style>
