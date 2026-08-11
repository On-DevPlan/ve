<script setup lang="ts">
// ComponentCard.vue —— 单个组件的元数据卡片(纯展示,不触发任何 loader)。
//
// 职责:
//   1) 渲染 ManifestEntry 中的展示字段:title / framework / description / group
//   2) 点击或回车触发"open"事件,由父级决定跳详情页
//   3) 不调用组件加载 —— 这是 first-paint 不加载组件实现的 contract(spec §6.3)
//   4) 可选 ★ 按钮(showPin):在 .card__meta 右贴,触发 "toggle-pin" 事件
//      —— 不显示 v{{version}},版本号移除,腾出位置给收藏按钮
//
// 设计要点:
//   - role="button" + tabindex="0" + keydown.enter —— 让屏幕阅读器与键盘用户能操作
//   - tagClass 把中文/空格/其他字符规范成 CSS class,避免动态 class 名里的特殊字符问题

import type { ManifestEntry } from '@style-library/component-contract';

defineProps<{
  entry: ManifestEntry;
  /** 是否渲染 ★ 按钮(只在 ClassicMode 渲染,PinMode 自己有自己的交互) */
  showPin?: boolean;
  /** 当前 entry 是否已 pin(★ 实心) */
  pinned?: boolean;
}>();
const emit = defineEmits<{
  open: [id: string];
  /** 卡片右下角 ★ 点击;事件冒泡由父级决定 */
  'toggle-pin': [id: string];
}>();

function tagClass(group: string) {
  // 把 group 名标准化为 kebab-case;汉字保留原样(浏览器对汉字 class 选择器友好)
  return `tag tag--${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function onPinClick(e: MouseEvent | KeyboardEvent) {
  // 阻止冒泡:点 ★ 不要顺便打开卡片
  e.stopPropagation();
}
</script>

<template>
  <article
    class="card"
    tabindex="0"
    role="button"
    @click="emit('open', entry.id)"
    @keydown.enter="emit('open', entry.id)"
  >
    <header class="card__header">
      <h3 class="card__title">
        {{ entry.title }}
      </h3>
      <span class="card__framework">{{ entry.framework }}</span>
    </header>
    <p class="card__desc">
      {{ entry.description }}
    </p>
    <div class="card__meta">
      <span :class="tagClass(entry.group)">{{ entry.group }}</span>
      <!-- ★ 收藏按钮(showPin=true 才渲染) —— 替换原 v{{version}} -->
      <button
        v-if="showPin"
        class="card__pin"
        :class="{ 'is-pinned': !!pinned }"
        :title="pinned ? '取消 pin' : 'pin 到桌面'"
        :aria-label="pinned ? '取消 pin' : 'pin 到桌面'"
        @click="(e) => { onPinClick(e); emit('toggle-pin', entry.id); }"
        @keydown.enter="(e) => { onPinClick(e); emit('toggle-pin', entry.id); }"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        >
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  /* 固定高度 —— 虚拟滚动的前提:行距可预测。数值与 virtual-grid.ts 的
     CARD_HEIGHT(150)保持一致;box-sizing:border-box 让 padding 计入这 150。 */
  height: 150px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--sl-color-surface);
  border: 1px solid var(--sl-color-border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover, .card:focus {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  outline: none;
}
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card__title {
  font-size: 16px;
  margin: 0;
  /* 单行截断,避免长标题换行挤压固定高度内的描述区;
     min-width:0 让 flex 子项可收缩,否则 ellipsis 不生效 */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__framework {
  font-size: 12px;
  color: var(--sl-color-text-muted);
  padding: 2px 6px;
  background: var(--sl-color-surface-alt);
  border-radius: 4px;
}
.card__desc {
  /* 描述占据剩余空间并截断到 3 行 —— 防止长文撑破固定卡高 */
  flex: 1;
  min-height: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  color: var(--sl-color-text);
  margin: 0 0 12px;
  line-height: 1.5;
}
.card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--sl-color-surface-alt);
}
/* ★ 按钮:右贴 .card__meta(margin-left:auto 推到末尾),与 tag 分列两端 */
.card__pin {
  margin-left: auto;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--sl-color-text-muted);
  cursor: pointer;
  transition: color .15s, background .15s, border-color .15s, transform .15s;
}
.card__pin:hover {
  color: var(--sl-color-text);
  background: var(--sl-color-surface-alt);
  transform: scale(1.1);
}
.card__pin.is-pinned {
  color: #f59e0b;  /* 已 pin:琥珀色实心 */
  border-color: #f59e0b;
}
</style>