<script setup lang="ts">
// SearchBar.vue —— 搜索输入框。
//
// 职责:
//   1) 双向绑定到 SearchIndex.query
//   2) 通过 v-model 让用户输入即时反映到搜索结果
//
// 设计要点:
//   - v-model 写在 input 上,Vue 3 编译器自动展开为 :value + @input
//   - 没有任何 props/emit —— 状态来自全局 SearchIndex,本组件是纯受控展示

import { useSearch } from '../composables/useSearch';

// 解构出顶层 ref —— Vue 3 模板编译器会自动 unwrap setup() 返回的 ref。
// 这样 v-model="query" 就能拿到 string 值,而不是 ref 对象。
const { query } = useSearch();
</script>

<template>
  <input
    v-model="query"
    type="search"
    class="search"
    placeholder="搜索组件..."
  >
</template>

<style scoped>
.search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--sl-color-border);
  border-radius: 6px;
  font-size: 14px;
}
.search:focus {
  outline: 2px solid var(--sl-color-primary);
  outline-offset: 1px;
}
</style>