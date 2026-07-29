<script setup lang="ts">
// App.vue —— 整个 showcase 的根组件,只放 RouterView 与全局样式。
//
// 职责:
//   1) 提供 RouterView 让 vue-router 决定渲染 HomePage / DetailPage / NotFoundPage
//   2) 注入全局基础样式(字体 / 文本色 / 背景)与 box-sizing reset
//   3) 不在这里做业务初始化 —— 全部交给 main.ts 的 bootstrap()
//
// 为什么 body / * 选择器写在非 scoped 的 <style> 里:
//   - 这套样式是"全站基础",放在 scoped 里反而被 data-v-xxx 限定、失效
//   - App.vue 顶层渲染后,这套 CSS 直接落地到 #app 的子树,无需限定

import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView />
</template>

<style>
:root {
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
  background: var(--sl-color-surface);
}
body { margin: 0; }
* { box-sizing: border-box; }
</style>