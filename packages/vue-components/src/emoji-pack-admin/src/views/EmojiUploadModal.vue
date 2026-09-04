<!-- EmojiUploadModal — 轻量上传弹窗：选图 + emojiId + 可选 displayName。 -->
<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  busy: boolean;
  tagPrefix: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: { file: File; emojiId: string; displayName: string }): void;
}>();

const file = ref<File | null>(null);
const emojiId = ref('');
const displayName = ref('');

watch(
  () => props.open,
  (v) => {
    if (v) {
      file.value = null;
      emojiId.value = '';
      displayName.value = '';
    }
  },
);

function onFileChange(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (file.value && !emojiId.value) {
    const base = file.value.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^-+|-+$/g, '');
    if (base) emojiId.value = base.slice(0, 32).replace(/^-/, 'a');
  }
}

function submit() {
  if (!file.value || !emojiId.value.trim()) return;
  emit('submit', {
    file: file.value!,
    emojiId: emojiId.value.trim().toLowerCase(),
    displayName: displayName.value.trim(),
  });
}
</script>

<template>
  <div
    v-if="props.open"
    class="csa-modal"
    @click.self="emit('close')"
  >
    <div class="csa-modal__card">
      <h3 class="csa-modal__title">
        上传表情
      </h3>
      <p class="csa-modal__desc">
        透明底 webp/png。上传自动打 tag：<code>{{ props.tagPrefix }}, {{ props.tagPrefix }}:&lt;emojiId&gt;</code>
      </p>
      <div
        class="csa-form"
        style="grid-template-columns:1fr;"
      >
        <label class="csa-field">
          <span class="csa-field__label">图片文件</span>
          <input
            class="csa-modal__file"
            type="file"
            accept="image/webp,image/png,image/gif"
            @change="onFileChange"
          >
        </label>
        <label class="csa-field">
          <span class="csa-field__label">emoji id <code>^[a-z0-9][a-z0-9-_]{0,31}$</code></span>
          <input
            v-model="emojiId"
            class="csa-field__input"
            type="text"
            placeholder="如 thumbs-up / crown"
            maxlength="32"
          >
        </label>
        <label class="csa-field">
          <span class="csa-field__label">展示名（可选）</span>
          <input
            v-model="displayName"
            class="csa-field__input"
            type="text"
            placeholder="留空则用 id"
            maxlength="64"
          >
        </label>
      </div>
      <div class="csa-modal__actions">
        <button
          class="csa-btn"
          :disabled="props.busy"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="csa-btn csa-btn--primary"
          :disabled="!file || !emojiId.trim() || props.busy"
          @click="submit"
        >
          {{ props.busy ? '上传中' : '上传并写 KV' }}
        </button>
      </div>
    </div>
  </div>
</template>
