<script setup lang="ts">
// FloatingBack.vue —— 全局悬浮返回按钮(可拖拽)。
//
// 职责:
//   1) 所有页面显示一个 40px 悬浮按钮,点击 router.push('/') 回首页
//   2) pointer 拖拽到视口任意位置(touch-action: none 兼容触屏),拖动 >4px 判定为
//      拖拽,松手不触发点击
//   3) 位置存 localStorage(floating-position.ts),刷新后还原;resize 时 clamp 回视口
//
// 显示策略:
//   - 首页(/)自动隐藏 —— 回首页无意义;登录页 / 详情页都显示
//   - 由 App.vue 挂在 RouterView 旁(transition 之外),路由切换不重挂、拖动不闪
//
// 纯逻辑(clamp / 存取 / 默认位置)在 floating-position.ts,单测见
// __tests__/floating-position.test.ts;本组件只管指针事件与渲染。

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  clampPos,
  defaultPos,
  loadPos,
  savePos,
} from './floating-position';

const route = useRoute();
const router = useRouter();

// 按钮左上角坐标(px);初始 undefined = 首次 mount 前不渲染(避免闪到 0,0)
const pos = ref<{ x: number; y: number } | null>(null);
const dragging = ref(false);

/* ---- 位置初始化与 resize 兜底 ---- */
function applyInitialPos() {
  const stored = loadPos(window.localStorage);
  pos.value = stored
    ? clampPos(stored, window.innerWidth, window.innerHeight)
    : defaultPos(window.innerWidth, window.innerHeight);
}
function onResize() {
  if (pos.value) pos.value = clampPos(pos.value, window.innerWidth, window.innerHeight);
}
onMounted(() => {
  applyInitialPos();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});

/* ---- 拖拽(pointer events,含触屏) ---- */
const DRAG_THRESHOLD = 4;
let pointerId: number | null = null;
// 按下点到按钮左上角的偏移,保证拖拽不跳变
let grabOffset = { x: 0, y: 0 };
// 按下点原始坐标,用于判定"是拖拽还是点击"
let pressPoint = { x: 0, y: 0 };
let moved = false;

function onPointerDown(e: PointerEvent) {
  if (!pos.value) return;
  pointerId = e.pointerId;
  moved = false;
  pressPoint = { x: e.clientX, y: e.clientY };
  grabOffset = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
  dragging.value = true;
  // 拖出按钮后继续收 move/up;失败(如系统手势抢占)时释放捕获兜底
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId || !pos.value) return;
  const dx = e.clientX - pressPoint.x;
  const dy = e.clientY - pressPoint.y;
  if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
  if (!moved) return;
  pos.value = clampPos(
    { x: e.clientX - grabOffset.x, y: e.clientY - grabOffset.y },
    window.innerWidth,
    window.innerHeight,
  );
}
function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return;
  pointerId = null;
  dragging.value = false;
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
  if (moved) savePos(window.localStorage, pos.value ?? { x: 0, y: 0 });
  // moved=false → 走 click 导航;moved=true → 拖拽结束,抑制 click
}

function onGoHome() {
  if (moved) { moved = false; return; } // 拖拽后松手产生的 click,吞掉
  void router.push('/');
}

// 首次 mount 前不定位 → 隐藏;有位置且非首页 → 显示
const visible = ref(false);
watch(
  () => route.path,
  (path) => { visible.value = path !== '/' && pos.value !== null; },
  { immediate: true },
);
watch(pos, () => {
  if (pos.value) visible.value = route.path !== '/';
});
</script>

<template>
  <Transition name="floating-back-fade">
    <button
      v-if="visible && pos"
      class="floating-back"
      :class="{ 'is-dragging': dragging }"
      type="button"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      aria-label="返回首页"
      title="返回首页(可拖动)"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click="onGoHome"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.floating-back {
  position: fixed;
  z-index: 90; /* 高于 DetailPage 覆盖层与 hint(60) */
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(17, 17, 17, 0.25);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  color: #111;
  cursor: grab;
  touch-action: none; /* 触屏拖拽,防页面滚动 */
  user-select: none;
  box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.25);
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.floating-back:hover {
  border-color: #111;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.3);
}
.floating-back.is-dragging {
  cursor: grabbing;
  box-shadow: 0 14px 30px -10px rgba(0, 0, 0, 0.35);
}

/* 显隐淡入淡出 */
.floating-back-fade-enter-active,
.floating-back-fade-leave-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}
.floating-back-fade-enter-from,
.floating-back-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
