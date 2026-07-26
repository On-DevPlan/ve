<script setup lang="ts">
// ComponentCard.vue —— 单个组件的元数据卡片(纯展示,不触发任何 loader)。
//
// 职责:
//   1) 渲染 ManifestEntry 中的展示字段:title / framework / description / group / version
//   2) 点击或回车触发"open"事件,由父级决定跳详情页
//   3) 不调用组件加载 —— 这是 first-paint 不加载组件实现的 contract(spec §6.3)
//
// 设计要点:
//   - role="button" + tabindex="0" + keydown.enter —— 让屏幕阅读器与键盘用户能操作
//   - tagClass 把中文/空格/其他字符规范成 CSS class,避免动态 class 名里的特殊字符问题

import type { ManifestEntry } from '@style-library/component-contract';

defineProps<{ entry: ManifestEntry }>();
const emit = defineEmits<{ open: [id: string] }>();

function tagClass(group: string) {
  // 把 group 名标准化为 kebab-case;汉字保留原样(浏览器对汉字 class 选择器友好)
  return `tag tag--${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}
</script>

<template>
  <article
    class="card"
    tabindex="0"
    role="button"
    @click="emit('open', entry.id)"
    @keydown.enter="emit('open', entry.id)"
  >
    <header class="card__header">
      <h3 class="card__title">
        {{ entry.title }}
      </h3>
      <span class="card__framework">{{ entry.framework }}</span>
    </header>
    <p class="card__desc">
      {{ entry.description }}
    </p>
    <div class="card__meta">
      <span :class="tagClass(entry.group)">{{ entry.group }}</span>
      <span class="card__version">v{{ entry.version }}</span>
    </div>
  </article>
</template>

<style scoped>
.card {
  /* 固定高度 —— 虚拟滚动的前提:行距可预测。数值与 virtual-grid.ts 的
     CARD_HEIGHT(150)保持一致;box-sizing:border-box 让 padding 计入这 150。 */
  height: 150px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--sl-color-surface);
  border: 1px solid var(--sl-color-border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover, .card:focus {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  outline: none;
}
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card__title {
  font-size: 16px;
  margin: 0;
  /* 单行截断,避免长标题换行挤压固定高度内的描述区;
     min-width:0 让 flex 子项可收缩,否则 ellipsis 不生效 */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__framework {
  font-size: 12px;
  color: var(--sl-color-text-muted);
  padding: 2px 6px;
  background: var(--sl-color-surface-alt);
  border-radius: 4px;
}
.card__desc {
  /* 描述占据剩余空间并截断到 3 行 —— 防止长文撑破固定卡高 */
  flex: 1;
  min-height: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  color: var(--sl-color-text);
  margin: 0 0 12px;
  line-height: 1.5;
}
.card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--sl-color-surface-alt);
}
.card__version { color: var(--sl-color-text-muted); }
</style>