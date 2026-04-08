<script setup>
import { ref, computed, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import katex from 'katex'

// markdown-it（无 math 插件）
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// KaTeX 选项
const KatexOpts = {
  throwOnError: false,
  displayMode: true
}
const KatexOptsInline = {
  throwOnError: false,
  displayMode: false
}

// 先把 LaTeX 渲染成 KaTeX HTML，再交给 markdown-it 处理剩余文字
// 这样 markdown-it 不会把 $$ 转成 HTML 实体
function renderMath(src) {
  // 块级 $$...$$
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return `<div class="katex-display">${katex.renderToString(tex.trim(), { ...KatexOpts, displayMode: true })}</div>`
    } catch {
      return `<div class="katex-display"><code>${tex}</code></div>`
    }
  })
  // 行内 $...$（确保不在 code block 内）
  src = src.replace(/(^|[^\\])\$([^$\n]+?)\$/gm, (_, lead, tex) => {
    try {
      return `${lead}<span class="katex-inline">${katex.renderToString(tex.trim(), { ...KatexOptsInline, displayMode: false })}</span>`
    } catch {
      return `${lead}<code>${tex}</code>`
    }
  })
  return src
}

// 对已渲染好的 HTML 中的行内公式做二次处理（markdown-it 可能破坏 $...$）
function renderInlineMath(html) {
  return html.replace(/<span class="katex-inline">([\s\S]*?)<\/span>/g, (match, tex) => {
    try {
      return `<span class="katex-inline">${katex.renderToString(tex.trim(), { ...KatexOptsInline, displayMode: false })}</span>`
    } catch {
      return match
    }
  })
}

// 最终渲染
function render(src) {
  if (!src) return ''
  const withMath = renderMath(src)
  return renderInlineMath(md.render(withMath))
}

// 状态
const content = ref('')
const rawContent = ref('')
const isStreaming = ref(false)
const currentSpeed = ref(35)
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
    title: '数学公式',
    content: `# 欧拉恒等式

被誉为"数学中最美的公式"：

$$e^{i\\pi} + 1 = 0$$

## 积分公式

### 牛顿-莱布尼茨公式

若 $F'(x) = f(x)$，则：

$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

## 矩阵运算

### 行列式

$$\\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$$

## 概率论

### 正态分布概率密度函数

$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}$$

其中 $\\mu$ 是均值，$\\sigma^2$ 是方差。`
  },
  {
    title: '物理学',
    content: `# 质能方程

爱因斯坦的质能等价公式：

$$E = mc^2$$

## 薛定谔方程

$$-\\frac{\\hbar^2}{2m}\\nabla^2\\psi + V\\psi = E\\psi$$

## 麦克斯韦方程组

### 高斯定律

$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$

### 法拉第电磁感应定律

$$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$$`
  },
  {
    title: '机器学习',
    content: `# 激活函数

## Sigmoid 函数

$$\\sigma(x) = \\frac{1}{1 + e^{-x}}$$

## Softmax 函数

$$\\text{Softmax}(x_i) = \\frac{e^{x_i}}{\\sum_{j=1}^{n} e^{x_j}}$$

## 交叉熵损失

$$L = -\\sum_{i=1}^{n} y_i \\log(\\hat{y}_i)$$

## 梯度下降

$$\\theta_{t+1} = \\theta_t - \\alpha \\nabla J(\\theta_t)$$

其中 $\\alpha$ 是学习率。`
  },
  {
    title: '代码+数学',
    content: `## 示例代码

\`\`\`javascript
// 计算斐波那契数列
function fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}
\`\`\`

## 斐波那契数列通项

$$F_n = \\frac{\\varphi^n - (1-\\varphi)^n}{\\sqrt{5}}$$

其中 $\\varphi = \\frac{1 + \\sqrt{5}}{2}$ 是黄金分割比。`
  }
]

