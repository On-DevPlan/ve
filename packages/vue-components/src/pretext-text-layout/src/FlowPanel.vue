<script setup lang="ts">
// 文字绕流面板:pretext use case 2 的展示。
// 文字"四周环绕"一个可拖拽图形:与图形重叠的行被拆成左右两段(图形左侧 + 右侧),
// 图形上方/下方的行占满整宽。pretext 逐行变宽游标 API 让"同一视觉行排两段"成为可能。
// 核心 API:prepareWithSegments(一次性) → layoutNextLineRange / materializeLineRange(逐行)。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext';
import { DEFAULT_SAMPLE_ID, SAMPLES } from './samples';
import { usePretextFont } from './usePretext';
import type { FlowShape, LineRow } from './types';

const MIN_LINE_WIDTH = 32; // 极窄宽度下保护性下限,避免把文字挤成巨量行
const DEFAULT_SHAPE: FlowShape = { x: 0, y: 0, w: 132, h: 132 };

const { canvasFont } = usePretextFont();

const sampleId = ref(DEFAULT_SAMPLE_ID);
const fontSize = ref(16);
const lineHeightPx = ref(26);
const shape = ref<FlowShape>({ ...DEFAULT_SHAPE });

const contentRef = ref<HTMLDivElement | null>(null);
const containerWidth = ref(0);

const sampleText = computed(
  () => SAMPLES.find((s) => s.id === sampleId.value) ?? SAMPLES[0],
);

// 一次性预处理:文本 + canvas font。canvasFont 读取 status.family,字体加载完成
// 后 family 翻转,该 computed 自动重算,无需手动 invalidate。
const prepared = computed(() =>
  prepareWithSegments(sampleText.value.text, canvasFont(fontSize.value)),
);

// 四周环绕排版。与图形纵向重叠的行 → 拆成左右两段:先用宽 = shape.x 排左侧段,
// 再用"同一游标"接续排右侧段(宽 = 容器宽 - 图形右边)。图形上方/下方的行 → 整宽。
// 同一视觉行用两个不同宽度各排一段,是 CSS float / shape-outside 做不到的真正环绕。
const rows = computed<LineRow[]>(() => {
  const p = prepared.value;
  const cw = containerWidth.value;
  if (!p || cw <= 0) return [];
  const s = shape.value;
  const lh = lineHeightPx.value;
  const out: LineRow[] = [];
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = 0;
  // 安全上限,防止畸形 shape 挤出巨量行;正常文本会在游标耗尽时自然终止。
  for (let guard = 0; guard < 8000; guard++) {
    const overlaps = y + lh > s.y && y < s.y + s.h;
    if (!overlaps) {
      // 图形上方 / 下方:整宽一行
      const range = layoutNextLineRange(p, cursor, cw);
      if (range === null) break;
      out.push({ text: materializeLineRange(p, range).text, x: 0, width: cw, y });
      cursor = range.end;
    } else {
      const leftW = s.x;
      const rightX = s.x + s.w;
      const rightW = cw - rightX;
      // 左侧段(图形左边)
      if (leftW >= MIN_LINE_WIDTH) {
        const left = layoutNextLineRange(p, cursor, leftW);
        if (left) {
          out.push({ text: materializeLineRange(p, left).text, x: 0, width: leftW, y });
          cursor = left.end;
        }
      }
      // 右侧段(同一视觉行,接续左侧段游标)
      if (rightW >= MIN_LINE_WIDTH) {
        const right = layoutNextLineRange(p, cursor, rightW);
        if (right) {
          out.push({ text: materializeLineRange(p, right).text, x: rightX, width: rightW, y });
          cursor = right.end;
        }
      }
      // 两侧都 < MIN(图形几乎占满宽)或文字已尽:不消耗文字,仅下移到图形下方再续排
    }
    y += lh;
  }
  return out;
});

const contentHeight = computed(() => Math.max(rows.value.length * lineHeightPx.value, 260));

// ---- 拖拽 ----
const dragging = ref(false);
let dragOffset = { x: 0, y: 0 };

function onPointerDown(e: PointerEvent): void {
  const target = e.currentTarget;
  if (!(target instanceof Element)) return;
  const rect = contentRef.value?.getBoundingClientRect();
  if (!rect) return;
  const s = shape.value;
  dragOffset = { x: e.clientX - rect.left - s.x, y: e.clientY - rect.top - s.y };
  dragging.value = true;
  target.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return;
  const rect = contentRef.value?.getBoundingClientRect();
  if (!rect) return;
  const s = shape.value;
  const maxX = Math.max(0, containerWidth.value - s.w);
  const maxY = Math.max(0, contentHeight.value - s.h);
  const nx = Math.min(Math.max(0, e.clientX - rect.left - dragOffset.x), maxX);
  const ny = Math.min(Math.max(0, e.clientY - rect.top - dragOffset.y), maxY);
  shape.value = { ...s, x: nx, y: ny };
}

