<!-- chess-skin-admin/index.vue —— 顶层入口（import.meta.glob 唯一扫描目标）。
     只做组合：tab 状态 + useChessSkinAdmin + 三个子视图。
     业务逻辑在 src/composables/useChessSkinAdmin.ts，视图在 src/views/。
     共享设计系统（token + .csa-* 工具类）在本文件非 scoped <style> 块，
     全部锁在 .sl-csa 根下，子视图 markup 直接消费。 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useChessSkinAdmin } from './src/composables/useChessSkinAdmin';
import PreviewTab from './src/views/PreviewTab.vue';
import ReplaceTab from './src/views/ReplaceTab.vue';
import ImportTab from './src/views/ImportTab.vue';

type TabId = 'preview' | 'replace' | 'import';
const tab = ref<TabId>('preview');
const admin = useChessSkinAdmin();

onMounted(() => {
  if (admin.loginHint.value === null) admin.loadIndex();
});

const TABS: { key: TabId; label: string; adminOnly: boolean }[] = [
  { key: 'preview', label: '预览', adminOnly: false },
  { key: 'replace', label: '单图替换', adminOnly: true },
  { key: 'import', label: '批量导入', adminOnly: true },
];
</script>

<template>
  <div class="sl-csa">
    <header class="csa-head">
      <div class="csa-head__title">
        <h2>国际象棋皮肤管理</h2>
        <span class="csa-sub">chess_skin:index · groupId 190</span>
      </div>
      <div class="csa-head__meta">
        <span
          v-if="admin.loading.value"
          class="csa-badge csa-badge--info"
        >加载中</span>
        <span
          v-else-if="admin.error.value"
          class="csa-badge csa-badge--danger"
        >{{ admin.error.value }}</span>
        <span
          v-else-if="admin.loginHint.value"
          class="csa-badge csa-badge--warn"
        >未登录 · 只读</span>
        <template v-else>
          <span class="csa-badge">{{ admin.myRole.value ?? '未登录' }}</span>
          <span
            v-if="admin.canEdit.value"
            class="csa-badge csa-badge--ok"
          >可编辑</span>
          <span
            v-else
            class="csa-badge csa-badge--mute"
          >只读</span>
        </template>
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          @click="admin.loadIndex"
        >
          刷新
        </button>
      </div>
    </header>

    <div class="csa-frame">
      <nav
        class="csa-tabs"
        role="tablist"
      >
        <button
          v-for="t in TABS"
          :key="t.key"
          role="tab"
          :class="['csa-tabs__item', {
            'is-active': tab === t.key,
            'is-disabled': t.adminOnly && !admin.canEdit.value,
          }]"
          :aria-selected="tab === t.key"
          :disabled="t.adminOnly && !admin.canEdit.value"
          :title="t.adminOnly && !admin.canEdit.value ? '仅 admin 可用' : ''"
          @click="tab = t.key"
        >
          {{ t.label }}<span
            v-if="t.adminOnly && !admin.canEdit.value"
            class="csa-tabs__lock"
          >locked</span>
        </button>
      </nav>

      <main class="csa-main">
        <PreviewTab
          v-show="tab === 'preview'"
          :admin="admin"
        />
        <ReplaceTab
          v-show="tab === 'replace'"
          :admin="admin"
        />
        <ImportTab
          v-show="tab === 'import'"
          :admin="admin"
        />
      </main>
    </div>
  </div>
</template>

<style>
/* ============================================================
   共享设计系统 —— 非 scoped（子视图 .csa-* 类在此定义）。
   全部选择器都在 .sl-csa 之下，不会泄漏到组件外；
   ShadowRoot 隔离下也不会污染 host。
   色板对齐 host tokens.ts（zinc 系 + #2563eb 主色）。
   视觉语言：分段式 pill tabs / 卡片阴影层次 / 状态点 badge /
   棋盘格装饰 / 统一 focus ring + reduced-motion 降级。
   ============================================================ */
