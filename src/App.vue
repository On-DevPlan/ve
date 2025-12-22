<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { setupComponentRoutes } from './router'

const route = useRoute()

// 初始化组件路由
onMounted(async () => {
  await setupComponentRoutes()
})
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
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
