<!-- EmojiPackListView — open-set 网格：大预览 + 删 + 上/下移。 -->
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
      共 {{ props.admin.index.value.length }} 个表情 ·
      KV <code>{{ props.admin.entry.kvIndexKey }}</code> ·
      tag <code>{{ props.admin.entry.tagPrefix }}</code>
      <template v-if="!props.admin.canEdit.value">
        · 只读（需 owner/admin）
      </template>
    </p>

    <div
      v-if="props.admin.index.value.length === 0 && !props.admin.loading.value"
      class="csa-empty"
    >
      <em>还没有表情</em>
      <span>owner/admin 登录后可上传第一张</span>
    </div>

    <ul
      v-else
      class="csa-emoji-grid"
    >
      <li
        v-for="(m, i) in props.admin.index.value"
        :key="m.id"
        class="csa-emoji-tile"
      >
        <div class="csa-emoji-tile__preview">
          <img
            :src="props.admin.previewFileUrl(m.file.fileId)"
            :alt="m.id"
            loading="lazy"
          >
        </div>
        <div class="csa-emoji-tile__body">
          <span class="csa-emoji-tile__id">{{ m.id }}</span>
          <span
            v-if="m.displayName && m.displayName !== m.id"
            class="csa-emoji-tile__name"
          >{{ m.displayName }}</span>
          <span class="csa-emoji-tile__fid">{{ shortFileId(m) }}</span>
        </div>
        <div
          v-if="props.admin.canEdit.value"
          class="csa-emoji-tile__actions"
        >
          <button
            class="csa-btn csa-btn--ghost csa-btn--sm"
            :disabled="i === 0 || props.admin.loading.value"
            title="上移"
            @click="move(m.id, -1)"
          >
            上
          </button>
          <button
            class="csa-btn csa-btn--ghost csa-btn--sm"
            :disabled="i === props.admin.index.value.length - 1 || props.admin.loading.value"
            title="下移"
            @click="move(m.id, 1)"
          >
            下
          </button>
          <button
            class="csa-btn csa-btn--ghost csa-btn--sm csa-emoji-tile__del"
            :disabled="props.admin.loading.value"
            @click="emit('request-delete', m.id)"
          >
            删
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.csa-emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
}
.csa-emoji-tile {
  display: flex;
  flex-direction: column;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.csa-emoji-tile:hover {
  border-color: var(--csa-border-strong);
  box-shadow: var(--csa-shadow-md);
  transform: translateY(-1px);
}
.csa-emoji-tile__preview {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--csa-border);
  background: conic-gradient(#ececee 0 25%, #ffffff 0 50%, #ececee 0 75%, #ffffff 0) 0 0 / 12px 12px;
}
.csa-emoji-tile__preview img {
  width: 72%;
  height: 72%;
  object-fit: contain;
}
.csa-emoji-tile__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 8px;
  min-width: 0;
}
.csa-emoji-tile__id {
  font-family: var(--csa-mono);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.csa-emoji-tile__name {
  font-size: 11px;
  color: var(--csa-fg-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.csa-emoji-tile__fid {
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
}
.csa-emoji-tile__actions {
  display: flex;
  gap: 2px;
  padding: 0 8px 10px;
}
.csa-emoji-tile__del:hover {
  color: var(--csa-danger);
}
</style>
