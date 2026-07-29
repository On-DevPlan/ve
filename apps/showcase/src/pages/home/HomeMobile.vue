<script setup lang="ts">
// HomeMobile.vue —— 手机端首页布局(M1 风格)。
//
// 职责:
//   1) 顶部品牌 + 搜索 + 分组 pills(横向滚动)
//   2) 每个分组一个 section,横滑卡片
//   3) 底部 Tab 栏
//   4) 卡片点击 → 路由跳转

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { ManifestEntry } from '@style-library/component-contract';
import { useRegistry } from '../../composables/useRegistry';
import { useSearch } from '../../composables/useSearch';

// Lucide 图标
import {
  Search as SearchIcon,
  Layers, ChartBar, Zap, Compass, Gamepad, Map as MapIcon,
  Tag, ArrowRight,
} from '@lucide/vue';
import type { Component } from 'vue';

const router = useRouter();
const registry = useRegistry();
const { group, query, results } = useSearch();

const groups = computed(() => {
  const set = new Set<string>();
  for (const e of results.value) set.add(e.group);
  return [...set];
});
const groupCounts = computed(() => {
  const m = new Map<string, number>();
  for (const e of results.value) m.set(e.group, (m.get(e.group) ?? 0) + 1);
  return m;
});
const totalCount = computed(() => results.value.length);

const sections = computed(() => {
  const map = new Map<string, ManifestEntry[]>();
  for (const entry of results.value) {
    const list = map.get(entry.group);
    if (list) list.push(entry);
    else map.set(entry.group, [entry]);
  }
  return [...map.entries()];
});

function groupIcon(groupName: string): Component {
  const iconMap: Record<string, Component> = {
    '数据可视化': ChartBar,
    '效率': Zap,
    '导航': Compass,
    '游戏娱乐': Gamepad,
    '地图可视化': MapIcon,
  };
  return iconMap[groupName] ?? Layers;
}
function open(id: string) {
  const entry = registry.get(id);
  if (entry) router.push(entry.route.path);
}
function selectGroup(g: string | undefined) {
  group.value = g;
}
function shortDesc(desc: string): string {
  return desc.length > 60 ? desc.slice(0, 60) + '…' : desc;
}
</script>

