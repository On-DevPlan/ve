<!-- ImportTab.vue —— 批量导入（仅 admin/owner）。
     简化后只剩两件事：
       1) 复制 AI 提示词（可编辑）
       2) 选择 12 张图
     无 meta JSON 粘贴步骤（用户在自己编辑器里处理）、
     无发布按钮（上传由现有 add_skin.py / 外部流水线负责）。
     文件选择仅做视觉确认（tile 显示已选文件名）。
     后端按 groupId=190 的 myRole 兜底校验，前端只控 UI 可见性。 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  PIECE_KEYS,
  PIECE_KEY_FILENAME,
  type PieceKey,
} from '../composables/useChessSkinAdmin';

const promptText = ref('');
const files = ref<Partial<Record<PieceKey, File>>>({});
const copied = ref(false);

/** 默认提示词模板 —— 用户可在上方文本框内直接编辑。 */
const DEFAULT_PROMPT = `请输出一个国际象棋皮肤 meta JSON(只输出 JSON,不要任何解释/代码块/前后缀文字)。

皮肤主题:在此处描述你想要的视觉风格,例如:极简线稿 + 霓虹描边,白子冷色、黑子暖色,统一 32x32 视觉密度。

JSON schema:
{
  "id": "<skinId,^[a-z0-9][a-z0-9-]{0,31}$>",
  "displayName": "<中文/英文名>",
  "version": 1,
  "colorStyle": "vivid | warm | cool | muted",
  "createdAt": "<ISO 8601>",
  "updatedAt": "<ISO 8601>",
  "pieces": {
    "wK": { "fileId": "TBD", "fileName": "00_white_king.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "wQ": { "fileId": "TBD", "fileName": "01_white_queen.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "wR": { "fileId": "TBD", "fileName": "02_white_rook.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "wB": { "fileId": "TBD", "fileName": "03_white_bishop.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "wN": { "fileId": "TBD", "fileName": "04_white_knight.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "wp": { "fileId": "TBD", "fileName": "05_white_pawn.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bK": { "fileId": "TBD", "fileName": "06_black_king.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bQ": { "fileId": "TBD", "fileName": "07_black_queen.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bR": { "fileId": "TBD", "fileName": "08_black_rook.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bB": { "fileId": "TBD", "fileName": "09_black_bishop.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bN": { "fileId": "TBD", "fileName": "10_black_knight.webp", "sizeBytes": 0, "contentType": "image/webp" },
    "bp": { "fileId": "TBD", "fileName": "11_black_pawn.webp", "sizeBytes": 0, "contentType": "image/webp" }
  }
}

硬硬性约束:
- id 必须匹配 ^[a-z0-9][a-z0-9-]{0,31}$
- 12 个 piece key 齐全齐全:wK wQ wR wB wN wp / bK bQ bR bB bN bp
- 所有 fileId 先填 "TBD" 占位 —— 拿到 JSON 后会用批量上传脚本回填
- createdAt / updatedAt 都填当前时间(ISO 8601)
- colorStyle 必须是 vivid / warm / cool / muted 之一`;

onMounted(() => {
  if (!promptText.value) promptText.value = DEFAULT_PROMPT;
});

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

function pick(k: PieceKey, e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  files.value = { ...files.value, [k]: f };
}
</script>

<template>
  <section>
    <!-- 第 1 步：复制 AI 提示词（可编辑） -->
    <div class="csa-step">
      <div class="csa-step__title">
        <span class="csa-step__no">1</span>
        复制 AI 提示词
      </div>
      <p class="csa-step__desc">
        直接在下方文本框内编辑主题/参数后点击复制,粘贴给 AI 助手。AI 会返回 meta JSON。
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

    <!-- 第 2 步：选择 12 张图（视觉确认,实际由外部脚本上传） -->
    <div class="csa-step">
      <div class="csa-step__title">
        <span class="csa-step__no">2</span>
        选择 12 张图
      </div>
      <p class="csa-step__desc">
        建议命名 <code>00_white_king.webp</code> 至 <code>11_black_pawn.webp</code>。
        上传由 add_skin.py 等外部流水线负责,本组件仅做文件挑选的视觉确认。
      </p>
      <div class="csa-grid">
        <label
          v-for="k in PIECE_KEYS"
          :key="k"
          class="csa-up"
          :class="{ 'is-set': files[k] }"
        >
          <div class="csa-up__tile">
            {{ files[k] ? files[k]!.name : PIECE_KEY_FILENAME[k] }}
          </div>
          <span class="csa-up__key">{{ k }}</span>
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