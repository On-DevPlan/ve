<script setup>
// 组件路由已在 main.js 的 app.mount() 前通过 setupComponentRoutes() 完成初始化
// 此处无需重复调用
</script>

<template>
  <router-view />
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
}

/* 全局过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active {
  transition: all 0.3s ease-out;
}

.slide-leave-active {
  transition: all 0.3s ease-in;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(-100%);
}
</style>
