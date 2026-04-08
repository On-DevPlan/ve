<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import markdownItMath from 'markdown-it-math'
import katex from 'katex'

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 使用 markdown-it-math 插件
md.use(markdownItMath)

// KaTeX 配置
const katexOptions = {
  throwOnError: false,
  displayMode: true
}

const katexOptionsInline = {
  throwOnError: false,
  displayMode: false
}

// markdown-it-math 插件输出的 HTML 不自动渲染 KaTeX，
// 需要手动 post-processing：把 $$...$$ 和 $...$ 里的 LaTeX 用 KaTeX 渲染
function renderKatex(html) {
  // 渲染块级公式 $$...$$
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, tex) => {
    try {
      return `<div class="katex-display"><div class="katex">${katex.renderToString(tex.trim(), { ...katexOptions, displayMode: true })}</div></div>`
    } catch {
      return `<div class="katex-display"><code>${tex}</code></div>`
    }
  })
  // 渲染行内公式 $...$
  html = html.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    try {
      return `<span class="katex-inline">${katex.renderToString(tex.trim(), { ...katexOptionsInline, displayMode: false })}</span>`
    } catch {
      return `<code>${tex}</code>`
    }
  })
  return html
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

// 包含 LaTeX 数学公式的示例
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

### 薛定谔方程（时间独立形式）

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

// 时间复杂度分析
// T(n) = T(n-1) + T(n-2) + O(1)
// 解为 O(φ^n)，其中 φ = (1 + √5) / 2 ≈ 1.618
\`\`\`

## 斐波那契数列通项

$$F_n = \\frac{\\varphi^n - (1-\\varphi)^n}{\\sqrt{5}}$$

其中 $\\varphi = \\frac{1 + \\sqrt{5}}{2}$ 是黄金分割比。`
  }
]

// 渲染内容
const renderedContent = computed(() => {
  if (!content.value) return ''
  return renderKatex(md.render(content.value))
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

watch(currentSpeed, () => {
  if (isStreaming.value && rawContent.value) {
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
      const chunkSize = currentSpeed.value <= 15 ? 5 : currentSpeed.value <= 35 ? 3 : 1
      const end = Math.min(index + chunkSize, len)
      content.value = rawContent.value.substring(0, end)
      index = end
      const delay = currentSpeed.value < 30 ? currentSpeed.value * 0.5 : currentSpeed.value
      streamTimeout = setTimeout(streamNext, delay)
    }
    streamTimeout = setTimeout(streamNext, currentSpeed.value)
  }
})

onUnmounted(() => {
  stopStream()
  stopCursor()
})
</script>

<template>
  <div class="md-math">
    <div class="bg-pattern"></div>

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
      <span>支持 $\\inline$ 行内公式 和 $$\\block$$ 块级公式 · KaTeX 渲染引擎</span>
    </footer>
  </div>
</template>

<style scoped>
.md-math {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #141820;
  overflow: hidden;
}

.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 40%);
  pointer-events: none;
}

/* 顶部栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(20, 24, 32, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tech-badge {
  padding: 3px 10px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(59, 130, 246, 0.25));
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #818cf8;
  letter-spacing: 1px;
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
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
  color: rgba(255, 255, 255, 0.4);
}

/* 控制栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 24px;
  background: rgba(22, 26, 36, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
  color: rgba(255, 255, 255, 0.35);
  font-weight: 500;
}

.btn-row {
  display: flex;
  gap: 4px;
}

.ctrl-btn, .sample-btn, .action-btn {
  padding: 5px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover, .sample-btn:hover, .action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.ctrl-btn.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
  color: #a5b4fc;
}

.sample-btn:disabled {
  opacity: 0.3;
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
  border-color: rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

.action-btn.pause:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.clear {
  border-color: rgba(248, 113, 113, 0.4);
  color: #f87171;
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
  background: rgba(20, 24, 32, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  min-height: 300px;
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.math-body {
  padding: 28px 32px;
  color: #f8fafc;
  line-height: 1.8;
}

.blink-cursor {
  display: inline-block;
  color: #818cf8;
  opacity: 0;
  transition: opacity 0.1s;
}

.blink-cursor.visible {
  opacity: 1;
}

/* Markdown + KaTeX 样式 */
.math-body :deep(h1) {
  font-size: 1.6em;
  font-weight: 600;
  margin: 0 0 24px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.math-body :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 28px 0 14px;
  color: #f1f5f9;
}

.math-body :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 20px 0 10px;
  color: #e2e8f0;
}

.math-body :deep(p) {
  margin: 10px 0;
  color: #e2e8f0;
}

.math-body :deep(strong) {
  color: #ffffff;
  font-weight: 600;
}

.math-body :deep(em) {
  color: #cbd5e1;
  font-style: italic;
}

.math-body :deep(blockquote) {
  margin: 14px 0;
  padding: 10px 18px;
  background: rgba(99, 102, 241, 0.1);
  border-left: 3px solid #818cf8;
  border-radius: 0 5px 5px 0;
  color: #c7d2fe;
}

.math-body :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  margin: 24px 0;
}

.math-body :deep(ul), .math-body :deep(ol) {
  margin: 10px 0;
  padding-left: 22px;
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
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow-x: auto;
}

.math-body :deep(pre code) {
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  color: #c9d1d9;
}

.math-body :deep(code) {
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.88em;
  padding: 2px 5px;
  background: rgba(110, 118, 129, 0.18);
  border: 1px solid rgba(110, 118, 129, 0.25);
  border-radius: 3px;
  color: #f0883e;
}

/* KaTeX 数学公式样式 */
.math-body :deep(.katex-display) {
  margin: 16px 0;
  padding: 14px 18px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 8px;
  overflow-x: auto;
}

.math-body :deep(.katex) {
  font-size: 1.1em;
  color: #e2e8f0;
}

.math-body :deep(.katex-display > .katex) {
  font-size: 1.2em;
  color: #f1f5f9;
}

.math-body :deep(.katex-inline .katex) {
  color: #e2e8f0;
}

.math-body :deep(.katex-display .katex .mord),
.math-body :deep(.katex-display .katex .mbin),
.math-body :deep(.katex-display .katex .mrel),
.math-body :deep(.katex-display .katex .mopen),
.math-body :deep(.katex-display .katex .mclose) {
  color: #f1f5f9;
}

/* 页脚 */
.footer {
  padding: 9px 24px;
  background: rgba(20, 24, 32, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  text-align: center;
}

.footer span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}
</style>
