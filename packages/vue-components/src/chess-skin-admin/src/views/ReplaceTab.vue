<!-- ReplaceTab.vue —— 单棋子替换（仅 owner）。
     点击棋子格 -> 模态选新图 -> 上传(fileV1 带 tags) + 写 KV。
     后端按 groupId=190 兜底校验，前端只控制 UI 可见性。 -->
<script setup lang="ts">
import { ref } from 'vue';
import {
  PIECE_KEYS,
  pieceTags,
  type PieceKey,
} from '../composables/useChessSkinAdmin';

const props = defineProps<{
  admin: ReturnType<typeof import('../composables/useChessSkinAdmin').useChessSkinAdmin>;
}>();

const target = ref<{ skinId: string; pieceKey: PieceKey } | null>(null);
const file = ref<File | null>(null);
const submitting = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);

function open(skinId: string, pieceKey: PieceKey) {
  if (!props.admin.canEdit.value) return;
  target.value = { skinId, pieceKey };
  file.value = null;
  status.value = null;
}

async function submit() {
  if (!target.value || !file.value) return;
  submitting.value = true;
  status.value = null;
  try {
    await props.admin.replacePiece(
      target.value.skinId,
      target.value.pieceKey,
      file.value,
      file.value.name,
    );
    status.value = { ok: true, text: `${target.value.pieceKey} 已替换并发布` };
    target.value = null;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section>
    <div
      v-if="!props.admin.canEdit.value"
      class="csa-empty"
    >
      <span>当前角色（{{ props.admin.myRole.value ?? '未登录' }}）无修改权限</span>
      <span>后端按 groupId=190 的 myRole 校验，需要 owner 或 admin</span>
    </div>

    <template v-else>
      <p class="csa-help">
        点击任意棋子格上传新图替换。原文件保留可回滚，KV index 版本号自动 +1。
      </p>

      <ul>
        <li
          v-for="m in props.admin.index.value"
          :key="m.id"
          class="csa-card"
        >
          <div class="csa-card__row">
            <span class="csa-card__name">{{ m.displayName }}</span>
            <span class="csa-card__id">{{ m.id }}</span>
            <span class="csa-card__ver">v{{ m.version }}</span>
          </div>
          <div class="csa-grid">
            <figure
              v-for="k in PIECE_KEYS"
              :key="k"
              class="csa-piece csa-piece--click"
            >
              <div
                class="csa-piece__tile"
                @click="open(m.id, k)"
              >
                <img
                  :src="props.admin.previewFileUrl(m.pieces[k]?.fileId ?? '')"
                  :alt="k"
                  loading="lazy"
                >
                <span class="csa-piece__hint">替换</span>
              </div>
              <figcaption>
                <span class="csa-piece__key">{{ k }}</span>
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

      <div
        v-if="target"
        class="csa-modal"
      >
        <div class="csa-modal__card">
          <h3 class="csa-modal__title">
            替换 <code>{{ target.skinId }} / {{ target.pieceKey }}</code>
          </h3>
          <p class="csa-modal__desc">
            透明底 webp 或 png。上传自动打三级 tag：<code>{{ pieceTags(target.skinId, target.pieceKey).join(' ') }}</code>
          </p>
          <input
            class="csa-modal__file"
            type="file"
            accept="image/*"
            @change="(e) => (file = (e.target as HTMLInputElement).files?.[0] ?? null)"
          >
          <div class="csa-modal__actions">
            <button
              class="csa-btn"
              @click="target = null"
            >
              取消
            </button>
            <button
              class="csa-btn csa-btn--primary"
              :disabled="!file || submitting"
              @click="submit"
            >
              {{ submitting ? '上传中' : '上传并写 KV' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
