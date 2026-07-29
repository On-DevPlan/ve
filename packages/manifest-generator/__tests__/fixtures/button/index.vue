<template>
  <div class="button">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Vue fixture for the existing scanner / generator / vite-plugin tests.
// 现在 manifest-generator 在 vite-plugin 里跑 loader-inventory 对账,
// 这个文件是 button 组件的入口,缺失会被对账报错。
</script>