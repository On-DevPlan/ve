<script setup lang="ts">
// HomePage.vue —— 平台自适应入口(中间件)。
//
// 检测当前平台后异步加载对应布局组件:
//   - PC     → ./home/HomePC.vue    原始桌面布局(sidebar + CardGrid)
//   - Mobile → ./home/HomeMobile.vue  M1 手机布局(header + pills + 横滑卡片 + 底栏)
//
// 子组件各自用 composable 取 registry / search / platform,本文件不持有页面逻辑。

import { computed, defineAsyncComponent, markRaw } from 'vue';
import { usePlatform } from '../composables/usePlatform';

const { platform } = usePlatform();

const pageComponent = computed(() =>
  platform.value === 'pc'
    ? markRaw(defineAsyncComponent(() => import('./home/HomePC.vue')))
    : markRaw(defineAsyncComponent(() => import('./home/HomeMobile.vue'))),
);
</script>

<template>
  <component :is="pageComponent" />
</template>

<style>
/* 全局性 root 级样式(HomePC / HomeMobile 各自的 scoped 样式各管各的) */
</style>