.sl-csa {
  /* 色板 */
  --csa-bg: #fafafa;
  --csa-panel: #ffffff;
  --csa-hover: #f4f4f5;
  --csa-border: #e4e4e7;
  --csa-border-strong: #d4d4d8;
  --csa-fg: #18181b;
  --csa-fg-2: #52525b;
  --csa-fg-3: #a1a1aa;
  --csa-primary: #2563eb;
  --csa-primary-hover: #1d4ed8;
  --csa-primary-soft: #eff6ff;
  --csa-danger: #dc2626;
  --csa-danger-soft: #fef2f2;
  --csa-success: #16a34a;
  --csa-success-soft: #f0fdf4;
  --csa-warn: #d97706;
  --csa-warn-soft: #fffbeb;
  /* 形状 / 阴影 / ring */
  --csa-radius: 10px;
  --csa-radius-sm: 8px;
  --csa-ring: 0 0 0 3px rgba(37, 99, 235, 0.14);
  --csa-shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.05);
  --csa-shadow-md: 0 1px 2px rgba(24, 24, 27, 0.04), 0 4px 16px rgba(24, 24, 27, 0.06);
  --csa-shadow-lg: 0 24px 48px -12px rgba(24, 24, 27, 0.28);
  --csa-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;

  /* 滚动层(spec: 详情页宿主 overflow:hidden 不滚动,组件根做滚动;
     ShadowRoot 宿主 height:auto,百分比链断 → 用 100dvh 不用 height:100%) */
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 26px 40px;
  font-family: var(--sl-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 13px;
  line-height: 1.55;
  color: var(--csa-fg);
  /* 页面底色：zinc-50 基底 + 左右顶部各一道极淡品牌色晕染,缓解宽屏两侧空白感 */
  background:
    radial-gradient(900px 480px at 92% 18%, rgba(37, 99, 235, 0.045), transparent 65%),
    radial-gradient(1100px 300px at 16% -10%, rgba(37, 99, 235, 0.05), transparent 60%),
    var(--csa-bg);
}
.sl-csa *,
.sl-csa *::before,
.sl-csa *::after { box-sizing: border-box; }
.sl-csa h2, .sl-csa h3, .sl-csa p, .sl-csa figure { margin: 0; }
.sl-csa button { font: inherit; cursor: pointer; background: none; border: none; padding: 0; color: inherit; }
.sl-csa input, .sl-csa select, .sl-csa textarea { font: inherit; color: inherit; }
.sl-csa ul, .sl-csa ol { margin: 0; padding: 0; list-style: none; }
.sl-csa ::selection { background: #bfdbfe; color: #1e3a8a; }

/* ── header ──────────────────────────────────── */
.sl-csa .csa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  flex-wrap: wrap;
  padding-bottom: 16px;
}
.sl-csa .csa-head__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.sl-csa .csa-head__title h2 {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.sl-csa .csa-sub {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-2);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  box-shadow: var(--csa-shadow-sm);
  white-space: nowrap;
}
.sl-csa .csa-head__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── badge（::before 状态点随 currentColor 变色） ── */
.sl-csa .csa-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2.5px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-family: var(--csa-mono);
  background: var(--csa-panel);
  color: var(--csa-fg-2);
  border: 1px solid var(--csa-border);
  box-shadow: var(--csa-shadow-sm);
  white-space: nowrap;
}
.sl-csa .csa-badge::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.85;
  flex: none;
}
.sl-csa .csa-badge--ok { background: var(--csa-success-soft); color: var(--csa-success); border-color: #bbf7d0; }
.sl-csa .csa-badge--warn { background: var(--csa-warn-soft); color: var(--csa-warn); border-color: #fde68a; }
.sl-csa .csa-badge--danger { background: var(--csa-danger-soft); color: var(--csa-danger); border-color: #fecaca; }
.sl-csa .csa-badge--info { background: var(--csa-primary-soft); color: var(--csa-primary); border-color: #bfdbfe; }
.sl-csa .csa-badge--mute { background: var(--csa-hover); color: var(--csa-fg-3); box-shadow: none; }

/* ── tabs（分段式 pill 控件） ─────────────────── */
.sl-csa .csa-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  width: fit-content;
  max-width: 100%;
  flex-wrap: wrap;
  padding: 3px;
  margin-bottom: 18px;
  background: var(--csa-hover);
  border: 1px solid var(--csa-border);
  border-radius: 11px;
}
.sl-csa .csa-tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--csa-fg-2);
  transition: color 0.15s, background 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-tabs__item:hover:not(.is-disabled):not(.is-active) {
  color: var(--csa-fg);
  background: rgba(255, 255, 255, 0.7);
}
.sl-csa .csa-tabs__item.is-active {
  background: var(--csa-panel);
  color: var(--csa-fg);
  font-weight: 600;
  box-shadow: var(--csa-shadow-sm);
}
.sl-csa .csa-tabs__item:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-tabs__item.is-disabled {
  color: var(--csa-fg-3);
  cursor: not-allowed;
}
.sl-csa .csa-tabs__lock {
  font-family: var(--csa-mono);
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--csa-hover);
  color: var(--csa-fg-3);
  border: 1px solid var(--csa-border-strong);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.sl-csa .csa-tabs__item.is-active .csa-tabs__lock {
  background: var(--csa-hover);
}

/* ── main / help ─────────────────────────────── */
/* 居中容器 —— 限制内容最大宽度并水平居中,缓解宽屏右半侧空白感。
   header 仍 full-bleed(标题左 + meta 右的不对称构图需要全宽)。 */
.sl-csa .csa-frame {
  max-width: clamp(720px, 92vw, 1400px);
  margin-inline: auto;
}
/* .csa-main 由 .csa-frame 控制最大宽度,本身不再限宽 */
.sl-csa .csa-help {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-help code,
.sl-csa .csa-step__desc code {
  font-family: var(--csa-mono);
  font-size: 11px;
  background: var(--csa-hover);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── empty（::before 棋盘格装饰） ─────────────── */
.sl-csa .csa-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 56px 24px;
  text-align: center;
  color: var(--csa-fg-3);
  background: var(--csa-panel);
  border: 1px dashed var(--csa-border-strong);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  font-size: 13px;
}
.sl-csa .csa-empty::before {
  content: "";
  width: 44px;
  height: 44px;
  border-radius: 10px;
  margin-bottom: 6px;
  border: 1px solid var(--csa-border);
  box-shadow: var(--csa-shadow-sm);
  /* 4x4 棋盘格 —— 呼应主题，无 emoji */
  background: conic-gradient(var(--csa-hover) 0 25%, #ffffff 0 50%, var(--csa-hover) 0 75%, #ffffff 0) 0 0 / 11px 11px;
}
.sl-csa .csa-empty em {
  font-style: normal;
  color: var(--csa-fg-2);
  font-weight: 500;
}

/* ── status banner（::before 状态点 + 滑入动画） ── */
.sl-csa .csa-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 9px 13px;
  border-radius: var(--csa-radius-sm);
  font-size: 12px;
  font-family: var(--csa-mono);
  border: 1px solid transparent;
  animation: csa-slide-in 0.18s ease-out;
}
.sl-csa .csa-status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}
.sl-csa .csa-status--ok {
  background: var(--csa-success-soft);
  color: var(--csa-success);
  border-color: #bbf7d0;
}
.sl-csa .csa-status--err {
  background: var(--csa-danger-soft);
  color: var(--csa-danger);
  border-color: #fecaca;
}

/* ── button ──────────────────────────────────── */
.sl-csa .csa-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--csa-radius-sm);
  border: 1px solid var(--csa-border-strong);
  background: var(--csa-panel);
  color: var(--csa-fg);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--csa-shadow-sm);
  transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-btn:hover:not(:disabled) {
  background: var(--csa-hover);
  border-color: var(--csa-fg-3);
}
.sl-csa .csa-btn:active:not(:disabled) {
  box-shadow: none;
  transform: translateY(1px);
}
.sl-csa .csa-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.sl-csa .csa-btn:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-btn--primary {
  background: var(--csa-primary);
  border-color: var(--csa-primary);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
}
.sl-csa .csa-btn--primary:hover:not(:disabled) {
  background: var(--csa-primary-hover);
  border-color: var(--csa-primary-hover);
}
.sl-csa .csa-btn--primary:focus-visible {
  box-shadow: var(--csa-ring), 0 1px 2px rgba(37, 99, 235, 0.3);
}
.sl-csa .csa-btn--danger {
  background: var(--csa-danger);
  border-color: var(--csa-danger);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.3);
}
.sl-csa .csa-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}
.sl-csa .csa-btn--danger:focus-visible {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18), 0 1px 2px rgba(220, 38, 38, 0.3);
}
.sl-csa .csa-btn--ghost {
  border-color: transparent;
  box-shadow: none;
  color: var(--csa-fg-2);
}
.sl-csa .csa-btn--ghost:hover:not(:disabled) {
  background: var(--csa-hover);
  color: var(--csa-fg);
  border-color: transparent;
}
.sl-csa .csa-btn--sm {
  padding: 4px 10px;
  font-size: 12px;
}

