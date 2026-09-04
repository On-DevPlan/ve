<!-- game-skin-admin/src/views/ImportTab.vue — 批量导入（仅 admin/owner），游戏无关。
     1) 复制 AI 提示词（由 registry 的 aiPrompt 生成，支持 game 切换）
     2) 选择 N 张图（N = registry.assetKeys.length），仅视觉确认
     无 meta JSON 粘贴步骤、无发布按钮（上传由 add_skin.py 等外部流水线负责）。 -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import type { UseSkinAdmin } from '../composables/useSkinAdmin';

const props = defineProps<{
  admin: UseSkinAdmin;
}>();

const promptText = ref('');
const files = ref<Record<string, File>>({});
const copied = ref(false);

function buildDefaultPrompt(): string {
  // 用看板默认 skinId/displayName 生成一份可编辑模板
  return props.admin.generateAiPrompt({
    skinId: 'my-skin-1',
    displayName: '我的皮肤 1',
    colorStyle: 'vivid',
    artDirection: '在此处描述你想要的视觉风格',
  });
}

watch(
  () => props.admin.entry.gameId,
  () => {
    promptText.value = buildDefaultPrompt();
    files.value = {};
  },
  { immediate: true },
);

async function copyPrompt() {
  if (!promptText.value) return;
  try {
    await navigator.clipboard.writeText(promptText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard 不可用时静默降级 */
  }
}

function pick(k: string, e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  files.value = { ...files.value, [k]: f };
}

function refreshPrompt() {
  promptText.value = buildDefaultPrompt();
}
</script>

<template>
  <section>
    <!-- 第 1 步：复制 AI 提示词（可编辑，game 切换时自动刷新） -->
    <div class="csa-step">
      <div class="csa-step__title">
        <span class="csa-step__no">1</span>
        复制 AI 提示词
      </div>
      <p class="csa-step__desc">
        已按当前游戏（{{ props.admin.entry.displayName }}，{{ props.admin.assetKeys.length }} 资源）生成模板。直接编辑主题/参数后复制粘贴给 AI。
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          style="margin-left: 8px"
          @click="refreshPrompt"
        >
          重置模板
        </button>
      </p>
      <textarea
        v-model="promptText"
        class="csa-json"
        rows="14"
        spellcheck="false"
      />
      <button
        class="csa-btn"
        :disabled="!promptText"
        @click="copyPrompt"
      >
        {{ copied ? '已复制到剪贴板' : '复制提示词' }}
      </button>
    </div>

    <!-- 第 2 步：选择 N 张图（视觉确认，实际由外部脚本上传） -->
    <div class="csa-step">
      <div class="csa-step__title">
        <span class="csa-step__no">2</span>
        选择 {{ props.admin.assetKeys.length }} 张图
      </div>
      <p class="csa-step__desc">
        期望文件：<code>{{ props.admin.assetKeys.map((k) => props.admin.fileNames[k]).join('、') }}</code>。
        上传由 add_skin.py --game {{ props.admin.entry.gameId }} 等外部流水线负责，本组件仅做文件挑选的视觉确认。
      </p>
      <div
        class="csa-grid"
        :style="{ gridTemplateColumns: `repeat(${props.admin.entry.gridColumns}, 1fr)` }"
      >
        <label
          v-for="k in props.admin.assetKeys"
          :key="k"
          class="csa-up"
          :class="{ 'is-set': files[k] }"
        >
          <div class="csa-up__tile">
            {{ files[k] ? files[k]!.name : props.admin.fileNames[k] }}
          </div>
          <span class="csa-up__key">{{ k }}</span>
          <span
            v-if="props.admin.entry.labels[k]"
            class="csa-piece__label"
          >{{ props.admin.entry.labels[k] }}</span>
          <input
            type="file"
            accept="image/webp,image/png"
            @change="(e) => pick(k, e)"
          >
        </label>
      </div>
    </div>
  </section>
</template>
