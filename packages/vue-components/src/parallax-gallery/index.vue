<script setup lang="ts">
// parallax-gallery/index.vue —— 瀑布流 + 视差滚动画廊。
//
// 模仿 ghost-huang ConcertItemSection:
//   1) 布局切换:可见项 >= 5 → CSS column-count 瀑布流;< 5 → flex grid
//   2) Safari 上 column-count 不稳,改用「找最短列」手动绝对定位瀑布流
//   3) 错落入场:IntersectionObserver 命中后给 .parallax-item 加 .is-visible,
//      transition-delay = min(index,6) × 70ms —— 等价 v-motion 的
//      :delay="Math.min(index * 70, 420)"
//   4) 每张卡片用 ParallaxCard,背景随滚动平移产生视差

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ParallaxCard from './ParallaxCard.vue';

interface GalleryItem {
  id: string;
  file: string;
  title: string;
  date: string;
  w: number;
  h: number;
}

const BASE = '/gallery';
const FULL_COUNT_THRESHOLD = 5; // >= 该数量走瀑布流,< 走 grid

// ---- 数据 ----
const items = ref<GalleryItem[]>([]);
const loadError = ref('');

async function loadManifest() {
  try {
    const resp = await fetch(`${BASE}/gallery.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    items.value = (await resp.json()).items as GalleryItem[];
  } catch (e) {
    loadError.value = (e as Error).message;
  }
}

// ---- 可见数量:用于演示 grid ↔ 瀑布流 切换 ----
const showAll = ref(true);
const visibleItems = computed(() =>
  showAll.value ? items.value : items.value.slice(0, 3),
);
const isWaterfall = computed(() => visibleItems.value.length >= FULL_COUNT_THRESHOLD);

// 每项的期望卡片高度:按宽高比给,竖图高、横图矮,形成稳定错落
function baseHeightFor(it: GalleryItem): number {
  const ratio = it.w / it.h;
  let h: number;
  if (ratio <= 0.7) h = 760;
  else if (ratio <= 0.85) h = 660;
  else if (ratio <= 1.0) h = 560;
  else if (ratio <= 1.3) h = 460;
  else h = 380;
  return h;
}

// ---- Safari 检测:Safari 上禁用 column-count,走手动瀑布流 ----
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isSafari = /^((?!chrome|android).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua);
const useSafariMasonry = computed(() => isSafari && isWaterfall.value);

const containerRef = ref<HTMLElement | null>(null);

// 手动瀑布流:找最短列 → 绝对定位(替代 column-count)
function calculateMasonry() {
  const container = containerRef.value;
  if (!container || !useSafariMasonry.value) return;

  const els = container.querySelectorAll<HTMLElement>('.sl-pg-item');
  if (els.length === 0) return;

  const screenWidth = window.innerWidth;
  let columnCount = 3;
  let gap = 32;
  if (screenWidth <= 768) {
    columnCount = 1;
    gap = 24;
  } else if (screenWidth <= 1024) {
    columnCount = 2;
    gap = 16;
  } else if (screenWidth <= 1200) {
    columnCount = 2;
    gap = 24;
  }

  const containerWidth = container.offsetWidth;
  const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
  const columnHeights = new Array(columnCount).fill(0);

  els.forEach((el) => {
    const shortest = columnHeights.indexOf(Math.min(...columnHeights));
    const itemHeight = el.offsetHeight || 600;
    el.style.position = 'absolute';
    el.style.width = `${columnWidth}px`;
    el.style.left = `${shortest * (columnWidth + gap)}px`;
    el.style.top = `${columnHeights[shortest]}px`;
    columnHeights[shortest] += itemHeight + gap;
  });

  const maxHeight = Math.max(...columnHeights, 0);
  if (maxHeight > 0) {
    container.style.height = `${maxHeight}px`;
    container.style.position = 'relative';
  }
}

function resetManualLayout() {
  const container = containerRef.value;
  if (!container) return;
  container.style.height = '';
  container.style.position = '';
  container
    .querySelectorAll<HTMLElement>('.sl-pg-item')
    .forEach((el) => {
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.width = '';
    });
}

function applyLayout() {
  if (useSafariMasonry.value) {
    nextTick(() => {
      // 两帧后计算,确保 cardHeight 已内联到 DOM
      requestAnimationFrame(() => requestAnimationFrame(calculateMasonry));
    });
  } else {
    resetManualLayout();
  }
}

// ---- 错落入场 ----
const revealObserver = ref<IntersectionObserver | null>(null);
function setupReveal() {
  revealObserver.value = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add('is-visible');
          revealObserver.value?.unobserve(entry.target);
        }
      }
    },
    { root: null, threshold: 0.12 },
  );
}

// ---- resize ----
let resizeTimer = 0;
function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (useSafariMasonry.value) calculateMasonry();
  }, 150);
}

watch([visibleItems, useSafariMasonry], () => {
  // 切换可见数量 / 布局模式后重新排布 + 重新观察新元素
  nextTick(() => {
    applyLayout();
    observeItems();
  });
});

function observeItems() {
  if (!revealObserver.value || !containerRef.value) return;
  // 仅观察尚未显形的项
  containerRef.value
    .querySelectorAll<HTMLElement>('.sl-pg-item:not(.is-visible)')
    .forEach((el) => revealObserver.value?.observe(el));
}

onMounted(async () => {
  setupReveal();
  await loadManifest();
  await nextTick();
  applyLayout();
  observeItems();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.clearTimeout(resizeTimer);
  revealObserver.value?.disconnect();
});
</script>

<template>
  <section class="sl-pg">
    <header class="sl-pg-head">
      <h2>瀑布流视差画廊</h2>
      <p>梦想是不会发光的,会发光的是追梦的你</p>

      <!-- 演示 grid ↔ 瀑布流 切换 -->
      <div class="sl-pg-toggle">
        <button
          type="button"
          :class="['sl-pg-toggle__btn', { active: !showAll }]"
          @click="showAll = false"
        >
          精选 3 张(grid)
        </button>
        <button
          type="button"
          :class="['sl-pg-toggle__btn', { active: showAll }]"
          @click="showAll = true"
        >
          全部 {{ items.length }} 张(瀑布流)
        </button>
      </div>
    </header>

    <p
      v-if="loadError"
      class="sl-pg-error"
    >
      图片清单加载失败:{{ loadError }}(请先运行 `.tool/image-gen` 生成)
    </p>

    <div
      ref="containerRef"
      class="sl-pg-container"
      :class="{
        'is-waterfall': isWaterfall,
        'is-grid': !isWaterfall,
        'is-safari-masonry': useSafariMasonry,
      }"
    >
      <div
        v-for="(it, index) in visibleItems"
        :key="it.id"
        class="sl-pg-item"
        :style="{ '--i': Math.min(index, 6) }"
      >
        <ParallaxCard
          :image="`${BASE}/${it.file}`"
          :default-height="baseHeightFor(it)"
          :number="index + 1"
          :title="it.title"
          :date="it.date"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.sl-pg {
  /* 展示中心把组件挂进 position:fixed / overflow:hidden 的容器(见 DetailPage),
     窗口本身不会滚动 —— 组件根必须自己做滚动层。
     用视口高(100dvh,回退 100vh)而不是 height:100%:ShadowRoot 宿主元素是
     height:auto,百分比链会断,只有视口单位能稳定撑满。 */
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 3rem 1.5rem;
  box-sizing: border-box;
  background: #0b0b0f;
  color: #fff;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}

.sl-pg-head {
  text-align: center;
  max-width: calc(100vw - 3rem);
  margin: 0 auto 2.5rem;
}

.sl-pg-head h2 {
  margin: 0 0 0.6rem;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sl-pg-head p {
  margin: 0 0 1.2rem;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
}

/* grid ↔ 瀑布流 切换按钮 */
.sl-pg-toggle {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.3rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.sl-pg-toggle__btn {
  padding: 0.45rem 1rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
}

.sl-pg-toggle__btn.active {
  background: #fff;
  color: #111;
}

.sl-pg-error {
  text-align: center;
  color: #ff8a80;
  padding: 2rem;
}

/* 容器 */
.sl-pg-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* 瀑布流:column-count(>=5 项) */
.sl-pg-container.is-waterfall {
  column-count: 3;
  column-gap: 2rem;
}
.sl-pg-container.is-waterfall.is-safari-masonry {
  column-count: unset !important;
  -webkit-column-count: unset !important;
  display: block;
}

/* grid:<5 项 */
.sl-pg-container.is-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
}
.sl-pg-container.is-grid .sl-pg-item {
  flex: 0 0 360px;
  max-width: 360px;
}

/* 单张卡片外层 */
.sl-pg-item {
  width: 100%;
  break-inside: avoid;
  margin-bottom: 2rem;
  cursor: pointer;
  /* 错落入场初始态 */
  opacity: 0;
  transform: translateY(1rem);
  filter: blur(6px);
  transition:
    opacity 0.4s ease,
    transform 0.4s ease,
    filter 0.4s ease;
  /* 等价 v-motion :delay="Math.min(index * 70, 420)" */
  transition-delay: calc(min(var(--i), 6) * 70ms);
}
.sl-pg-item.is-visible {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}
.sl-pg-item:hover {
  transform: translateY(-5px);
}

/* 响应式列数 */
@media (max-width: 1200px) {
  .sl-pg-container.is-waterfall {
    column-count: 2;
    column-gap: 1.5rem;
  }
}
@media (max-width: 1024px) {
  .sl-pg-container.is-waterfall {
    column-count: 2;
    column-gap: 1rem;
  }
}
@media (max-width: 768px) {
  .sl-pg-container.is-waterfall {
    column-count: 1;
    column-gap: 1.5rem;
  }
  .sl-pg-container.is-grid .sl-pg-item {
    flex-basis: 100%;
    max-width: 100%;
  }
}
</style>