/* ── skin card ───────────────────────────────── */
.sl-csa .csa-card {
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-card:hover {
  border-color: var(--csa-border-strong);
  box-shadow: var(--csa-shadow-md);
}
.sl-csa .csa-card__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
}
.sl-csa .csa-card__row.is-clickable { cursor: pointer; }
.sl-csa .csa-card__row.is-clickable:hover { background: #fafafa; }
.sl-csa .csa-card__name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
}
.sl-csa .csa-card__id {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-3);
}
.sl-csa .csa-card__ver {
  margin-left: auto;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-2);
  background: var(--csa-hover);
  border: 1px solid var(--csa-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.sl-csa .csa-caret {
  width: 0; height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--csa-fg-3);
  transition: transform 0.18s;
}
.sl-csa .csa-caret.is-open { transform: rotate(180deg); }

/* 行 card 行内操作（admin/owner 才显示：重命名 / 删除） */
.sl-csa .csa-card__action {
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--csa-mono);
  color: var(--csa-fg-2);
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.sl-csa .csa-card__action:hover {
  background: var(--csa-hover);
  color: var(--csa-fg);
  border-color: var(--csa-border-strong);
}
.sl-csa .csa-card__action--danger:hover {
  background: var(--csa-danger-soft);
  color: var(--csa-danger);
  border-color: #fecaca;
}

