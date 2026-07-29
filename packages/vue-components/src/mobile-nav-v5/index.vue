<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

interface Tab {
  icon: string;
  label: string;
  color: string;
}

const TABS: readonly Tab[] = [
  { icon: 'ti-home', label: '首页', color: '#6c63ff' },
  { icon: 'ti-search', label: '搜索', color: '#f472b6' },
  { icon: 'ti-bell', label: '通知', color: '#fb923c' },
  { icon: 'ti-heart', label: '收藏', color: '#34d399' },
  { icon: 'ti-user', label: '我的', color: '#60a5fa' },
] as const;

const active = ref(0);

const navItemsRef = ref<HTMLDivElement | null>(null);
const indicatorRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<Array<HTMLDivElement | null>>([]);

const activeTab = computed(() => TABS[active.value]);

function setItemRef(el: Element | null, i: number) {
  // Vue 3 函数式 ref:把第 i 个 .nav-item DOM 缓存进数组
  itemRefs.value[i] = el as HTMLDivElement | null;
}

function indicatorLeft(i: number): number {
  const nav = navItemsRef.value;
  const item = itemRefs.value[i];
  if (!nav || !item) return 0;
  const navRect = nav.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const center = rect.left - navRect.left + rect.width / 2;
  return center - 26; // indicator 半径 26
}

function moveIndicator(i: number) {
  const indicator = indicatorRef.value;
  if (!indicator) return;
  indicator.style.left = `${indicatorLeft(i)}px`;
  indicator.style.background = TABS[i].color;
}

async function go(i: number) {
  if (i === active.value) return;
  active.value = i;
  await nextTick();
  moveIndicator(i);
}

function onResize() {
  moveIndicator(active.value);
}

onMounted(async () => {
  await nextTick();
  // 等待首帧布局完成,再定位 indicator
  setTimeout(() => moveIndicator(active.value), 50);
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="sl-mn5-phone">
    <!-- 当前页面区域:展示 active tab 的图标 + 标签,色调同步 -->
    <div class="sl-mn5-page">
      <i
        :class="['ti', activeTab.icon, 'sl-mn5-page-icon']"
        :style="{ color: activeTab.color }"
        aria-hidden="true"
      />
      <span
        class="sl-mn5-page-label"
        :style="{ color: activeTab.color }"
      >{{ activeTab.label }}</span>
    </div>

    <!-- 底部导航条 -->
    <nav
      class="sl-mn5-nav"
      role="navigation"
      aria-label="底部导航"
    >
      <div
        ref="navItemsRef"
        class="sl-mn5-nav-items"
      >
        <div
          ref="indicatorRef"
          class="sl-mn5-indicator"
          aria-hidden="true"
        />
        <div
          v-for="(tab, i) in TABS"
          :key="tab.label"
          :ref="(el) => setItemRef(el as Element | null, i)"
          :class="['sl-mn5-nav-item', { 'is-active': active === i }]"
          role="button"
          tabindex="0"
          :aria-label="tab.label"
          :aria-current="active === i ? 'page' : undefined"
          @click="go(i)"
          @keydown.enter.prevent="go(i)"
          @keydown.space.prevent="go(i)"
        >
          <i
            :class="['ti', tab.icon, 'sl-mn5-nav-icon']"
            aria-hidden="true"
          />
          <span class="sl-mn5-nav-label">{{ tab.label }}</span>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* Tabler Icons 字体 —— ShadowRoot 内 @import 会被 Vite 打包,style-adoption
   会把生成的 <style> 节点克隆进 ShadowRoot,保证 icon 字符正常渲染 */
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css');

.sl-mn5-phone {
  width: 360px;
  height: 520px;
  background: #000;
  border-radius: 32px;
  margin: 20px auto;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.sl-mn5-page {
  position: absolute;
  inset: 0;
  bottom: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}

.sl-mn5-page-icon {
  font-size: 52px;
  transition: color 0.3s;
}

.sl-mn5-page-label {
  font-size: 15px;
  font-weight: 500;
  opacity: 0.6;
  transition: color 0.3s;
}

.sl-mn5-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: #fff;
  border-radius: 0 0 32px 32px;
  overflow: visible;
}

.sl-mn5-nav-items {
  display: flex;
  width: 100%;
  height: 100%;
  justify-content: space-around;
  align-items: center;
  position: relative;
  overflow: visible;
}

.sl-mn5-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  height: 100%;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.sl-mn5-nav-icon {
  position: absolute;
  font-size: 22px;
  color: #bbb;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition:
    color 0.3s,
    top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 10;
  line-height: 1;
}

.sl-mn5-nav-label {
  position: absolute;
  font-size: 11px;
  font-weight: 500;
  color: #333;
  opacity: 0;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: opacity 0.3s ease 0.1s;
  white-space: nowrap;
  line-height: 1;
  pointer-events: none;
}

.sl-mn5-nav-item.is-active .sl-mn5-nav-icon {
  top: 0;
  transform: translate(-50%, -50%);
  color: #fff;
}

.sl-mn5-nav-item.is-active .sl-mn5-nav-label {
  opacity: 1;
}

.sl-mn5-indicator {
  position: absolute;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  top: -26px;
  background: #6c63ff;
  transition:
    left 0.4s cubic-bezier(0.65, 0, 0.35, 1),
    background 0.3s;
  z-index: 5;
  border: 4px solid #111;
  pointer-events: none;
}

/* indicator 两侧的反向圆角,让指示器与 nav 衔接处出现"咬合"缺口 */
.sl-mn5-indicator::before,
.sl-mn5-indicator::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: #fff;
  top: 22px;
}

.sl-mn5-indicator::before {
  right: 100%;
  margin-right: 2.5px;
  border-top-right-radius: 10px;
  box-shadow: 0 -6px 0 0 #000000;
}

.sl-mn5-indicator::after {
  left: 100%;
  margin-left: 2.5px;
  border-top-left-radius: 10px;
  box-shadow: 0 -6px 0 0 #000000;
}
</style>