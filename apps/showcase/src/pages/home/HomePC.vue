<script setup lang="ts">
// HomePC.vue —— 桌面端首页布局(原始 sidebar + CardGrid 虚拟滚动)。
//
// 职责:
//   1) 左 sidebar:品牌 + 搜索 + 分组/框架筛选 + 平台切换
//   2) 主区:衬线标题 + 卡片网格(走 CardGrid 虚拟滚动)
//   3) 卡片"open"事件映射到 router.push

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import CardGrid from '../../components/CardGrid.vue';
import SearchBar from '../../components/SearchBar.vue';
import { useRegistry } from '../../composables/useRegistry';
import { useSearch } from '../../composables/useSearch';
import { usePlatform } from '../../composables/usePlatform';

const router = useRouter();
const registry = useRegistry();
const { group } = useSearch();
const { platform } = usePlatform();

const groups = computed(() => {
  const set = new Set<string>();
  for (const e of registry.entries.value) set.add(e.group);
  return [...set];
});
const groupCounts = computed(() => {
  const m = new Map<string, number>();
  for (const e of registry.entries.value) m.set(e.group, (m.get(e.group) ?? 0) + 1);
  return m;
});
const vueCount = computed(() => registry.entries.value.filter(e => e.framework === 'vue').length);
const reactCount = computed(() => registry.entries.value.filter(e => e.framework === 'react').length);
const totalCount = computed(() => registry.entries.value.length);
const filteredCount = computed(() => group.value ? (groupCounts.value.get(group.value) ?? 0) : totalCount.value);

function open(id: string) {
  const entry = registry.get(id);
  if (entry) router.push(entry.route.path);
}
function selectGroup(g: string | undefined) {
  group.value = g;
}
function togglePlatform(p: 'pc' | 'mobile') {
  platform.value = p;
}
</script>

