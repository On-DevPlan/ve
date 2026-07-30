<script setup lang="ts">
// ParallaxCard.vue —— 单张视差滚动卡片。
//
// 原理(对齐 ghost-huang ParallaxCard):
//   - 背景层 .sl-pg-bg 比卡片更高(backgroundHeight = cardHeight × 1.4),
//     绝对定位在卡片内,通过 translateY(bgOffset) 上下平移。
//   - 滚动时按卡片在视口中的进度 topPercent ∈ [0,1] 计算 bgOffset,
//     背景平移、前景不动 → 视觉速度差 = 视差。
//   - IntersectionObserver:卡片进入视口才挂 scroll 监听,离开即摘除(性能)。
//
// 与原版的差异:
//   - 背景高度用 cardHeight × 固定倍率,不依赖图片原始分辨率(分辨率无关);
//   - 视差/入场解耦:入场错落由父级 index.vue 的 .parallax-item 负责,
//     本组件只管背景视差。

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

interface Props {
  /** 背景图 URL(绝对路径,如 /gallery/gallery-01.jpg) */
  image: string;
  /** 卡片期望高度(px);父级按图片宽高比给定,决定瀑布流错落 */
  defaultHeight?: number;
  /** 编号(展示用) */
  number?: number;
  /** 标题 */
  title?: string;
  /** 日期 */
  date?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultHeight: 640,
  number: 0,
  title: '',
  date: '',
});

// 背景比卡片高出的比例 —— 视差可滑动范围 = cardHeight × (RATIO - 1)
const BG_RATIO = 1.4;

const containerRef = ref<HTMLDivElement | null>(null);
const bgOffset = ref(0);
const cardHeight = ref(props.defaultHeight);
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);

// 卡片实际高度:在窄屏按窗口宽度等比收缩,避免单列时过高
function updateCardSize() {
  if (typeof window !== 'undefined') windowWidth.value = window.innerWidth;
  // 单列(移动端)时按窗口宽度的 1.2 倍封顶,桌面沿用 defaultHeight
  const mobileCap = windowWidth.value <= 768 ? windowWidth.value * 1.2 : props.defaultHeight;
  cardHeight.value = Math.min(props.defaultHeight, mobileCap);
  if (containerRef.value) containerRef.value.style.height = `${cardHeight.value}px`;
}

// 背景层高度
const backgroundHeight = computed(() => Math.round(cardHeight.value * BG_RATIO));
// 背景可平移范围(负值,向上滑)
const scrollableRange = computed(() => backgroundHeight.value - cardHeight.value);

// 视差偏移:按卡片在视口的进度把背景向上推
function updateParallax() {
  const el = containerRef.value;
  if (!el || typeof window === 'undefined') return;
  const rect = el.getBoundingClientRect();
  const winH = window.innerHeight;
  // topPercent:卡片顶刚出视口下沿 → 0;卡片底刚离视口上沿 → 1
  const topPercent = Math.min(
    Math.max((winH - rect.top) / (winH + rect.height), 0),
    1,
  );
  bgOffset.value = -scrollableRange.value * topPercent;
}

let observer: IntersectionObserver | null = null;
let rafId = 0;
// 滚动监听目标:最近的滚动祖先(展示中心里组件挂在 overflow:hidden 容器,
// 真正滚动的是组件根 .sl-pg,窗口不滚);拿不到则回退 window。
let scrollTarget: EventTarget = typeof window !== 'undefined' ? window : (null as unknown as EventTarget);

function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return node;
    node = node.parentElement;
  }
  return window;
}

function onScroll() {
  if (rafId) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = 0;
    updateParallax();
  });
}

function onResize() {
  updateCardSize();
  updateParallax();
}

onMounted(() => {
  updateCardSize();
  updateParallax();
  scrollTarget = findScrollParent(containerRef.value);

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        scrollTarget.addEventListener('scroll', onScroll, { passive: true });
        updateParallax();
      } else {
        scrollTarget.removeEventListener('scroll', onScroll);
        // 离开视口时把背景吸到边缘,避免回来时跳变
        const rect = containerRef.value?.getBoundingClientRect();
        if (rect) {
          if (rect.top > window.innerHeight) bgOffset.value = 0;
          else if (rect.bottom < 0) bgOffset.value = -scrollableRange.value;
        }
      }
    },
    { root: null, threshold: 0 },
  );
  if (containerRef.value) observer.observe(containerRef.value);

  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  if (rafId) window.cancelAnimationFrame(rafId);
  scrollTarget.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div
    ref="containerRef"
    class="sl-pg-card"
  >
    <!-- 背景层:比卡片高,随滚动平移产生视差 -->
    <div
      class="sl-pg-bg"
      :style="{
        transform: `translateY(${bgOffset}px)`,
        height: `${backgroundHeight}px`,
        backgroundImage: `url(${image})`,
      }"
    />

    <!-- 前景内容 -->
    <div class="sl-pg-content">
      <span
        v-if="number"
        class="sl-pg-number"
      >{{ number }}</span>
      <div
        v-if="title || date"
        class="sl-pg-caption"
      >
        <h3 v-if="title">
          {{ title }}
        </h3>
        <p v-if="date">
          {{ date }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sl-pg-card {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  background: #111;
  /* cardHeight 由 JS 内联设置 height */
}

.sl-pg-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
  pointer-events: none;
  will-change: transform;
  transition: transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.sl-pg-content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  box-sizing: border-box;
}

.sl-pg-number {
  align-self: flex-start;
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  font-family: 'Inter Tight', 'PingFang SC', sans-serif;
}

.sl-pg-caption {
  align-self: stretch;
  text-align: center;
  padding: 1.25rem;
  margin: 0 -1.25rem -1.25rem;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.78) 0%,
    rgba(0, 0, 0, 0.45) 55%,
    transparent 100%
  );
}

.sl-pg-caption h3 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}

.sl-pg-caption p {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  font-family: 'JetBrains Mono', 'PingFang SC', monospace;
}
</style>