function onPointerUp(e: PointerEvent): void {
  const target = e.currentTarget;
  if (target instanceof Element) {
    target.releasePointerCapture(e.pointerId);
  }
  dragging.value = false;
}

function resetShape(): void {
  const w = containerWidth.value;
  shape.value = {
    ...DEFAULT_SHAPE,
    x: Math.max(0, Math.round((w - DEFAULT_SHAPE.w) / 2)),
  };
}

// ---- 尺寸观测 ----
let ro: ResizeObserver | null = null;
onMounted(() => {
  const el = contentRef.value;
  if (!el) return;
  const w = el.getBoundingClientRect().width;
  containerWidth.value = w;
  // 初始把图形水平居中,直接展示四周环绕(左右两段 + 上下整行)
  shape.value = {
    ...shape.value,
    x: Math.max(0, Math.round((w - shape.value.w) / 2)),
  };
  ro = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (rect) containerWidth.value = rect.width;
  });
  ro.observe(el);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
});
</script>

<template>
  <div class="sl-flow">
    <div class="sl-flow__controls">
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

      <label class="sl-field">
        <span class="sl-field__label">图形宽 {{ shape.w }}px</span>
        <input
          :value="shape.w"
          type="range"
          min="60"
          max="280"
          class="sl-field__range"
          @input="shape = { ...shape, w: Number(($event.target as HTMLInputElement).value) }"
        >
      </label>

      <label class="sl-field">
        <span class="sl-field__label">图形高 {{ shape.h }}px</span>
        <input
          :value="shape.h"
          type="range"
          min="60"
          max="280"
          class="sl-field__range"
          @input="shape = { ...shape, h: Number(($event.target as HTMLInputElement).value) }"
        >
      </label>

      <button
        type="button"
        class="sl-field__btn"
        @click="resetShape"
      >
        重置图形
      </button>
    </div>

    <div class="sl-flow__hint">
      拖动方块,文字四周环绕重排(上方 · 左侧 · 右侧 · 下方) —— CSS float 做不到的真正环绕
    </div>

    <!-- 外层是带 padding 的"画框";内层 .sl-flow__canvas 才是绝对定位上下文,
         这样容器宽度(用于断行)与行的坐标原点(0,0)严格一致。 -->
    <div class="sl-flow__content">
      <div
        ref="contentRef"
        class="sl-flow__canvas"
        :style="{ height: contentHeight + 'px' }"
      >
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="sl-flow__line"
          :style="{
            top: row.y + 'px',
            left: row.x + 'px',
            width: row.width + 'px',
            height: lineHeightPx + 'px',
            lineHeight: lineHeightPx + 'px',
            fontSize: fontSize + 'px',
          }"
        >
          {{ row.text }}
        </div>

        <div
          class="sl-flow__shape"
          :class="{ 'sl-flow__shape--grabbing': dragging }"
          :style="{
            left: shape.x + 'px',
            top: shape.y + 'px',
            width: shape.w + 'px',
            height: shape.h + 'px',
          }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <span class="sl-flow__shape-icon">图片</span>
          <span class="sl-flow__shape-text">拖我</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sl-flow {
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-3);
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
}

.sl-flow__controls {
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

.sl-field__select,
.sl-field__btn {
  height: 30px;
  padding: 0 var(--sl-space-2);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-surface);
  color: var(--sl-color-text);
  font: inherit;
}

.sl-field__btn {
  cursor: pointer;
}

.sl-field__btn:hover {
  border-color: var(--sl-color-primary);
  color: var(--sl-color-primary);
}

.sl-field__range {
  width: 120px;
}

.sl-flow__hint {
  font-size: 13px;
  color: var(--sl-color-text-muted);
}

.sl-flow__hint strong {
  color: var(--sl-color-primary);
}

.sl-flow__content {
  width: 100%;
  padding: var(--sl-space-3);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-surface);
  box-sizing: border-box;
}

.sl-flow__canvas {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.sl-flow__line {
  position: absolute;
  white-space: pre;
  overflow: hidden;
  color: var(--sl-color-text);
}

.sl-flow__shape {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--sl-radius-md);
  background: linear-gradient(
    135deg,
    var(--sl-color-primary),
    color-mix(in srgb, var(--sl-color-primary) 55%, #000 45%)
  );
  color: var(--sl-color-on-primary);
  cursor: grab;
  touch-action: none;
  user-select: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  transition: transform 0.08s ease;
}

.sl-flow__shape--grabbing {
  cursor: grabbing;
  transform: scale(1.02);
}

.sl-flow__shape-icon {
  font-size: 28px;
  line-height: 1;
}

.sl-flow__shape-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
