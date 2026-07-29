<script setup lang="ts">
// 无 DOM 测量面板:pretext use case 1 的展示。
// 不触发重排地测量文本高度 / 行数,与浏览器真实渲染对照精度,并跑 pretext vs DOM 基准。
import { computed, nextTick, ref, watch } from 'vue';
import { layout, prepare } from '@chenglou/pretext';
import { DEFAULT_SAMPLE_ID, SAMPLES } from './samples';
import { usePretextFont } from './usePretext';
import type { BenchResult } from './types';

const BENCH_ITERATIONS = 1000;

const { status, canvasFont } = usePretextFont();

const sampleId = ref(DEFAULT_SAMPLE_ID);
const width = ref(420);
const fontSize = ref(16);
const lineHeightPx = ref(26);

const sampleText = computed(
  () => SAMPLES.find((s) => s.id === sampleId.value) ?? SAMPLES[0],
);

// 一次性预处理 + 纯算术布局(canvasFont 读取 status.family,字体加载后自动重算)。
const prepared = computed(() =>
  prepare(sampleText.value.text, canvasFont(fontSize.value)),
);
const pretext = computed(() => layout(prepared.value, width.value, lineHeightPx.value));

// 与 CSS 严格对齐的渲染样式,保证 pretext 测量与浏览器渲染一致。
const blockStyle = computed(() => ({
  width: `${width.value}px`,
  fontFamily: status.value.family,
  fontSize: `${fontSize.value}px`,
  lineHeight: `${lineHeightPx.value}px`,
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
  wordBreak: 'normal',
}));

// 浏览器真实渲染高度:读 DOM。flush:'post' 确保 DOM 更新后再测量。
const domRef = ref<HTMLDivElement | null>(null);
const domHeight = ref<number | null>(null);

const signature = computed(
  () =>
    `${sampleId.value}|${width.value}|${fontSize.value}|${lineHeightPx.value}|${status.value.family}|${status.value.ready}`,
);

function measureDom(): void {
  const el = domRef.value;
  domHeight.value = el ? Math.round(el.getBoundingClientRect().height) : null;
}

watch(signature, measureDom, { flush: 'post', immediate: true });

const delta = computed(() => {
  if (domHeight.value === null) return null;
  return domHeight.value - pretext.value.height;
});

// ---- 性能基准 ----
const bench = ref<BenchResult | null>(null);
const running = ref(false);
const benchMountRef = ref<HTMLDivElement | null>(null);

async function runBenchmark(): Promise<void> {
  if (running.value) return;
  const mount = benchMountRef.value;
  if (!mount) return;
  running.value = true;
  bench.value = null;
  // 让 UI 先切到"运行中"再开始阻塞主线程。
  await nextTick();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const text = sampleText.value.text;
  const font = canvasFont(fontSize.value);
  const lh = lineHeightPx.value;
  const w = width.value;

  let t0 = performance.now();
  const p = prepare(text, font);
  const prepareMs = performance.now() - t0;

  t0 = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) layout(p, w, lh);
  const layoutMs = performance.now() - t0;

  // DOM 测量:每次创建 + 挂载 + 读 offsetHeight + 移除,强制真实重排。
  let total = 0;
  t0 = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    const div = document.createElement('div');
    div.style.width = `${w}px`;
    div.style.font = font;
    div.style.lineHeight = `${lh}px`;
    div.style.whiteSpace = 'normal';
    div.style.overflowWrap = 'break-word';
    div.style.wordBreak = 'normal';
    div.textContent = text;
    mount.appendChild(div);
    total += div.offsetHeight; // 读 offsetHeight 强制布局
    mount.removeChild(div);
  }
  const domMs = performance.now() - t0;

  bench.value = {
    iterations: BENCH_ITERATIONS,
    prepareMs,
    layoutMs,
    domMs,
    speedup: domMs / Math.max(layoutMs, 0.001),
    sampleHeight: total / BENCH_ITERATIONS,
  };
  running.value = false;
}

function fmtMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}
</script>

<template>
  <div class="sl-measure">
    <div class="sl-measure__main">
      <div class="sl-measure__controls">
        <label class="sl-field">
          <span class="sl-field__label">样例</span>
          <select
            v-model="sampleId"
            class="sl-field__select"
          >
            <option
              v-for="s in SAMPLES"
              :key="s.id"
              :value="s.id"
            >
              {{ s.label }}
            </option>
          </select>
        </label>

        <label class="sl-field">
          <span class="sl-field__label">宽度 {{ width }}px</span>
          <input
            v-model.number="width"
            type="range"
            min="220"
            max="640"
            class="sl-field__range"
          >
        </label>

        <label class="sl-field">
          <span class="sl-field__label">字号 {{ fontSize }}px</span>
          <input
            v-model.number="fontSize"
            type="range"
            min="12"
            max="22"
            class="sl-field__range"
          >
        </label>

        <label class="sl-field">
          <span class="sl-field__label">行高 {{ lineHeightPx }}px</span>
          <input
            v-model.number="lineHeightPx"
            type="range"
            min="18"
            max="38"
            class="sl-field__range"
          >
        </label>
      </div>

      <div class="sl-measure__stage">
        <div class="sl-measure__stage-label">
          浏览器真实渲染(虚线 = pretext 预测高度)
        </div>
        <div
          ref="domRef"
          class="sl-measure__ref"
          :style="blockStyle"
        >
          {{ sampleText.text }}
          <div
            class="sl-measure__predict"
            :style="{ top: pretext.height + 'px' }"
          >
            <span class="sl-measure__predict-tag">pretext {{ pretext.height }}px</span>
          </div>
        </div>
      </div>
    </div>

    <aside class="sl-measure__side">
      <section class="sl-measure__panel">
        <h4 class="sl-measure__panel-title">
          实时指标
        </h4>
        <div class="sl-measure__metrics">
          <div class="sl-metric">
            <span class="sl-metric__label">pretext 高度</span>
            <span class="sl-metric__value">{{ pretext.height }}px</span>
          </div>
          <div class="sl-metric">
            <span class="sl-metric__label">行数</span>
            <span class="sl-metric__value">{{ pretext.lineCount }}</span>
          </div>
          <div class="sl-metric">
            <span class="sl-metric__label">DOM 实际高度</span>
            <span class="sl-metric__value">{{ domHeight ?? '—' }}{{ domHeight === null ? '' : 'px' }}</span>
          </div>
          <div class="sl-metric">
            <span class="sl-metric__label">误差</span>
            <span
              class="sl-metric__value"
              :class="{ 'sl-metric__value--zero': delta === 0 }"
            >
              {{ delta === null ? '—' : (delta >= 0 ? '+' : '') + delta + 'px' }}
            </span>
          </div>
        </div>
        <p class="sl-measure__note">
          pretext 高度 = 行数 × 行高,与浏览器 <code>line-height</code> 块高一致,误差应稳定在 0。
        </p>
      </section>

      <section class="sl-measure__panel">
        <h4 class="sl-measure__panel-title">
          性能基准
        </h4>
        <p class="sl-measure__note">
          同样测量本段文本 {{ BENCH_ITERATIONS }} 次。pretext 仅做算术;DOM 每次创建节点并读
          <code>offsetHeight</code>,强制重排。
        </p>
        <button
          type="button"
          class="sl-measure__run"
          :disabled="running"
          @click="runBenchmark"
        >
          {{ running ? '运行中…' : `运行基准 (×${BENCH_ITERATIONS})` }}
        </button>

        <div
          v-if="bench"
          class="sl-measure__bench"
        >
          <div class="sl-bench-row">
            <span>pretext prepare(一次性)</span>
            <strong>{{ fmtMs(bench.prepareMs) }}</strong>
          </div>
          <div class="sl-bench-row">
            <span>pretext layout ×{{ bench.iterations }}</span>
            <strong>{{ fmtMs(bench.layoutMs) }}</strong>
          </div>
          <div class="sl-bench-row sl-bench-row--dom">
            <span>DOM offsetHeight ×{{ bench.iterations }}</span>
            <strong>{{ fmtMs(bench.domMs) }}</strong>
          </div>
          <div class="sl-bench-speedup">
            <span>加速比</span>
            <strong>{{ bench.speedup.toFixed(1) }}×</strong>
          </div>
        </div>
      </section>
    </aside>

    <!-- 基准用离屏挂载点:已连接到 DOM,读 offsetHeight 才会触发真实重排 -->
    <div
      ref="benchMountRef"
      class="sl-measure__bench-mount"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.sl-measure {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--sl-space-3);
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
}

