<script setup lang="ts">
// App.vue —— 整个 showcase 的根组件,只放 RouterView 与全局样式。
//
// 职责:
//   1) 提供 RouterView 让 vue-router 决定渲染 HomePage / DetailPage / LoginPage / NotFoundPage
//   2) 注入全局基础样式(字体 / 文本色 / 背景)与 box-sizing reset
//   3) 路由级 page-fade transition:200ms ease-out opacity,mode="out-in"
//      避免新旧页 DOM 重叠;appear 让首屏也有淡入
//   4) 不在这里做业务初始化 —— 全部交给 main.ts 的 bootstrap()
//
// 为什么 body / * 选择器写在非 scoped 的 <style> 里:
//   - 这套样式是"全站基础",放在 scoped 里反而被 data-v-xxx 限定、失效
//   - App.vue 顶层渲染后,这套 CSS 直接落地到 #app 的子树,无需限定
//   - transition 的 enter/leave 状态类由 Vue 渲染到 DOM 上,作用域必须非 scoped

import { RouterView } from 'vue-router';
</script>

<template>
  <div class="app-root">
    <RouterView v-slot="{ Component, route }">
      <transition
        name="page-fade"
        mode="out-in"
        appear
      >
        <component
          :is="Component"
          :key="route.fullPath"
        />
      </transition>
    </RouterView>
  </div>
</template>

<style>
:root {
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
  background: var(--sl-color-surface);
}
body { margin: 0; }
* { box-sizing: border-box; }

/* page-fade —— 路由级淡入淡出。组件级骨架 fade 仍由 LoadingSkeleton 自己处理,
   这里只负责路由之间的页面切换。 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 200ms ease-out;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
