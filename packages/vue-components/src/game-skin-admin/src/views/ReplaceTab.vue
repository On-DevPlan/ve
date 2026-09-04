<!-- game-skin-admin/src/views/ReplaceTab.vue — 单资源替换（仅 owner/admin）。
     点击资源格 -> 模态选新图 -> 上传(fileV1 带 3 级 tag) + 写 KV + 清理旧文件。 -->
<script setup lang="ts">
import { ref } from 'vue';
import { assetTags } from '../composables/useSkinAdmin';
import type { UseSkinAdmin } from '../composables/useSkinAdmin';

const props = defineProps<{
  admin: UseSkinAdmin;
}>();

const target = ref<{ skinId: string; assetKey: string } | null>(null);
const file = ref<File | null>(null);
const submitting = ref(false);
const status = ref<{ ok: boolean; text: string } | null>(null);

function getAssetMap(m: (typeof props.admin.index.value)[number]): Record<string, { fileId?: string }> {
  // KV schema 字段名全游戏统一 `pieces`（与 fr GameSkinMeta 对齐）
  return (m.pieces as Record<string, { fileId?: string }>) ?? {};
}

function open(skinId: string, assetKey: string) {
  if (!props.admin.canEdit.value) return;
  target.value = { skinId, assetKey };
  file.value = null;
  status.value = null;
}

async function submit() {
  if (!target.value || !file.value) return;
  submitting.value = true;
  status.value = null;
  try {
    const result = await props.admin.replacePiece(
      target.value.skinId,
      target.value.assetKey,
      file.value,
      file.value.name,
    );
    const okText = `${target.value.assetKey} 已替换并发布`;
    if (result.orphanedFailed.length > 0) {
      const failedIds = result.orphanedFailed.map((f) => f.fileId.slice(0, 8)).join(', ');
      status.value = {
        ok: true,
        text: `${okText}（旧文件清理失败 ${result.orphanedFailed.length} 个: ${failedIds}）`,
      };
    } else if (result.orphanedCleaned.length > 0) {
      status.value = {
        ok: true,
        text: `${okText}（旧文件 ${result.orphanedCleaned.length} 个已清理）`,
      };
    } else {
      status.value = { ok: true, text: okText };
    }
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
      <span>后端按 groupId={{ props.admin.entry.groupId }} 的 myRole 校验，需要 owner 或 admin</span>
    </div>

    <template v-else>
      <p class="csa-help">
        点击任意资源格上传新图替换。KV index 版本号自动 +1，被替换的旧文件会一并清理（清理失败仅警告，不影响主操作）。
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
          <div
            class="csa-grid"
            :style="{ gridTemplateColumns: `repeat(${props.admin.entry.gridColumns}, 1fr)` }"
          >
            <figure
              v-for="k in props.admin.assetKeys"
              :key="k"
              class="csa-piece csa-piece--click"
            >
              <div
                class="csa-piece__tile"
                @click="open(m.id, k)"
              >
                <img
                  :src="props.admin.previewFileUrl(getAssetMap(m)[k]?.fileId ?? '')"
                  :alt="k"
                  loading="lazy"
                >
                <span class="csa-piece__hint">替换</span>
              </div>
              <figcaption>
                <span class="csa-piece__key">{{ k }}</span>
                <span
                  v-if="props.admin.entry.labels[k]"
                  class="csa-piece__label"
                >{{ props.admin.entry.labels[k] }}</span>
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
            替换 <code>{{ target.skinId }} / {{ target.assetKey }}</code>
          </h3>
          <p class="csa-modal__desc">
            透明底 webp 或 png。上传自动打三级 tag：<code>{{ assetTags(props.admin.entry, target.skinId, target.assetKey).join(' ') }}</code>
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
