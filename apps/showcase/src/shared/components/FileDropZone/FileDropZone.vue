<!--
  FileDropZone.vue —— 选择 / 拖拽文件的共享组件（Vue 实现）。

  这是 shared/components 的第一个验证件，同时验证两种宿主环境：
    E1 Light DOM     宿主 chrome 里直接用
    E2 ShadowRoot 内 被 demo 组件消费（demo 由 DetailPage 挂在 ShadowRoot 里）

  三个「现状 13 处文件选择实现普遍没做」的校验细节，这里必须做全：
    1) accept 只约束弹窗选择器，**拖进来的文件完全绕过它** → 必须真实过滤；
    2) Windows 上 .toml 这类扩展名的 file.type 常为空串 → 类型判定必须回退到扩展名；
    3) 拖入文件夹时 File.type 为空且会被当成「合法文件」→ 用 webkitGetAsEntry 显式拒绝。

  四个形态（variant）：
    'button'  按钮 + 下方提示行。弹窗、工具条用。
    'tile'    方格，整格即触发区。网格格子用，可带预览图 / 主文本 / 底部覆盖条。
    'bare'    裸按钮。容器无装饰，按钮用消费方 buttonClass；不传则回落内置样式。
    'zone'    虚线拖放区，整块即触发区，框内只有文字。导入弹窗的文件页用。

  样式不写在本文件：见同目录 style.css 与 ../README.md 硬约定 3。
  对外通信全部走 props 回调（onSelect / onReject），不用 emit ——
  Vue 的 emit 在 island 边界上无法被 React 侧感知。
-->
<template>
  <div
    class="sl-file-drop"
    :class="{
      'sl-file-drop--dragging': dragging,
      'sl-file-drop--disabled': props.disabled,
      'sl-file-drop--tile': isTile,
      'sl-file-drop--bare': isBare,
      'sl-file-drop--zone': isZone,
    }"
    :role="isRootClickable ? 'button' : undefined"
    :tabindex="isRootClickable && !props.disabled ? 0 : undefined"
    :aria-disabled="isRootClickable && props.disabled ? 'true' : undefined"
    :aria-label="isRootClickable ? rootAriaLabel : undefined"
    @click="onRootClick"
    @keydown="onRootKeydown"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input
      ref="inputEl"
      class="sl-file-drop__input"
      type="file"
      :accept="props.accept"
      :multiple="props.multiple"
      :disabled="props.disabled"
      @change="onInputChange"
    >

    <!-- tile 形态：整格即触发区。内容二选一（图 / 文本），底部可叠一条 hint。 -->
    <template v-if="isTile">
      <img
        v-if="props.imageUrl"
        class="sl-file-drop__tile-img"
        :src="props.imageUrl"
        :alt="props.text ?? ''"
        loading="lazy"
      >
      <span
        v-else-if="props.text"
        class="sl-file-drop__tile-text"
      >{{ props.text }}</span>
      <span
        v-if="tileHint"
        class="sl-file-drop__tile-hint"
      >{{ tileHint }}</span>
    </template>

    <!-- zone 形态：整块即触发区，框内只有文字（不套按钮）。 -->
    <template v-else-if="isZone">
      <span class="sl-file-drop__zone-title">{{ zoneTitle }}</span>
      <span
        v-if="zoneHint"
        class="sl-file-drop__zone-hint"
      >{{ zoneHint }}</span>
    </template>

    <!-- button / bare 形态：一个按钮 + 可选提示行 -->
    <template v-else>
      <button
        type="button"
        :class="buttonClass"
        :disabled="props.disabled"
        @click="openPicker"
      >
        {{ props.label ?? '选择文件' }}
      </button>
      <p
        v-if="showButtonHint"
        class="sl-file-drop__hint"
      >
        {{ hintText }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FileDropZoneProps, RejectInfo } from './types';

const props = withDefaults(defineProps<FileDropZoneProps>(), {
  multiple: false,
  disabled: false,
});

const inputEl = ref<HTMLInputElement | null>(null);

const isTile = computed(() => props.variant === 'tile');
const isBare = computed(() => props.variant === 'bare');
const isZone = computed(() => props.variant === 'zone');

/**
 * 根节点自身是不是点击 / 键盘触发区。
 * tile 与 zone 都是「整块即触发区」，所以根是 div 而不是 button，
 * role / tabindex / 键盘响应都得自己补（原生 button 才有内置的 Enter / Space）。
 */
const isRootClickable = computed(() => isTile.value || isZone.value);

/**
 * 按钮类名。
 *
 * button 形态恒用内置样式；bare 形态优先用消费方的 buttonClass —— 但只要消费方
 * **没传**，就回落到同一个内置样式，这样「不传 buttonClass」= 接受共享层的统一
 * 外观（全仓库选文件按钮一致的唯一事实源在 style.css，而不是各组件各写一份）。
 *
 * 二选一而不是叠加：`.sl-file-drop__btn` 与消费方类名同为 (0,1,0)，同时挂上时
 * 谁生效取决于两份 CSS 的注入顺序，不可控。
 */
const buttonClass = computed(() => (isBare.value ? props.buttonClass || 'sl-file-drop__btn' : 'sl-file-drop__btn'));

// 拖拽态用计数器而非布尔：dragenter / dragleave 会在子元素之间反复冒泡，
// 单布尔会让指针经过按钮时 highlight 闪烁。
const dragDepth = ref(0);
const dragging = computed(() => dragDepth.value > 0);

