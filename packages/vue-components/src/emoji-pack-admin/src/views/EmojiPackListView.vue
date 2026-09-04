<!-- EmojiPackListView — open-set 列表：预览 + 删 + 上/下移（reorder）。游戏无关。 -->
<script setup lang="ts">
import type { UseEmojiAdmin } from '../composables/useEmojiAdmin';

const props = defineProps<{
  admin: UseEmojiAdmin;
}>();

const emit = defineEmits<{
  (e: 'request-reorder', orderedIds: string[]): void;
  (e: 'request-delete', emojiId: string): void;
}>();

function move(id: string, dir: -1 | 1) {
  const ids = props.admin.index.value.map((m) => m.id);
  const idx = ids.indexOf(id);
  const nxt = idx + dir;
  if (idx < 0 || nxt < 0 || nxt >= ids.length) return;
  const swapped = [...ids];
  const tmp = swapped[idx]!;
  swapped[idx] = swapped[nxt]!;
  swapped[nxt] = tmp;
  emit('request-reorder', swapped);
}

function shortFileId(m: { file: { fileId: string } }): string {
  return m.file.fileId.slice(0, 8);
}
</script>

<template>
  <section>
    <p class="csa-help">
      共 {{ props.admin.index.value.length }} 个表情。
      <template v-if="props.admin.canEdit.value">
        可上传、删除、上/下移排序。KV <code>{{ props.admin.entry.kvIndexKey }}</code> · tag <code>{{ props.admin.entry.tagPrefix }}</code>
      </template>
      <template v-else>
        只读预览（需 owner/admin）。
      </template>
    </p>

    <div
      v-if="props.admin.index.value.length === 0 && !props.admin.loading.value"
      class="csa-empty"
    >
      <span>还没有表情</span>
      <span>owner/admin 登录后可上传第一张</span>
    </div>

    <ul class="csa-emoji-list">
      <li
        v-for="(m, i) in props.admin.index.value"
        :key="m.id"
        class="csa-emoji-card"
      >
        <div class="csa-emoji-card__preview">
          <img
            :src="props.admin.previewFileUrl(m.file.fileId)"
            :alt="m.id"
            loading="lazy"
          >
        </div>
        <div class="csa-emoji-card__meta">
          <span class="csa-emoji-card__id">{{ m.id }}</span>
          <span
            v-if="m.displayName && m.displayName !== m.id"
            class="csa-emoji-card__name"
          >{{ m.displayName }}</span>
          <span class="csa-emoji-card__fid">{{ shortFileId(m) }} · {{ m.file.contentType }}</span>
        </div>
        <div class="csa-emoji-card__actions">
          <button
            v-if="props.admin.canEdit.value"
            class="csa-btn csa-btn--ghost csa-btn--sm"
            :disabled="i === 0 || props.admin.loading.value"
            title="上移"
            @click="move(m.id, -1)"
          >
            上移
          </button>
          <button
            v-if="props.admin.canEdit.value"
            class="csa-btn csa-btn--ghost csa-btn--sm"
            :disabled="i === props.admin.index.value.length - 1 || props.admin.loading.value"
            title="下移"
            @click="move(m.id, 1)"
          >
            下移
          </button>
          <button
            v-if="props.admin.canEdit.value"
            class="csa-btn csa-btn--ghost csa-btn--sm csa-emoji-card__del"
            :disabled="props.admin.loading.value"
            @click="emit('request-delete', m.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.csa-emoji-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.csa-emoji-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
}
.csa-emoji-card__preview {
  width: 44px;
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius-sm);
  background: conic-gradient(#ececee 0 25%, #ffffff 0 50%, #ececee 0 75%, #ffffff 0) 0 0 / 10px 10px;
  overflow: hidden;
}
.csa-emoji-card__preview img {
  width: 78%;
  height: 78%;
  object-fit: contain;
}
.csa-emoji-card__meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.csa-emoji-card__id {
  font-family: var(--csa-mono);
  font-size: 12px;
  font-weight: 600;
}
.csa-emoji-card__name {
  font-size: 11px;
  color: var(--csa-fg-2);
}
.csa-emoji-card__fid {
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
}
.csa-emoji-card__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
}
.csa-emoji-card__del:hover {
  color: var(--csa-danger);
}
</style>
