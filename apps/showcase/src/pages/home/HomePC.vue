<script setup lang="ts">
// HomePC.vue —— 桌面端首页 shell(平台分流 PC 端)。
//
// 只负责两件事:
//   1) 根据 (登录态, store.mode) 决定渲染哪个模式组件
//   2) 用 <Transition> + <KeepAlive> 让切换有动画 + 缓存状态
//
// 文件结构:
//   HomePage.vue   → 平台分流(PC → HomePC, Mobile → HomeMobile)
//   HomePC.vue     → 模式 shell(本文件,纯切换逻辑)
//   ClassicMode.vue → 杂志式模式(sidebar + CardGrid + Mode 行)
//   PinMode.vue    → 桌面式模式(已收藏的 tile + folder + 主题切换)
//
// 登录/登出边界:
//   - 登出时若 store.mode === 'pin',shell 强制 classic(无 pin 可看)
//   - store.mode 本身保留 → 重新登录后自动回到 pin 视图

import { computed } from 'vue';
import ClassicMode from './ClassicMode.vue';
import PinMode from './PinMode.vue';
import { useDesktopStore, type DisplayMode } from '../../composables/useDesktopStore';
import { jwtAuth } from '@/api/http/auth-store';

const store = useDesktopStore();
const jwtState = computed(() => jwtAuth.state);

const currentMode = computed<DisplayMode>(() =>
  jwtState.value.token ? store.mode.value : 'classic',
);
</script>

<template>
  <Transition
    name="mode-fade"
    mode="out-in"
  >
    <KeepAlive>
      <component
        :is="currentMode === 'pin' ? PinMode : ClassicMode"
        :key="currentMode"
      />
    </KeepAlive>
  </Transition>
</template>

<!--
  过渡样式必须用 <style>(非 scoped),否则不进 <head>,Vue Transition 失效。
-->
<style>
.mode-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.mode-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.mode-fade-enter-active,
.mode-fade-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.2, 1.2, 0.4, 1);
}
</style>