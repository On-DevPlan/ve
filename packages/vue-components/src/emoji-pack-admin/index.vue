<!-- emoji-pack-admin/index.vue — 表情包管理主页。
     单组件：scope 切换器（common / <gameId>），open-set 列表（上/删/排序）+ 上传弹窗。
     比 skin 的 3-tab 更轻：只一层列表，无 12 宫格固定槽位。
     深链：?scope=chess（默认 common）。scope 切换时销毁旧 admin、建新 admin，KV 重新拉。 -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  EMOJI_SCOPE_REGISTRY,
  isSupportedEmojiScope,
  kvIndexKeyForScope,
} from './src/composables/emojiRegistry';
import { useEmojiAdmin } from './src/composables/useEmojiAdmin';
import EmojiPackListView from './src/views/EmojiPackListView.vue';
import EmojiUploadModal from './src/views/EmojiUploadModal.vue';

function readScopeFromUrl(): string {
  if (typeof window === 'undefined') return 'common';
  const s = new URLSearchParams(window.location.search).get('scope')?.trim().toLowerCase() ?? '';
  return isSupportedEmojiScope(s) ? s : 'common';
}

function writeScopeToUrl(scope: string) {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  const url = new URL(window.location.href);
  if (scope === 'common') url.searchParams.delete('scope');
  else url.searchParams.set('scope', scope);
  history.replaceState(null, '', url.toString());
}

const scope = ref<string>(readScopeFromUrl());
const admin = computed(() => useEmojiAdmin(scope.value));
const showUpload = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);
const deletingId = ref<string | null>(null);

const scopeEntries = Object.values(EMOJI_SCOPE_REGISTRY);

function switchScope(next: string) {
  if (next === scope.value) return;
  scope.value = next;
  status.value = null;
  writeScopeToUrl(next);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    scope.value = readScopeFromUrl();
  });
}

watch(
  scope,
  () => {
    // scope 变化：新 admin 的 index 默认为空，切后自动拉
    if (admin.value.loginHint.value === null) admin.value.loadIndex();
  },
  { immediate: false },
);

onMounted(() => {
  writeScopeToUrl(scope.value);
  if (admin.value.loginHint.value === null) admin.value.loadIndex();
});

async function handleUpload(payload: { file: File; emojiId: string; displayName: string }) {
  status.value = null;
  try {
    const meta = await admin.value.uploadEmoji(payload.file, payload.emojiId, payload.displayName);
    status.value = { ok: true, text: `${meta.id} 已上传并写入 ${admin.value.entry.kvIndexKey}` };
    showUpload.value = false;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

function requestDelete(emojiId: string) {
  deletingId.value = emojiId;
}

function closeDelete() {
  deletingId.value = null;
}

async function confirmDelete() {
  if (!deletingId.value) return;
  status.value = null;
  try {
    const id = deletingId.value;
    await admin.value.deleteEmoji(id);
    status.value = { ok: true, text: `${id} 已从 ${admin.value.entry.kvIndexKey} 移除并删除文件` };
    deletingId.value = null;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

async function requestReorder(orderedIds: string[]) {
  status.value = null;
  try {
    await admin.value.reorder(orderedIds);
    status.value = { ok: true, text: '顺序已保存' };
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

const currentKvKey = computed(() => kvIndexKeyForScope(scope.value));
</script>

<template>
  <div class="sl-csa">
    <header class="csa-head">
      <div class="csa-head__title">
        <h2>表情包管理</h2>
        <span class="csa-sub">KV public · {{ currentKvKey }} · groupId 190</span>
      </div>
      <div class="csa-head__meta">
        <span class="csa-badge csa-badge--info">{{ scopeEntries.length }} 个 scope</span>
        <button
          v-if="admin.canEdit.value"
          class="csa-btn csa-btn--primary csa-btn--sm"
          @click="showUpload = true"
        >
          上传表情
        </button>
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          @click="admin.loadIndex()"
        >
          刷新
        </button>
      </div>
    </header>

    <!-- scope 切换器 -->
    <nav
      class="csa-tabs"
      role="tablist"
    >
      <button
        v-for="e in scopeEntries"
        :key="e.scope"
        role="tab"
        :class="['csa-tabs__item', { 'is-active': scope === e.scope }]"
        :aria-selected="scope === e.scope"
        @click="switchScope(e.scope)"
      >
        {{ e.displayName }}
        <span
          class="csa-tabs__lock csa-badge csa-badge--mute"
          style="font-size:10px;"
        >{{ e.scope }}</span>
      </button>
    </nav>

    <!-- status bar -->
    <div
      class="csa-detail__status"
      style="margin-bottom:14px;"
    >
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
    </div>

    <EmojiPackListView
      :key="scope"
      :admin="admin"
      @request-delete="requestDelete"
      @request-reorder="requestReorder"
    />

    <p
      v-if="status"
      :class="['csa-status', status.ok ? 'csa-status--ok' : 'csa-status--err']"
    >
      {{ status.text }}
    </p>

    <EmojiUploadModal
      :open="showUpload"
      :busy="admin.loading.value"
      :tag-prefix="admin.entry.tagPrefix"
      @close="showUpload = false"
      @submit="handleUpload"
    />

    <!-- 删除确认 -->
    <div
      v-if="deletingId"
      class="csa-modal"
      @click.self="closeDelete"
    >
      <div class="csa-modal__card">
        <h3 class="csa-modal__title">
          删除 <code>{{ deletingId }}</code>
        </h3>
        <p class="csa-modal__desc">
          从 KV {{ admin.entry.kvIndexKey }} 移除该表情，并联动删除对应文件。无法撤销。
        </p>
        <div class="csa-modal__actions">
          <button
            class="csa-btn"
            :disabled="admin.loading.value"
            @click="closeDelete"
          >
            取消
          </button>
          <button
            class="csa-btn csa-btn--danger"
            :disabled="admin.loading.value"
            @click="confirmDelete"
          >
            {{ admin.loading.value ? '删除中' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 复用 game-skin-admin 的 ShadowRoot 设计 token 与 csa-* 命名（同一视觉语言）。 */
.sl-csa {
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
  --csa-radius: 10px;
  --csa-radius-sm: 8px;
  --csa-ring: 0 0 0 3px rgba(37, 99, 235, 0.14);
  --csa-shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.05);
  --csa-shadow-md: 0 1px 2px rgba(24, 24, 27, 0.04), 0 4px 16px rgba(24, 24, 27, 0.06);
  --csa-shadow-lg: 0 24px 48px -12px rgba(24, 24, 27, 0.28);
  --csa-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
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
.sl-csa .csa-badge--mute::before { display: none; }
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
.sl-csa .csa-detail__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0;
}
.sl-csa .csa-help {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-help code {
  font-family: var(--csa-mono);
  font-size: 11px;
  background: var(--csa-hover);
  padding: 1px 5px;
  border-radius: 4px;
}
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
  background: conic-gradient(var(--csa-hover) 0 25%, #ffffff 0 50%, var(--csa-hover) 0 75%, #ffffff 0) 0 0 / 11px 11px;
}
.sl-csa .csa-empty em {
  font-style: normal;
  color: var(--csa-fg-2);
  font-weight: 500;
}
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

@keyframes csa-fade-in {
  from { opacity: 0; }
}
@keyframes csa-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
}
@keyframes csa-slide-in {
  from { opacity: 0; transform: translateY(-4px); }
}
@media (max-width: 640px) {
  .sl-csa { padding: 16px 16px 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .sl-csa *,
  .sl-csa *::before,
  .sl-csa *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
