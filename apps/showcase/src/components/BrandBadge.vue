<!-- BrandBadge.vue —— 品牌图标徽章
     - 默认展示 useBrandIcon().iconUrl
     - hover 露出"切换 / 上传 / 重置"小菜单
     - size: 'sm' | 'md'   'md' = 48px(经典侧栏用),'sm' = 32px(Pin 顶栏用)
     - 内联在组件库外,自己消费 useBrandIcon —— 不写 props,直接单例
     - hidden input 由 ref 触发,不进 template 顶层
-->
<script setup lang="ts">
import { ref } from 'vue';
import { useBrandIcon } from '../composables/useBrandIcon';

defineProps<{
  /** 'sm' = Pin 顶栏(32px);'md' = Classic 侧栏(48px) */
  size?: 'sm' | 'md';
}>();

const brand = useBrandIcon();
const fileInput = ref<HTMLInputElement | null>(null);

/** template 也要引用静态图(预览小图标);与 useBrandIcon.ts 里的 STATIC_FALLBACK 同源 */
const STATIC_FALLBACK = {
  color: '/brand/ve-color.png',
  outline: '/brand/ve-outline.png',
  custom: '/brand/ve-color.png',
};

const pickerOpen = ref(false);
let closeTimer: number | undefined;
function openPicker() {
  clearTimeout(closeTimer);
  pickerOpen.value = true;
}
function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => { pickerOpen.value = false; }, 200);
}

async function pickColor() {
  pickerOpen.value = false;
  await brand.setVariant('color');
}
async function pickOutline() {
  pickerOpen.value = false;
  await brand.setVariant('outline');
}
function pickUpload() {
  pickerOpen.value = false;
  fileInput.value?.click();
}
async function onFileChange(e: Event) {
  const t = e.target as HTMLInputElement;
  const f = t.files?.[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    console.warn('[BrandBadge] not an image:', f.type);
    return;
  }
  await brand.uploadCustom(f, f.name);
  t.value = '';
}
async function pickReset() {
  pickerOpen.value = false;
  await brand.reset();
}
</script>

<template>
  <div
    class="brand-badge"
    :class="['size-' + (size ?? 'md'), { 'is-loading': brand.loading.value }]"
    @mouseenter="openPicker"
    @mouseleave="scheduleClose"
  >
    <img
      :src="brand.iconUrl.value"
      alt="brand"
      class="brand-badge__img"
      draggable="false"
    >
    <Transition name="brand-picker">
      <div
        v-if="pickerOpen"
        class="brand-picker"
        @mouseenter="openPicker"
        @mouseleave="scheduleClose"
      >
        <button
          class="brand-picker__opt"
          :class="{ 'is-active': brand.variant.value === 'color' }"
          title="彩色版(默认)"
          @click="pickColor"
        >
          <img
            :src="STATIC_FALLBACK.color"
            alt="color"
          >
          <span>Color</span>
        </button>
        <button
          class="brand-picker__opt"
          :class="{ 'is-active': brand.variant.value === 'outline' }"
          title="线稿版"
          @click="pickOutline"
        >
          <img
            :src="STATIC_FALLBACK.outline"
            alt="outline"
          >
          <span>Outline</span>
        </button>
        <button
          class="brand-picker__opt"
          :class="{ 'is-active': brand.variant.value === 'custom' }"
          title="上传自定义图片"
          @click="pickUpload"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M12 4v12M6 10l6-6 6 6" />
            <path d="M4 18v2h16v-2" />
          </svg>
          <span>Upload</span>
        </button>
        <button
          v-if="brand.hasCustom.value"
          class="brand-picker__opt brand-picker__opt--danger"
          title="清除自定义,回到默认"
          @click="pickReset"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          <span>Reset</span>
        </button>
      </div>
    </Transition>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      hidden
      @change="onFileChange"
    >
  </div>
</template>

<style scoped>
.brand-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  outline: none;
}
.size-md .brand-badge__img { width: 48px; height: 48px; }
.size-sm .brand-badge__img { width: 32px; height: 32px; }

.brand-badge__img {
  display: block;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--ink);
  transition: opacity .15s, transform .2s var(--spring);
  -webkit-user-drag: none;
}
.brand-badge:hover .brand-badge__img {
  transform: scale(1.05);
}
.brand-badge.is-loading .brand-badge__img {
  opacity: .55;
}

/* === picker === */
.brand-picker {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  min-width: 132px;
  padding: 6px;
  background: #fff;
  border: 1px solid var(--ink);
  border-radius: 4px;
  box-shadow: 0 12px 28px -16px rgba(0,0,0,.22);
  font-family: inherit;
}
.brand-picker__opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--ink);
  font: 12px/1 ui-monospace, 'JetBrains Mono', monospace;
  letter-spacing: .04em;
  cursor: pointer;
  border-radius: 2px;
  text-align: left;
}
.brand-picker__opt:hover {
  background: var(--ink);
  color: #fff;
}
.brand-picker__opt.is-active {
  background: rgba(0,0,0,.06);
}
.brand-picker__opt.is-active:hover {
  background: var(--ink);
}
.brand-picker__opt img {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid currentColor;
}
.brand-picker__opt--danger { color: #b91c1c; }
.brand-picker__opt--danger:hover { background: #b91c1c; color: #fff; }

.brand-picker-enter-active,
.brand-picker-leave-active {
  transition: opacity .14s ease, transform .14s var(--spring);
}
.brand-picker-enter-from,
.brand-picker-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>