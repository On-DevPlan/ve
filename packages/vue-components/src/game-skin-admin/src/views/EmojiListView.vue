<!-- EmojiListView — 游戏资产管理内嵌表情包面板（原 emoji-pack-admin 全功能）。
     scope 切换：common / <gameId>；深链由父级 index.vue 写 ?scope=。
     :key="scope" 由父级传入，确保切 scope 时重建 useEmojiAdmin。 -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { kvV1Service } from '@api/services';
import {
  EMOJI_SCOPE_REGISTRY,
  kvIndexKeyForScope,
} from '../composables/emojiRegistry';
import { useEmojiAdmin } from '../composables/useEmojiAdmin';
import { isKvKeyMissing, parseJsonArray } from '../composables/kvHelpers';
import EmojiPackListView from './EmojiPackListView.vue';
import EmojiUploadModal from './EmojiUploadModal.vue';

const props = defineProps<{
  scope: string;
}>();

const emit = defineEmits<{
  (e: 'update:scope', scope: string): void;
}>();

const admin = useEmojiAdmin(props.scope);
const showUpload = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);
const deletingId = ref<string | null>(null);

const scopeEntries = Object.values(EMOJI_SCOPE_REGISTRY);
/** scope → 表情条数；null = 读取中/失败 */
const scopeCounts = reactive<Record<string, number | null>>({});

const errorBadge = computed(() => {
  const e = admin.error.value;
  if (!e) return null;
  return { text: e, kind: 'danger' as const };
});

async function loadScopeCounts() {
  await Promise.all(
    scopeEntries.map(async (e) => {
      scopeCounts[e.scope] = null;
      try {
        const item = await kvV1Service.get({
          key: e.kvIndexKey,
          groupId: e.groupId,
        });
        scopeCounts[e.scope] = parseJsonArray(item.value).length;
      } catch (err) {
        scopeCounts[e.scope] = isKvKeyMissing(err) ? 0 : null;
      }
    }),
  );
}

function countLabel(scope: string): string {
  const n = scopeCounts[scope];
  if (n === undefined || n === null) return '…';
  return String(n);
}

onMounted(() => {
  if (admin.loginHint.value === null) admin.loadIndex();
  void loadScopeCounts();
});

watch(
  () => admin.index.value.length,
  (n) => {
    scopeCounts[props.scope] = n;
  },
);

function switchScope(next: string) {
  if (next === props.scope) return;
  status.value = null;
  emit('update:scope', next);
}

async function handleUpload(payload: { file: File; emojiId: string; displayName: string }) {
  status.value = null;
  try {
    const meta = await admin.uploadEmoji(payload.file, payload.emojiId, payload.displayName);
    status.value = { ok: true, text: `${meta.id} 已上传并写入 ${admin.entry.kvIndexKey}` };
    showUpload.value = false;
    scopeCounts[props.scope] = admin.index.value.length;
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
    await admin.deleteEmoji(id);
    status.value = { ok: true, text: `${id} 已从 ${admin.entry.kvIndexKey} 移除并删除文件` };
    deletingId.value = null;
    scopeCounts[props.scope] = admin.index.value.length;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

async function requestReorder(orderedIds: string[]) {
  status.value = null;
  try {
    await admin.reorder(orderedIds);
    status.value = { ok: true, text: '顺序已保存' };
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

async function refreshAll() {
  await admin.loadIndex();
  await loadScopeCounts();
}
</script>

<template>
  <section class="csa-emoji-panel">
    <div class="csa-toolbar">
      <div class="csa-toolbar__left">
        <span class="csa-badge csa-badge--mute">{{ kvIndexKeyForScope(props.scope) }}</span>
        <span
          v-if="admin.loading.value"
          class="csa-badge csa-badge--info"
        >加载中</span>
        <span
          v-else-if="errorBadge"
          :class="['csa-badge', errorBadge.kind === 'warn' ? 'csa-badge--warn' : 'csa-badge--danger']"
        >{{ errorBadge.text }}</span>
        <span
          v-else-if="admin.loginHint.value"
          class="csa-badge csa-badge--warn"
        >未登录 · 只读</span>
        <template v-else>
          <span class="csa-badge">{{ admin.myRole.value ?? '未登录' }}</span>
          <span class="csa-badge csa-badge--info">{{ admin.index.value.length }} 个表情</span>
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
      <div class="csa-toolbar__right">
        <button
          v-if="admin.canEdit.value"
          class="csa-btn csa-btn--primary csa-btn--sm"
          @click="showUpload = true"
        >
          上传表情
        </button>
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          @click="refreshAll"
        >
          刷新
        </button>
      </div>
    </div>

    <nav
      class="csa-scope"
      role="tablist"
      aria-label="表情作用域"
    >
      <button
        v-for="e in scopeEntries"
        :key="e.scope"
        role="tab"
        type="button"
        :class="['csa-scope__item', { 'is-active': props.scope === e.scope }]"
        :aria-selected="props.scope === e.scope"
        @click="switchScope(e.scope)"
      >
        <span class="csa-scope__name">{{ e.displayName }}</span>
        <span class="csa-scope__count">{{ countLabel(e.scope) }}</span>
        <span class="csa-scope__id">{{ e.scope }}</span>
      </button>
    </nav>

    <EmojiPackListView
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
  </section>
</template>

<style scoped>
.csa-emoji-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.csa-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 12px;
  box-shadow: var(--csa-shadow-sm);
}
.csa-toolbar__left,
.csa-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.csa-scope {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.csa-scope__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--csa-border);
  background: var(--csa-panel);
  color: var(--csa-fg-2);
  box-shadow: var(--csa-shadow-sm);
  transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.csa-scope__item:hover:not(.is-active) {
  border-color: var(--csa-border-strong);
  color: var(--csa-fg);
  transform: translateY(-1px);
}
.csa-scope__item.is-active {
  background: var(--csa-primary);
  border-color: var(--csa-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.5);
}
.csa-scope__item:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.csa-scope__name {
  font-size: 13px;
}
.csa-scope__count {
  font-family: var(--csa-mono);
  font-size: 11px;
  font-weight: 600;
  min-width: 1.2em;
  text-align: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--csa-hover);
  color: var(--csa-fg-2);
}
.csa-scope__item.is-active .csa-scope__count {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}
.csa-scope__id {
  font-family: var(--csa-mono);
  font-size: 10px;
  opacity: 0.75;
  text-transform: lowercase;
}
</style>