/* ── piece grid ──────────────────────────────── */
.sl-csa .csa-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 2px 16px 16px;
}
@media (max-width: 640px) {
  .sl-csa .csa-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 2px 12px 14px; }
}
@media (max-width: 440px) {
  .sl-csa .csa-grid { grid-template-columns: repeat(3, 1fr); }
}
.sl-csa .csa-piece {
  text-align: center;
}
.sl-csa .csa-piece__tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius-sm);
  /* 棋盘格底 —— 透明 webp 棋子在此底上可辨形 */
  background: conic-gradient(#ececee 0 25%, #ffffff 0 50%, #ececee 0 75%, #ffffff 0) 0 0 / 12px 12px;
  box-shadow: inset 0 0 0 1px rgba(24, 24, 27, 0.03);
  overflow: hidden;
}
.sl-csa .csa-piece__tile img {
  width: 74%;
  height: 74%;
  object-fit: contain;
  image-rendering: auto;
}
.sl-csa .csa-piece__key {
  display: block;
  margin-top: 5px;
  font-family: var(--csa-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--csa-fg-2);
}
.sl-csa .csa-piece__fid {
  display: block;
  font-family: var(--csa-mono);
  font-size: 9px;
  color: var(--csa-fg-3);
  word-break: break-all;
  line-height: 1.3;
}
.sl-csa .csa-piece--click .csa-piece__tile {
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.sl-csa .csa-piece--click .csa-piece__tile:hover {
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
  transform: translateY(-1px);
}
.sl-csa .csa-piece--click .csa-piece__hint {
  position: absolute;
  inset: auto 0 0 0;
  padding: 2px 0;
  font-size: 10px;
  background: rgba(37, 99, 235, 0.92);
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s;
}
.sl-csa .csa-piece--click .csa-piece__tile:hover .csa-piece__hint {
  opacity: 1;
  border-radius: 0 0 7px 7px;
}

/* ── upload tile（import tab 用） ─────────────── */
.sl-csa .csa-up {
  cursor: pointer;
  text-align: center;
  position: relative;
}
.sl-csa .csa-up__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px dashed var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: #fafafa;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
  padding: 6px;
  word-break: break-all;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sl-csa .csa-up:hover .csa-up__tile {
  border-color: var(--csa-primary);
  background: var(--csa-primary-soft);
  color: var(--csa-primary);
}
.sl-csa .csa-up.is-set .csa-up__tile {
  border-style: solid;
  border-color: var(--csa-success);
  background: var(--csa-success-soft);
  color: var(--csa-success);
  font-weight: 600;
}
.sl-csa .csa-up input[type="file"] { display: none; }
.sl-csa .csa-up__key {
  display: block;
  margin-top: 5px;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-2);
}

