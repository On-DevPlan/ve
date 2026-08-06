<!--
  host-vue.vue —— Vue 3 SFC,渲染 LoadingSkeleton 到挂载点,
  通过 defineExpose 暴露 appear / fadeOut / destroy 给父。
-->
<template>
  <div
    ref="root"
    :class="className"
    :style="{ opacity: visible ? 1 : 0, transition: 'opacity 600ms ease' }"
    role="status"
    aria-live="polite"
  >
    <div class="sl-skel__spinner" />
    <div class="sl-skel__text">
      加载中…
    </div>
    <div class="sl-skel__bars">
      <div class="sl-skel__bar sl-skel__bar--title" />
      <div class="sl-skel__bar" />
      <div class="sl-skel__bar" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  className?: string;
}>();

const root = ref<HTMLDivElement | null>(null);
const visible = ref(0); // 0 / 1,绑定 opacity
let destroyed = false;

function setOpacity(target: 0 | 1): Promise<void> {
  return new Promise((resolve) => {
    const el = root.value;
    if (!el) return resolve();
    // 强制 reflow,确保 transition 生效(连续 appear/fadeOut 不叠加)
    void el.offsetHeight;
    visible.value = target;
    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    el.addEventListener('transitionend', onEnd);
    // 兜底:transitionend 不触发(浏览器降级/disabled)时,650ms 后强制 resolve
    setTimeout(onEnd, 650);
  });
}

defineExpose({
  appear(): Promise<void> {
    if (destroyed) return Promise.resolve();
    return setOpacity(1);
  },
  fadeOut(onFaded?: () => void): Promise<void> {
    if (destroyed) {
      onFaded?.();
      return Promise.resolve();
    }
    return setOpacity(0).then(() => {
      if (root.value?.parentNode) root.value.parentNode.removeChild(root.value);
      destroyed = true;
      onFaded?.();
    });
  },
  destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (root.value?.parentNode) root.value.parentNode.removeChild(root.value);
  },
});
</script>
