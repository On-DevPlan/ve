<!-- PreviewTab.vue —— 只读预览：皮肤卡片 + 12 张棋子网格;admin/owner 可在此行重命名 / 删除。
     所有样式来自 index.vue 的共享设计系统（.csa-*）。 -->
<script setup lang="ts">
import { ref } from 'vue';
import { PIECE_KEYS } from '../composables/useChessSkinAdmin';

const props = defineProps<{
  admin: ReturnType<typeof import('../composables/useChessSkinAdmin').useChessSkinAdmin>;
}>();

const expandedId = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameInput = ref('');
const renameSubmitting = ref(false);
const deletingId = ref<string | null>(null);
const deleteSubmitting = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

/* ---- 重 rename modal ---- */
function openRename(id: string, currentName: string) {
  renamingId.value = id;
  renameInput.value = currentName;
  status.value = null;
}
function closeRename() {
  if (renameSubmitting.value) return;
  renamingId.value = null;
}
async function submitRename() {
  if (!renamingId.value || !renameInput.value.trim() || renameSubmitting.value) return;
  renameSubmitting.value = true;
  status.value = null;
  try {
    const updated = await props.admin.renameSkin(renamingId.value, renameInput.value);
    status.value = { ok: true, text: `${updated.displayName}（${updated.id}）已重命名` };
    renamingId.value = null;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  } finally {
    renameSubmitting.value = false;
  }
}

/* ---- 删除 modal ---- */
function openDelete(id: string) {
  deletingId.value = id;
  status.value = null;
}
function closeDelete() {
  if (deleteSubmitting.value) return;
  deletingId.value = null;
}
async function confirmDelete() {
  if (!deletingId.value || deleteSubmitting.value) return;
  deleteSubmitting.value = true;
  status.value = null;
  try {
    const id = deletingId.value;
    await props.admin.deleteSkin(id);
    status.value = { ok: true, text: `${id} 已从 chess_skin:index 移除` };
    deletingId.value = null;
    if (expandedId.value === id) expandedId.value = null;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  } finally {
    deleteSubmitting.value = false;
  }
}
</script>

<template>
  <section>
    <p class="csa-help">
      共 {{ props.admin.index.value.length }} 套皮肤。点击行首名称展开 12 张棋子图。
    </p>

    <div
      v-if="props.admin.index.value.length === 0 && !props.admin.loading.value"
      class="csa-empty"
    >
      <span>还没有皮肤</span>
      <span>owner/admin 登录后可在「批量导入」上传第一套</span>
    </div>

    <ul>
      <li
        v-for="m in props.admin.index.value"
        :key="m.id"
        class="csa-card"
      >
        <div
          class="csa-card__row is-clickable"
          @click="toggle(m.id)"
        >
          <span
            class="csa-caret"
            :class="{ 'is-open': expandedId === m.id }"
          />
          <span class="csa-card__name">{{ m.displayName }}</span>
          <span class="csa-card__id">{{ m.id }}</span>
          <span class="csa-card__ver">v{{ m.version }}</span>
          <template v-if="props.admin.canEdit.value">
            <button
              class="csa-card__action"
              title="重命名（版本号 +1）"
              @click.stop="openRename(m.id, m.displayName)"
            >
              重命名
            </button>
            <button
              class="csa-card__action csa-card__action--danger"
              title="从 chess_skin:index 移除（文件保留）"
              @click.stop="openDelete(m.id)"
            >
              删除
            </button>
          </template>
        </div>
        <div
          v-if="expandedId === m.id"
          class="csa-grid"
        >
          <figure
            v-for="k in PIECE_KEYS"
            :key="k"
            class="csa-piece"
          >
            <div class="csa-piece__tile">
              <img
                :src="props.admin.previewFileUrl(m.pieces[k]?.fileId ?? '')"
                :alt="k"
                loading="lazy"
              >
            </div>
            <figcaption>
              <span class="csa-piece__key">{{ k }}</span>
              <span class="csa-piece__fid">{{ m.pieces[k]?.fileId?.slice(0, 8) ?? '--' }}</span>
            </figcaption>
          </figure>
        </div>
      </li>
    </ul>

    <p
      v-if="status"
      :class="['csa-status', status.ok ? 'csa-status--ok' : 'csa-status--err']"
    >
      {{ status.text }}
    </p>

    <!-- 重命名 modal -->
    <div
      v-if="renamingId"
      class="csa-modal"
      @click.self="closeRename"
    >
      <div class="csa-modal__card">
        <h3 class="csa-modal__title">
          重命名 <code>{{ renamingId }}</code>
        </h3>
        <p class="csa-modal__desc">
          改 displayName，版本号 +1，立即持久化到 KV。
        </p>
        <input
          v-model="renameInput"
          class="csa-modal__file"
          type="text"
          autofocus
          @keydown.enter="submitRename"
          @keydown.escape="closeRename"
        >
        <div class="csa-modal__actions">
          <button
            class="csa-btn"
            :disabled="renameSubmitting"
            @click="closeRename"
          >
            取消
          </button>
          <button
            class="csa-btn csa-btn--primary"
            :disabled="!renameInput.trim() || renameSubmitting"
            @click="submitRename"
          >
            {{ renameSubmitting ? '保存中' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除 modal -->
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
          该操作从 KV chess_skin:index 移除该皮肤（版本号一并消失），文件资源保留。无法撤销。
        </p>
        <div class="csa-modal__actions">
          <button
            class="csa-btn"
            :disabled="deleteSubmitting"
            @click="closeDelete"
          >
            取消
          </button>
          <button
            class="csa-btn csa-btn--danger"
            :disabled="deleteSubmitting"
            @click="confirmDelete"
          >
            {{ deleteSubmitting ? '删除中' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>