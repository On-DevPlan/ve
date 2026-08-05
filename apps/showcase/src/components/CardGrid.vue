<script setup lang="ts">
// CardGrid.vue —— 组件卡片网格(虚拟滚动版)。
//
// 职责:
//   1) 从 SearchIndex 拿当前过滤结果(自动响应 query + group 变化)
//   2) 只渲染视口内可见的 ComponentCard —— 支持上千组件不卡顿
//   3) 把卡片"open"事件向上冒泡给父级(HomePage 决定跳转)
//
// 虚拟滚动策略(见 virtual-grid.ts 纯计算):
//   - 外层 viewport 固定高度 + overflow:auto,内层 spacer 撑到 totalHeight 造出滚动条
//   - 真正渲染的只有可见切片,用 translateY(offsetY) 贴合真实滚动位置
//   - ResizeObserver 量容器宽/高(宽定列数、高定可见行数)
//   - scroll 用 rAF 节流,避免每个滚动事件都触发重算/重渲染
//
// 设计要点:
//   - 这里不直接调用 router.push —— 让父级决定导航策略,组件保持纯展示
//   - 卡片尺寸常量来自 virtual-grid.ts,与 ComponentCard 的固定高度同源
//   - 空结果时显示提示,不渲染滚动容器

import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useSearch } from '../composables/useSearch';
import ComponentCard from './ComponentCard.vue';
import {
  computeVirtualWindow,
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_GAP,
  OVERSCAN_ROWS,
} from './virtual-grid';

const emit = defineEmits<{ open: [id: string] }>();
// 解构出顶层 computed —— results 是当前过滤后的全部条目
const { results } = useSearch();

// viewport DOM 引用 —— 用于测量与读取 scrollTop
const viewport = ref<HTMLElement | null>(null);

// 响应式测量值:容器宽/高与滚动位置。三者任一变化都会重算窗口。
const containerWidth = ref(0);
const viewportHeight = ref(0);
const scrollTop = ref(0);

// 虚拟窗口:纯函数算出「渲染哪一段 + 偏移 + 总高 + 列数」
const vwin = computed(() =>
  computeVirtualWindow({
    total: results.value.length,
    scrollTop: scrollTop.value,
    containerWidth: containerWidth.value,
    viewportHeight: viewportHeight.value,
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    gap: CARD_GAP,
    overscan: OVERSCAN_ROWS,
  }),
);

// 可见切片 —— 只把这一段交给 v-for,DOM 节点数恒定在几十个
const visible = computed(() =>
  results.value.slice(vwin.value.startIndex, vwin.value.endIndex),
);

// 网格模板列 —— 用算出的列数决定网格道数,每列用 minmax(0,1fr) 让卡片
// 随容器宽度连续拉伸/收缩(不是固定 280px)。列数 N 仍由 CardGrid 的
// ResizeObserver 测宽后算,虚拟切片按 N + 固定行高 150 算,行为不变。
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${vwin.value.columns}, minmax(0, 1fr))`,
  gap: `${CARD_GAP}px`,
  transform: `translateY(${vwin.value.offsetY}px)`,
}));

// rAF 节流:一帧内多次 scroll 只处理最后一次
const rafId = shallowRef<number | null>(null);
function onScroll() {
  if (rafId.value !== null) return;
  rafId.value = requestAnimationFrame(() => {
    rafId.value = null;
    if (viewport.value) scrollTop.value = viewport.value.scrollTop;
  });
}

// ResizeObserver:容器尺寸变化(窗口缩放、字体、侧栏展开)时更新宽高
let ro: ResizeObserver | null = null;
onMounted(() => {
  const el = viewport.value;
  if (!el) return;
  const measure = () => {
    containerWidth.value = el.clientWidth;
    viewportHeight.value = el.clientHeight;
  };
  measure();
  ro = new ResizeObserver(measure);
  ro.observe(el);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
  if (rafId.value !== null) {
    cancelAnimationFrame(rafId.value);
    rafId.value = null;
  }
});
</script>

<template>
  <div
    v-if="results.length > 0"
    ref="viewport"
    class="card-grid__viewport"
    @scroll="onScroll"
  >
    <!-- spacer:撑到总高,造出正确长度的滚动条 -->
    <div
      class="card-grid__spacer"
      :style="{ height: `${vwin.totalHeight}px` }"
    >
      <!-- 只渲染可见切片,整体下移 offsetY 贴合滚动位置 -->
      <div
        class="card-grid"
        :style="gridStyle"
      >
        <ComponentCard
          v-for="entry in visible"
          :key="entry.id"
          :entry="entry"
          @open="(id) => emit('open', id)"
        />
      </div>
    </div>
  </div>
  <p
    v-else
    class="card-grid__empty"
  >
    没有匹配的组件。
  </p>
</template>

<style scoped>
.card-grid__viewport {
  /* 固定高度的滚动容器 —— 虚拟化的舞台;高度按视口自适应,减去顶部头区的经验值 */
  height: calc(100vh - 220px);
  min-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
}
.card-grid__spacer {
  position: relative;
  width: 100%;
}
.card-grid {
  display: grid;
  /* grid-template-columns / gap / transform 由 gridStyle 内联注入 */
  justify-content: start;
}
.card-grid__empty {
  padding: 32px;
  color: var(--sl-color-text-muted);
  text-align: center;
}
</style>