.sl-measure__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-3);
}

.sl-measure__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sl-space-3);
  align-items: flex-end;
  padding: var(--sl-space-3);
  background: var(--sl-color-surface-alt);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
}

.sl-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--sl-color-text-muted);
}

.sl-field__label {
  white-space: nowrap;
}

.sl-field__select {
  height: 30px;
  padding: 0 var(--sl-space-2);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-surface);
  color: var(--sl-color-text);
  font: inherit;
}

.sl-field__range {
  width: 130px;
}

.sl-measure__stage {
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-2);
}

.sl-measure__stage-label {
  font-size: 12px;
  color: var(--sl-color-text-muted);
}

.sl-measure__ref {
  position: relative;
  color: var(--sl-color-text);
  border: 1px dashed var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  padding: var(--sl-space-2);
  background: var(--sl-color-surface);
}

.sl-measure__predict {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px dashed var(--sl-color-primary);
  pointer-events: none;
}

.sl-measure__predict-tag {
  position: absolute;
  right: 0;
  top: -10px;
  transform: translateY(-100%);
  font-size: 11px;
  font-weight: 700;
  color: var(--sl-color-on-primary);
  background: var(--sl-color-primary);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.sl-measure__side {
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-3);
}

.sl-measure__panel {
  padding: var(--sl-space-3);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-surface);
}

.sl-measure__panel-title {
  margin: 0 0 var(--sl-space-2);
  font-size: 13px;
  font-weight: 700;
  color: var(--sl-color-text);
}

.sl-measure__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sl-space-2);
}

.sl-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sl-space-2);
  background: var(--sl-color-surface-alt);
  border-radius: var(--sl-radius-md);
}

.sl-metric__label {
  font-size: 11px;
  color: var(--sl-color-text-muted);
}

.sl-metric__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--sl-color-text);
  font-variant-numeric: tabular-nums;
}

.sl-metric__value--zero {
  color: var(--sl-color-primary);
}

.sl-measure__note {
  margin: var(--sl-space-2) 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sl-color-text-muted);
}

.sl-measure__note code {
  padding: 1px 4px;
  background: var(--sl-color-surface-alt);
  border-radius: 3px;
  font-size: 11px;
}

.sl-measure__run {
  width: 100%;
  margin-top: var(--sl-space-2);
  padding: var(--sl-space-2) var(--sl-space-3);
  border: 1px solid var(--sl-color-primary);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-primary);
  color: var(--sl-color-on-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.sl-measure__run:disabled {
  opacity: 0.6;
  cursor: progress;
}

.sl-measure__bench {
  margin-top: var(--sl-space-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sl-bench-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--sl-color-text-muted);
}

.sl-bench-row strong {
  color: var(--sl-color-text);
  font-variant-numeric: tabular-nums;
}

.sl-bench-row--dom strong {
  color: #b91c1c;
}

.sl-bench-speedup {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--sl-color-border);
  font-size: 13px;
  color: var(--sl-color-text-muted);
}

.sl-bench-speedup strong {
  font-size: 20px;
  color: var(--sl-color-primary);
}

.sl-measure__bench-mount {
  position: absolute;
  left: -99999px;
  top: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}

@media (max-width: 880px) {
  .sl-measure {
    grid-template-columns: 1fr;
  }
}
</style>