/* ── modal（backdrop blur + 弹入动画） ────────── */
.sl-csa .csa-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: csa-fade-in 0.16s ease-out;
}
.sl-csa .csa-modal__card {
  width: min(420px, 100%);
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 12px;
  box-shadow: var(--csa-shadow-lg);
  padding: 18px 20px;
  animation: csa-pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
.sl-csa .csa-modal__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.sl-csa .csa-modal__title code {
  font-family: var(--csa-mono);
  font-size: 12px;
  color: var(--csa-fg-2);
}
.sl-csa .csa-modal__desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-modal__desc code {
  font-family: var(--csa-mono);
  font-size: 10px;
  background: var(--csa-hover);
  padding: 1px 4px;
  border-radius: 4px;
  word-break: break-all;
}
.sl-csa .csa-modal__file {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: var(--csa-panel);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.sl-csa .csa-modal__file:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-modal__file:focus-visible {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-modal__file::file-selector-button {
  font: inherit;
  font-size: 12px;
  margin-right: 10px;
  padding: 4px 10px;
  border: 1px solid var(--csa-border-strong);
  border-radius: 6px;
  background: var(--csa-hover);
  color: var(--csa-fg-2);
  cursor: pointer;
  transition: background 0.12s;
}
.sl-csa .csa-modal__file::file-selector-button:hover { background: var(--csa-border); }
.sl-csa .csa-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* ── form（import tab 用） ────────────────────── */
.sl-csa .csa-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  margin: 12px 0;
}
@media (max-width: 640px) {
  .sl-csa .csa-form { grid-template-columns: 1fr; }
}
.sl-csa .csa-field { display: flex; flex-direction: column; gap: 4px; }
.sl-csa .csa-field__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--csa-fg-2);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.sl-csa .csa-field__label code {
  font-family: var(--csa-mono);
  font-size: 10px;
  font-weight: 400;
  color: var(--csa-fg-3);
}
.sl-csa .csa-field__input,
.sl-csa .csa-field__select,
.sl-csa .csa-field__area {
  padding: 7px 10px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: var(--csa-panel);
  font-size: 13px;
  box-shadow: var(--csa-shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-field__input:hover,
.sl-csa .csa-field__select:hover,
.sl-csa .csa-field__area:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-field__input:focus,
.sl-csa .csa-field__select:focus,
.sl-csa .csa-field__area:focus {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-field__area { resize: vertical; }
.sl-csa .csa-field--wide { grid-column: 1 / -1; }

/* ── steps（import tab 用） ───────────────────── */
.sl-csa .csa-step {
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  padding: 18px;
  margin-bottom: 12px;
}
.sl-csa .csa-step__title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.sl-csa .csa-step__no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--csa-primary);
  color: #ffffff;
  font-family: var(--csa-mono);
  font-size: 10.5px;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.35);
  flex: none;
}
.sl-csa .csa-step__desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-json {
  width: 100%;
  min-height: 220px;
  padding: 10px 12px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: #fbfbfc;
  font-family: var(--csa-mono);
  font-size: 11.5px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-json:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-json:focus {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-json::placeholder { color: var(--csa-fg-3); }

/* ── 动画 ────────────────────────────────────── */
@keyframes csa-fade-in {
  from { opacity: 0; }
}
@keyframes csa-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
}
@keyframes csa-slide-in {
  from { opacity: 0; transform: translateY(-4px); }
}

/* ── 移动端 ──────────────────────────────────── */
@media (max-width: 640px) {
  .sl-csa { padding: 16px 16px 28px; }
  .sl-csa .csa-card__row { padding: 10px 12px; }
  .sl-csa .csa-step { padding: 14px; }
}

/* ── 动效降级 ────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .sl-csa *,
  .sl-csa *::before,
  .sl-csa *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