/** button 形态的提示行：不传 hint 时按 accept / maxSizeMb 自动生成。 */
const hintText = computed(() => {
  if (props.hint) return props.hint;
  const parts: string[] = [];
  if (props.accept) parts.push(`支持 ${props.accept}`);
  if (props.maxSizeMb != null) parts.push(`单个不超过 ${props.maxSizeMb} MB`);
  parts.push('可点击选择，也可拖拽到此处');
  return parts.join(' · ');
});

// tile / bare 形态刻意不做自动生成：格子空间有限、裸形态要的就是「只有一个按钮」。
const tileHint = computed(() => (isTile.value ? (props.hint ?? '') : ''));
const showButtonHint = computed(() => !isBare.value || !!props.hint);

/** zone 形态的主文案：不传就是标准拖放区提示语。 */
const zoneTitle = computed(() => props.label?.trim() || '点击或拖拽文件到此处');

/**
 * zone 形态的副文案：显式 hint 优先，其次由 accept 生成。
 * 主文案已经说了「拖拽到此处」，这里只补「能放什么」——避免两行都在讲同一件事。
 */
const zoneHint = computed(() => {
  if (props.hint) return props.hint;
  if (!props.accept) return '';
  const types = props.accept
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .join(' / ');
  return types ? `支持 ${types}` : '';
});

/**
 * 根节点（tile / zone）的无障碍名称。
 * zone 用主文案而不是 hint —— 「支持 .toml」这种副文案充当按钮名称没有意义。
 */
const rootAriaLabel = computed(() =>
  isZone.value ? zoneTitle.value : (props.label ?? props.hint ?? props.text ?? '选择文件'),
);

function openPicker(): void {
  if (props.disabled) return;
  inputEl.value?.click();
}

/**
 * tile / zone 形态下整块可点。
 *
 * 必须排掉「点到隐藏 input 自身」这一次：input.click() 派发的 click 会冒泡回
 * 本节点，不排掉就是 openPicker → click → openPicker 的无限递归。
 */
function onRootClick(event: MouseEvent): void {
  if (!isRootClickable.value) return;
  if (event.target === inputEl.value) return;
  openPicker();
}

/** tile / zone 的根是 div，键盘可达性要自己补（原生 button 才有内置的 Enter / Space）。 */
function onRootKeydown(event: KeyboardEvent): void {
  if (!isRootClickable.value) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openPicker();
}

// webkitGetAsEntry 返回结构的最小声明：只声明用到的字段，避免 any。
interface EntryLike {
  isDirectory: boolean;
  name: string;
}
interface ItemLike {
  kind: string;
  webkitGetAsEntry?: () => EntryLike | null;
  getAsFile: () => File | null;
}

/** accept 判定。MIME 不匹配时回退到扩展名 —— Windows 上 .toml 的 type 常为空串。 */
function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return mime.startsWith(token.slice(0, -1));
    return mime === token;
  });
}

/**
 * 目录兜底判定（webkitGetAsEntry 不可用时才走到）。
 * 拖入目录时 type 为空、size 常为 0，且 name 不含扩展名。
 * 注意这会把「size 为 0 且无扩展名的空文件」误判为目录 —— 罕见，可接受。
 */
function looksLikeDirectory(file: File): boolean {
  return file.size === 0 && !file.type && !/\.[a-z0-9]+$/i.test(file.name);
}

function emitReject(info: RejectInfo): void {
  props.onReject?.(info);
}

/** 校验并派发：被拒绝的逐个 onReject，通过的合并成一次 onSelect。 */
function handleFiles(incoming: File[]): void {
  // 单选模式下只认第一个：input 在 multiple=false 时本就无法多选，
  // 但拖拽可能一次带进多个文件。
  const candidates = props.multiple ? incoming : incoming.slice(0, 1);
  const accepted: File[] = [];
  for (const file of candidates) {
    if (!matchesAccept(file, props.accept)) {
      emitReject({ file, reason: 'type' });
      continue;
    }
    if (props.maxSizeMb != null && file.size > props.maxSizeMb * 1024 * 1024) {
      emitReject({ file, reason: 'size' });
      continue;
    }
    accepted.push(file);
  }
  if (accepted.length) props.onSelect?.(accepted);
}

function onInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []);
  // 关键：立刻清空。否则连续两次选同一个文件时 change 不会再次触发，
  // 表现为「选同一个文件没反应」。每个实现都得记着写，漏了很难查。
  input.value = '';
  handleFiles(picked);
}

function onDragEnter(event: DragEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  dragDepth.value += 1;
}

function onDragOver(event: DragEvent): void {
  if (props.disabled) return;
  // 必须阻止默认行为，否则浏览器不触发 drop（会退化成「打开 / 下载文件」）。
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(): void {
  if (props.disabled) return;
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function onDrop(event: DragEvent): void {
  if (props.disabled) return;
  event.preventDefault();
  dragDepth.value = 0;

  const dt = event.dataTransfer;
  if (!dt) return;

  // 必须在事件处理内同步读完 DataTransfer —— 它是「活」对象，事件结束后会被清空。
  const files: File[] = [];
  const items = Array.from(dt.items ?? []).filter((i) => i.kind === 'file');

  if (items.length) {
    for (const raw of items) {
      const item = raw as unknown as ItemLike;
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const file = item.getAsFile() ?? new File([], entry.name);
        emitReject({ file, reason: 'directory' });
        continue;
      }
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  } else {
    // 极老浏览器没有 items，退回 files。
    files.push(...Array.from(dt.files ?? []));
  }

  // 再滤一道 webkitGetAsEntry 缺失时混进来的目录假文件。
  const real: File[] = [];
  for (const file of files) {
    if (looksLikeDirectory(file)) {
      emitReject({ file, reason: 'directory' });
      continue;
    }
    real.push(file);
  }
  handleFiles(real);
}
</script>