const renderedContent = computed(() => {
  if (!content.value) return ''
  return render(content.value)
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

  function getChunkSize() {
    if (currentSpeed.value <= 15) return 5
    if (currentSpeed.value <= 35) return 3
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
    const delay = currentSpeed.value < 30 ? currentSpeed.value * 0.5 : currentSpeed.value
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
  <div class="md-math">
    <!-- 顶部栏 -->
    <header class="header">
      <div class="header-left">
        <span class="tech-badge">KaTeX</span>
        <span class="header-title">Markdown + LaTeX 数学渲染</span>
      </div>
      <div class="header-right">
        <span v-if="isStreaming" class="pulse-dot"></span>
        <span class="status-label">{{ isStreaming ? '播放中' : '就绪' }}</span>
      </div>
    </header>

    <!-- 控制栏 -->
    <div class="toolbar">
      <div class="tool-group">
        <span class="group-label">速度</span>
        <div class="btn-row">
          <button
            v-for="opt in speedOptions"
            :key="opt.value"
            :class="['ctrl-btn', { active: currentSpeed === opt.value }]"
            @click="setSpeed(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="tool-group">
        <span class="group-label">示例</span>
        <div class="btn-row">
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

      <div class="tool-group actions">
        <button class="action-btn pause" @click="stopStream" :disabled="!isStreaming">
          {{ isStreaming ? '⏸' : '▶' }}
        </button>
        <button class="action-btn clear" @click="clearContent">
          🗑
        </button>
      </div>
    </div>

    <!-- 主内容 -->
    <main class="content">
      <div class="render-paper">
        <article class="math-body" v-html="renderedContent"></article>
        <span class="blink-cursor" :class="{ visible: cursorVisible && isStreaming }">▋</span>
      </div>
    </main>

    <!-- 底部说明 -->
    <footer class="footer">
      <span>支持 $inline$ 行内公式 和 $$block$$ 块级公式 · KaTeX 渲染引擎</span>
    </footer>
  </div>
</template>

<style scoped>
.md-math {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
  overflow: hidden;
}

/* 顶部栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tech-badge {
  padding: 3px 10px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(59, 130, 246, 0.15));
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  letter-spacing: 1px;
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background: #10b981;
  border-radius: 50%;
  animation: blink 1.2s ease infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-label {
  font-size: 12px;
  color: #86868b;
}

/* 控制栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 24px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 10;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #86868b;
  font-weight: 500;
}

.btn-row {
  display: flex;
  gap: 4px;
}

.ctrl-btn, .sample-btn, .action-btn {
  padding: 5px 11px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  background: #f5f5f7;
  color: #1d1d1f;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover, .sample-btn:hover, .action-btn:hover {
  background: #e8e8ed;
  color: #1d1d1f;
}

.ctrl-btn.active {
  background: #007aff;
  border-color: #007aff;
  color: #fff;
}

.sample-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.actions {
  margin-left: auto;
}

.action-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.pause {
  border-color: rgba(251, 191, 36, 0.6);
  color: #d97706;
}

.action-btn.pause:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.clear {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

.render-paper {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  min-height: 300px;
  position: relative;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.math-body {
  padding: 28px 32px;
  color: #1d1d1f;
  line-height: 1.8;
}

.blink-cursor {
  display: inline-block;
  color: #6366f1;
  opacity: 0;
  transition: opacity 0.1s;
}

.blink-cursor.visible {
  opacity: 1;
}

/* Markdown 样式 */
.math-body :deep(h1) {
  font-size: 1.6em;
  font-weight: 700;
  margin: 0 0 24px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #1d1d1f;
}

.math-body :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 28px 0 14px;
  color: #1d1d1f;
}

.math-body :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 20px 0 10px;
  color: #3d3d3d;
}

.math-body :deep(p) {
  margin: 10px 0;
  color: #3d3d3d;
}

.math-body :deep(strong) {
  color: #1d1d1f;
  font-weight: 600;
}

.math-body :deep(em) {
  color: #5c5c5c;
  font-style: italic;
}

.math-body :deep(ul), .math-body :deep(ol) {
  margin: 10px 0;
  padding-left: 22px;
  color: #3d3d3d;
}

.math-body :deep(li) {
  margin: 5px 0;
}

.math-body :deep(ul > li) {
  list-style: disc;
}

.math-body :deep(pre) {
  margin: 14px 0;
  padding: 14px;
  background: #f5f5f7;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  overflow-x: auto;
}

.math-body :deep(pre code) {
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  color: #3d3d3d;
}

.math-body :deep(code) {
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.88em;
  padding: 2px 5px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 3px;
  color: #d97706;
}

/* KaTeX 样式 */
.math-body :deep(.katex-display) {
  margin: 16px 0;
  padding: 14px 18px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  overflow-x: auto;
}

.math-body :deep(.katex) {
  font-size: 1.1em;
  color: #1d1d1f;
}

.math-body :deep(.katex-display > .katex) {
  font-size: 1.2em;
}

.math-body :deep(.katex-inline .katex) {
  font-size: 1em;
  color: #1d1d1f;
}

/* 页脚 */
.footer {
  padding: 9px 24px;
  background: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  text-align: center;
}

.footer span {
  font-size: 11px;
  color: #86868b;
}
</style>
