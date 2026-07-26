<script setup lang="ts">
// GroupFilter.vue —— 分组筛选按钮组。
//
// 职责:
//   1) 接 props.groups(由 HomePage 从 registry 计算)
//   2) 点击按钮把 SearchIndex.group 设为对应值(再次点击"全部"清空)
//   3) 当前选中态用 class 标记,样式由 scoped CSS 控制
//
// 设计要点:
//   - 第一个按钮永远是"全部",不带 key,语义更直观
//   - 用 .filter__btn--active class 而不是 v-model,因为 ref 不适合做 v-model 目标

import { useSearch } from '../composables/useSearch';

defineProps<{ groups: string[] }>();
// 解构出顶层 ref —— 模板里 group 自动 unwrap
const { group } = useSearch();

function selectGroup(g: string | undefined) {
  group.value = g;
}
</script>

<template>
  <div class="filter">
    <button
      type="button"
      class="filter__btn"
      :class="{ 'filter__btn--active': !group }"
      @click="selectGroup(undefined)"
    >
      全部
    </button>
    <button
      v-for="g in groups"
      :key="g"
      type="button"
      class="filter__btn"
      :class="{ 'filter__btn--active': group === g }"
      @click="selectGroup(g)"
    >
      {{ g }}
    </button>
  </div>
</template>

<style scoped>
.filter {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.filter__btn {
  padding: 4px 12px;
  border: 1px solid var(--sl-color-border);
  border-radius: 16px;
  background: var(--sl-color-surface);
  cursor: pointer;
  font-size: 13px;
}
.filter__btn--active {
  background: var(--sl-color-primary);
  color: var(--sl-color-on-primary);
  border-color: var(--sl-color-primary);
}
</style>