<template>
  <div class="home-mobile">
    <!-- Header -->
    <header class="header">
      <div class="header__brand">
        wb / showcase
        <small>Style Library — 2026</small>
      </div>
    </header>

    <!-- Search -->
    <div class="search-wrap">
      <div class="search-inner">
        <SearchIcon
          :size="16"
          class="search-icon"
        />
        <input
          v-model="query"
          type="search"
          placeholder="搜索组件名称、关键词..."
        >
      </div>
    </div>

    <!-- Pills -->
    <div class="pills-wrap">
      <div class="pills">
        <button
          class="pill"
          :class="{ active: !group }"
          @click="selectGroup(undefined)"
        >
          <Layers :size="14" />
          <span>全部 <span class="count">{{ totalCount }}</span></span>
        </button>
        <button
          v-for="g in groups"
          :key="g"
          class="pill"
          :class="{ active: group === g }"
          @click="selectGroup(g)"
        >
          <component
            :is="groupIcon(g)"
            :size="14"
          />
          <span>{{ g }} <span class="count">{{ groupCounts.get(g) ?? 0 }}</span></span>
        </button>
      </div>
    </div>

    <!-- Sections -->
    <div v-if="sections.length > 0">
      <div
        v-for="[groupName, entries] in sections"
        :key="groupName"
        class="section"
      >
        <div class="section__header">
          <div class="section__title">
            <component
              :is="groupIcon(groupName)"
              :size="16"
            />
            {{ groupName }}
          </div>
          <span
            class="section__more"
            @click="selectGroup(groupName)"
          >
            All <ArrowRight :size="12" />
          </span>
        </div>
        <div class="scroll-x">
          <article
            v-for="entry in entries"
            :key="entry.id"
            class="card-h"
            tabindex="0"
            role="button"
            @click="open(entry.id)"
            @keydown.enter="open(entry.id)"
          >
            <span class="card-h__framework">{{ entry.framework }}</span>
            <div class="card-h__title">
              <component
                :is="groupIcon(entry.group)"
                :size="16"
              />
              {{ entry.title }}
            </div>
            <p class="card-h__desc">
              {{ shortDesc(entry.description) }}
            </p>
            <div class="card-h__meta">
              <span class="card-h__tag"><Tag :size="10" /> {{ entry.category }}</span>
              <span class="card-h__version">v{{ entry.version }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="empty-state"
    >
      <SearchIcon
        :size="24"
        class="empty-icon"
      />
      <p>没有匹配的组件。</p>
      <button
        class="empty-btn"
        @click="query = ''; group = undefined"
      >
        清除筛选条件
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-mobile {
  --bg:       #f8f8fa;
  --ink:      #111;
  --ink-soft: #555;
  --ink-mute: #999;
  --line:     #e8e8e8;

  background: var(--bg);
  color: var(--ink);
  font-family: "Inter Tight", "PingFang SC", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* ===== Header ===== */
.header {
  padding: 12px 20px 4px;
  background: var(--bg);
}
.header__brand {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.header__brand small {
  display: block;
  font-size: 9px;
  font-family: "JetBrains Mono", monospace;
  letter-spacing: 0.2em;
  color: var(--ink-mute);
  margin-top: -2px;
}

/* ===== Search ===== */
.search-wrap { padding: 0 20px 8px; }
.search-inner {
  display: flex; align-items: center; gap: 8px;
  background: #eee; border-radius: 12px; padding: 10px 14px;
}
.search-icon { color: var(--ink-mute); flex-shrink: 0; }
.search-inner input {
  flex: 1; border: none; background: transparent; font-size: 14px;
  color: var(--ink); outline: none; font-family: inherit;
}
.search-inner input::placeholder { color: var(--ink-mute); }

/* ===== Pills ===== */
.pills-wrap { padding: 0 20px; margin-bottom: 4px; overflow: hidden; }
.pills {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.pills::-webkit-scrollbar { display: none; }
.pill {
  flex-shrink: 0; display: flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 20px; border: 1px solid #ddd;
  background: #fff; font-size: 13px; color: var(--ink-soft);
  cursor: pointer; transition: all .2s; white-space: nowrap; font-family: inherit;
}
.pill.active { background: var(--ink); color: #fff; border-color: var(--ink); }
.pill .count { font-size: 10px; opacity: .55; font-family: "JetBrains Mono", monospace; }

/* ===== Section ===== */
.section { padding: 12px 20px 4px; }
.section:first-of-type { padding-top: 4px; }
.section__header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.section__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 18px; font-weight: 600; color: var(--ink);
  font-family: "Cormorant Garamond", "Songti SC", serif;
}
.section__more {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--ink-mute);
  font-family: "JetBrains Mono", monospace; letter-spacing: 0.1em; cursor: pointer;
}

/* ===== Horizontal Scroll Cards ===== */
.scroll-x {
  display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
  margin: 0 -20px; padding-left: 20px; padding-right: 20px;
}
.scroll-x::-webkit-scrollbar { display: none; }

.card-h {
  flex-shrink: 0; width: 200px; background: #fff; border-radius: 16px;
  border: 1px solid var(--line); padding: 18px; cursor: pointer;
  display: flex; flex-direction: column; gap: 8px;
  transition: transform .2s, box-shadow .2s;
}
.card-h:active { transform: scale(.97); }
.card-h:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.card-h__framework {
  font-size: 9px; font-family: "JetBrains Mono", monospace;
  letter-spacing: 0.15em; color: #aaa; text-transform: uppercase;
}
.card-h__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.3;
}
.card-h__desc {
  font-size: 12px; color: var(--ink-soft); line-height: 1.5; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.card-h__meta {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 10px; border-top: 1px dashed var(--line);
}
.card-h__tag {
  display: flex; align-items: center; gap: 4px;
  font-size: 9px; font-family: "JetBrains Mono", monospace;
  letter-spacing: 0.12em; color: #aaa; text-transform: uppercase;
}
.card-h__version { font-size: 9px; color: #ccc; font-family: "JetBrains Mono", monospace; }

/* ===== Empty State ===== */
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 60px 20px; color: var(--ink-mute); text-align: center;
}
.empty-icon { color: #ccc; }
.empty-state p { font-size: 14px; }
.empty-btn {
  padding: 8px 20px; border: 1px solid var(--line); border-radius: 20px;
  background: #fff; font-size: 12px; color: var(--ink-soft);
  cursor: pointer; font-family: inherit;
}
</style>