<template>
  <div class="home-pc">
    <aside class="sidebar">
      <div class="brand">
        wb / showcase
        <small>Style Library — 2026</small>
      </div>

      <div class="search">
        <SearchBar />
      </div>

      <div class="nav-group">
        <div class="nav-title">
          Groups
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': !group }"
          @click="selectGroup(undefined)"
        >
          <span>All</span><span class="count">{{ totalCount }}</span>
        </div>
        <div
          v-for="g in groups"
          :key="g"
          class="nav-item"
          :class="{ 'is-active': group === g }"
          @click="selectGroup(g)"
        >
          <span>{{ g }}</span><span class="count">{{ groupCounts.get(g) ?? 0 }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div class="nav-title">
          Framework
        </div>
        <div class="nav-item">
          <span>Vue</span><span class="count">{{ vueCount }}</span>
        </div>
        <div class="nav-item">
          <span>React</span><span class="count">{{ reactCount }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div class="nav-title">
          Platform
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': platform === 'pc' }"
          @click="togglePlatform('pc')"
        >
          <span>PC</span>
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': platform === 'mobile' }"
          @click="togglePlatform('mobile')"
        >
          <span>Mobile</span>
        </div>
      </div>

      <div class="sidebar__foot">
        v0.1 · main · <span :class="'platform--' + platform">{{ platform }}</span>
      </div>
    </aside>

    <section class="main">
      <header class="page-head">
        <h1>组件<em>展示</em></h1>
        <div class="crumb">
          Home · {{ group ?? 'All' }} · {{ filteredCount }}
          <span :class="'crumb__platform crumb__platform--' + platform">{{ platform }}</span>
        </div>
      </header>
      <CardGrid @open="open" />
    </section>
  </div>
</template>

<style scoped>
/* === 字体分工 ===
     display : Cormorant Garamond → Songti SC(衬线)
     body    : Inter Tight → PingFang SC(无衬线)
     mono    : JetBrains Mono(等宽) */

.home-pc {
  --paper:       rgba(255, 255, 255, 0.65);
  --ink:         #111;
  --ink-soft:    #555;
  --ink-mute:    #999;
  --line:        #e8e8e8;

  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  background: #ffffff;
  color: var(--ink);
  font-family: "Inter Tight", "PingFang SC", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* === 左侧栏 === */
.sidebar {
  position: sticky; top: 0; align-self: start;
  height: 100vh;
  background: var(--paper);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-right: 1px solid var(--line);
  padding: 40px 28px;
  display: flex; flex-direction: column; gap: 28px;
}
.brand {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 30px; font-weight: 500; letter-spacing: -0.01em;
  border-bottom: 1px solid var(--ink); padding-bottom: 10px;
}
.brand small {
  display: block; font-family: "JetBrains Mono", monospace;
  font-size: 10px; letter-spacing: 0.22em; color: var(--ink-mute); margin-top: 4px;
}
.search { position: relative; padding: 12px 0; border-bottom: 1px solid var(--line); }
.search :deep(.search) {
  width: 100%; padding: 0; border: none; border-radius: 0;
  background: transparent; font-family: inherit; font-size: 14px; outline: none;
}
.search :deep(.search:focus) { outline: none; }

.nav-group { display: flex; flex-direction: column; gap: 4px; }
.nav-title {
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 8px;
}
.nav-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; margin: 0 -10px; font-size: 14px; color: var(--ink-soft);
  cursor: pointer; border-radius: 1px;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.6); color: var(--ink); }
.nav-item.is-active { background: var(--ink); color: #fff; }
.nav-item .count {
  font-family: "JetBrains Mono", monospace; font-size: 10px; color: inherit; opacity: 0.55;
}
.sidebar__foot {
  margin-top: auto; font-family: "JetBrains Mono", monospace;
  font-size: 10px; letter-spacing: 0.2em; color: var(--ink-mute);
}
.sidebar__foot .platform--pc { color: #2563eb; }
.sidebar__foot .platform--mobile { color: #7c3aed; }

/* === 主体 === */
.main { padding: 5px 72px 96px; }
.page-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 40px;
}
.page-head h1 {
  font-family: "Cormorant Garamond", "Songti SC", serif; font-size: 42px; font-weight: 500;
}
.page-head h1 em { font-style: italic; color: var(--ink-soft); }
.page-head .crumb {
  font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.18em;
  color: var(--ink-mute); text-transform: uppercase; display: flex; align-items: center; gap: 8px;
}
.crumb__platform { font-size: 9px; padding: 2px 6px; border-radius: 2px; letter-spacing: 0.12em; }
.crumb__platform--pc { background: #2563eb; color: #fff; }
.crumb__platform--mobile { background: #7c3aed; color: #fff; }

.main :deep(.card-grid__viewport) { min-height: 0; }
.main :deep(.card-grid) {
  padding-top: 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  justify-content: stretch;
}
.main :deep(.card) {
  background: var(--paper);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--line); border-radius: 0;
  padding: 28px; display: flex; flex-direction: column; gap: 18px;
  height: auto; min-height: 280px; cursor: pointer;
  transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
}
.main :deep(.card:hover),
.main :deep(.card:focus) {
  transform: translateY(-2px);
  border-color: var(--ink);
  box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.18);
  outline: none;
}
.main :deep(.card__header) {
  display: flex; justify-content: space-between;
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-mute); margin: 0;
}
.main :deep(.card__title) {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 24px; font-weight: 500; color: var(--ink); margin: 0;
}
.main :deep(.card__framework) {
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--ink-mute); background: transparent; padding: 0; border-radius: 0;
}
.main :deep(.card__desc) {
  font-size: 13px; color: var(--ink-soft); line-height: 1.55; margin: 0;
  flex: 1; min-height: 0;
  display: block; -webkit-line-clamp: unset; line-clamp: unset;
  -webkit-box-orient: unset; overflow: visible;
}
.main :deep(.card__meta) {
  display: flex; justify-content: space-between; padding-top: 14px;
  border-top: 1px dashed var(--line);
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute);
}
.main :deep(.tag) {
  padding: 0; border-radius: 0; background: transparent;
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute);
}
.main :deep(.card__version) {
  color: var(--ink-mute);
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase;
}
.main :deep(.card-grid__empty) {
  padding: 32px; color: var(--ink-mute); text-align: center;
  font-family: "Inter Tight", "PingFang SC", sans-serif;
}
</style>
