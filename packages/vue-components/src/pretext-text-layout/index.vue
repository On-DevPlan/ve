<script setup lang="ts">
// pretext-text-layout 顶层入口:只做组合 —— 头部 + 标签切换 + 字体状态。
// 两个面板(FlowPanel / MeasurePanel)各自封装 pretext 的一个用例。
import { ref } from 'vue';
import FlowPanel from './src/FlowPanel.vue';
import MeasurePanel from './src/MeasurePanel.vue';
import { usePretextFont } from './src/usePretext';

type Tab = 'flow' | 'measure';

const { status } = usePretextFont();
const tab = ref<Tab>('flow');

const tabs: { id: Tab; label: string; desc: string }[] = [
  { id: 'flow', label: '文字绕流', desc: '文字绕可拖拽图形逐行流动(layoutNextLineRange)' },
  { id: 'measure', label: '无 DOM 测量', desc: '不触发重排测高度 + 精度对照 + 性能基准' },
];
</script>

<template>
  <div class="sl-pretext">
    <header class="sl-pretext__header">
      <div class="sl-pretext__heading">
        <h2 class="sl-pretext__title">
          Pretext 文本布局实验室
        </h2>
        <p class="sl-pretext__sub">
          纯 JS 文本测量与排版引擎 · 不碰 DOM 重排 · 支持 CJK / RTL / Emoji
        </p>
      </div>
      <a
        class="sl-pretext__link"
        href="https://github.com/chenglou/pretext"
        target="_blank"
        rel="noopener noreferrer"
      >@chenglou/pretext ↗</a>
    </header>

    <nav
      class="sl-pretext__tabs"
      role="tablist"
    >
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="['sl-pretext__tab', { 'sl-pretext__tab--active': tab === t.id }]"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="sl-pretext__body">
      <FlowPanel v-if="tab === 'flow'" />
      <MeasurePanel v-else />
    </div>

    <footer class="sl-pretext__foot">
      <span
        class="sl-pretext__font"
        :class="{ 'sl-pretext__font--ready': status.primary }"
      >
        ● {{
          status.primary
            ? 'Inter 已加载'
            : status.ready
              ? '使用兜底字体 system-ui'
              : '字体加载中…'
        }}
      </span>
      <span class="sl-pretext__caption">
        {{ tabs.find((t) => t.id === tab)?.desc }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.sl-pretext {
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-3);
  height: 100%;
  min-height: 520px;
  padding: var(--sl-space-4);
  box-sizing: border-box;
  overflow: auto;
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
}

.sl-pretext__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sl-space-3);
}

.sl-pretext__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--sl-color-text);
}

.sl-pretext__sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--sl-color-text-muted);
}

.sl-pretext__link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--sl-color-primary);
  text-decoration: none;
  white-space: nowrap;
}

.sl-pretext__link:hover {
  text-decoration: underline;
}

.sl-pretext__tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--sl-color-surface-alt);
  border: 1px solid var(--sl-color-border);
  border-radius: var(--sl-radius-md);
  align-self: flex-start;
}

.sl-pretext__tab {
  padding: 6px var(--sl-space-3);
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sl-color-text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.sl-pretext__tab--active {
  background: var(--sl-color-surface);
  color: var(--sl-color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.sl-pretext__body {
  flex: 1;
  min-height: 0;
}

.sl-pretext__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sl-space-2);
  padding-top: var(--sl-space-2);
  border-top: 1px solid var(--sl-color-border);
  font-size: 12px;
  color: var(--sl-color-text-muted);
}

.sl-pretext__font {
  color: var(--sl-color-text-muted);
}

.sl-pretext__font--ready {
  color: #16a34a;
}

.sl-pretext__caption {
  text-align: right;
}
</style>
