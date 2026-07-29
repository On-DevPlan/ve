<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

interface Tab {
  icon: string;
  label: string;
}

const TABS: readonly Tab[] = [
  { icon: 'ti-layout-list', label: '列表' },
  { icon: 'ti-steering-wheel', label: '驾驶' },
  { icon: 'ti-package', label: '包裹' },
] as const;

const active = ref(0);

const navRef = ref<HTMLElement | null>(null);
const capsuleRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<Array<HTMLDivElement | null>>([]);

function setItemRef(el: Element | null, i: number) {
  itemRefs.value[i] = el as HTMLDivElement | null;
}

function capsuleLeft(i: number): number {
  const nav = navRef.value;
  const item = itemRefs.value[i];
  const capsule = capsuleRef.value;
  if (!nav || !item || !capsule) return 0;
  const navRect = nav.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const center = rect.left - navRect.left + rect.width / 2;
  return center - capsule.offsetWidth / 2;
}

function moveCapsule(i: number) {
  const capsule = capsuleRef.value;
  if (!capsule) return;
  capsule.style.left = `${capsuleLeft(i)}px`;
}

async function go(i: number) {
  if (i === active.value) return;
  active.value = i;
  await nextTick();
  moveCapsule(i);
}

function onResize() {
  moveCapsule(active.value);
}

onMounted(async () => {
  await nextTick();
  setTimeout(() => moveCapsule(active.value), 50);
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="sl-bnc-phone">
    <nav
      ref="navRef"
      class="sl-bnc-nav"
      role="navigation"
      aria-label="iOS 胶囊底部导航"
    >
      <div
        ref="capsuleRef"
        class="sl-bnc-capsule"
        aria-hidden="true"
      />
      <div
        v-for="(tab, i) in TABS"
        :key="tab.label"
        :ref="(el) => setItemRef(el as Element | null, i)"
        :class="['sl-bnc-item', { 'is-active': active === i }]"
        role="button"
        tabindex="0"
        :aria-label="tab.label"
        :aria-current="active === i ? 'page' : undefined"
        @click="go(i)"
        @keydown.enter.prevent="go(i)"
        @keydown.space.prevent="go(i)"
      >
        <i
          :class="['ti', tab.icon]"
          aria-hidden="true"
        />
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* Tabler Icons 字体 —— ShadowRoot 内 @import 会被 Vite 打包,style-adoption
   会把生成的 <style> 节点克隆进 ShadowRoot,保证 icon 字符正常渲染 */
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css');

.sl-bnc-phone {
  width: 360px;
  margin: 24px auto;
  background: #f2f2f7;
  border-radius: 40px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.13);
  padding: 20px 0 28px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.sl-bnc-nav {
  width: 300px;
  height: 58px;
  background: #fff;
  border-radius: 29px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 4px;
  position: relative;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.sl-bnc-capsule {
  position: absolute;
  height: 50px;
  width: 90px;
  background: #e5e5ea;
  border-radius: 25px;
  top: 50%;
  transform: translateY(-50%);
  transition: left 0.45s cubic-bezier(0.34, 1.5, 0.64, 1);
  z-index: 0;
  pointer-events: none;
}

.sl-bnc-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.sl-bnc-item i {
  font-size: 22px;
  color: #8e8e93;
  transition: color 0.2s;
  line-height: 1;
  display: block;
}

.sl-bnc-item.is-active i {
  color: #1c1c1e;
}
</style>