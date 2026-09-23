<!-- EmojiUploadModal — 轻量上传弹窗：选图（共享 FileDropZone 的 zone 形态：虚线拖放区，
     整块可点 + 拖拽填入）+ emojiId + 可选 displayName。 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
// 文件选择统一走 shared/components 的共享组件。只 import descriptor —— 直接渲染
// FileDropZone.vue 会绕过 SharedMount，descriptor.css 无人注入，组件裸样式。
import SharedMount from '@/shared/components/runtime/SharedMount.vue';
import FileDropZone, { formatRejectInfo } from '@/shared/components/FileDropZone';
import type { RejectInfo } from '@/shared/components/FileDropZone';

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
// 共享组件拒绝文件（类型不符 / 超体积 / 拖进目录）时的提示。
const pickError = ref<string | null>(null);

// 提示行优先级：拒绝提示 > 已选文件名 > 默认说明。
// 共享组件不内置「已选文件」展示，由调用方按自己的版式决定放哪。
// 默认说明不再重复「可点击选择也可拖拽到此处」—— zone 形态的主文案已经写了这件事。
const dropHint = computed(() => {
  if (pickError.value) return pickError.value;
  if (file.value) return `已选择：${file.value.name}`;
  return '透明底 webp / png / gif';
});

watch(
  () => props.open,
  (v) => {
    if (v) {
      file.value = null;
      emojiId.value = '';
      displayName.value = '';
      pickError.value = null;
    }
  },
);

function onSelect(files: File[]): void {
  const picked = files[0] ?? null;
  file.value = picked;
  pickError.value = null;
  if (!picked || emojiId.value) return;
  // 从文件名推导 emojiId（原有的便利行为，保持不变）。
  const base = picked.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^-+|-+$/g, '');
  if (base) emojiId.value = base.slice(0, 32).replace(/^-/, 'a');
}

function onReject(info: RejectInfo): void {
  pickError.value = formatRejectInfo(info);
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
        <!-- 外层必须是 div 而非 label：FileDropZone 内部有隐藏 input，用 label 包裹
             会让点击 label 额外激活一次那个 input，与根节点的 click 叠加，弹出两次选择器。 -->
        <div class="csa-field">
          <span class="csa-field__label">图片文件</span>
          <SharedMount
            :module="FileDropZone"
            :component-props="{
              variant: 'zone',
              accept: 'image/webp,image/png,image/gif',
              hint: dropHint,
              disabled: props.busy,
              onSelect: onSelect,
              onReject: onReject,
            }"
          />
        </div>
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
