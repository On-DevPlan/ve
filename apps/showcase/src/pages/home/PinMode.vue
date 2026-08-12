<script setup lang="ts">
/* eslint-disable vue/no-v-html -- 3 处 v-html 都调用 iconSvgOf(),
 * 该函数返回的 SVG 来自内部 STROKE_ICONS map 或硬编码 fallback,
 * 完全不拼接用户输入,XSS 风险为 0。逐处加 disable-next-line
 * 会让模板缩进被 Vue parser 当作 attribute 拆掉,所以走块级禁用。 */
// PinMode.vue —— Pin 模式(完全对齐 desktop-preview.html 的 icon 桌面风 + 完整拖拽)
//
// 职责(对齐 preview):
//   1) 顶栏(品牌 + 搜索 + 主题 + 背景 + 鉴权)与 preview 一致
//   2) 主区:store.pinnedNodes 渲染为 .icon tile(icon 单格,folder 拼合 2x2)
//   3) 每个 tile 右上角 ★(点击 = 取消 pin / 拖出 folder)
//   4) 原生 HTML5 drag + FLIP 让位 + 合并手势(完全照搬 preview 逻辑)
//   5) 点击 icon tile → router.push;点击 folder tile → 在原地展开(Phase 2 TODO)
//   6) 搜索词本地过滤
//   7) section-tag "Workspace" + meta "X APPS"
//
// 与 ClassicMode 的区别:
//   - 数据源:store.pinnedNodes(支持 folder 嵌套),不是单纯 entryId 集合
//   - 无 sidebar,直接桌面式 .icon tile
//   - 拖拽完整(原生 drag + FLIP + 合并),ClassicMode 不需要

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRegistry } from '../../composables/useRegistry';
import { useDesktopStore, THEMES, type ThemeId, type DisplayMode, type PinnedNode, type FileInfo } from '../../composables/useDesktopStore';
import { jwtAuth } from '@/api/http/auth-store';
import { useLoginModalState } from '@/shared/useLoginModal';

const ANIM_MS = 180;
const ANIM_EASE = 'cubic-bezier(.2, 1.2, .4, 1)';
const MERGE_RATIO = 0.35;

const router = useRouter();
const registry = useRegistry();
const store = useDesktopStore();
const { open: openLogin } = useLoginModalState();
const jwtState = computed(() => jwtAuth.state);

const rootEl = ref<HTMLElement | null>(null);

const q = ref('');
const grid = ref<HTMLElement | null>(null);

// 主题色 → 应用到 rootEl 的局部 CSS 变量(只影响 PinMode,不污染 :root)
function applyLocalTheme(id: string) {
  const t = THEMES.find(x => x.id === id);
  if (!t || !rootEl.value) return;
  rootEl.value.style.setProperty('--tile-border', t.border);
  rootEl.value.style.setProperty('--tile-border-hover', t.hover);
  rootEl.value.style.setProperty('--tile-bg', t.bg);
  rootEl.value.style.setProperty('--tile-bg-hover', t.hover);
}
watch(() => store.theme.value, applyLocalTheme, { immediate: true });
onMounted(() => applyLocalTheme(store.theme.value));

/* ---- 背景图 → 应用到 rootEl(.pin-mode 的 scoped 容器)----
   之前 store.applyBg 写到 documentElement.style + body.classList,
   污染全局 :root;现在移到 PinMode 自己的容器,ClassicMode 不受影响。*/
function applyLocalBg(info: FileInfo | null) {
  if (!rootEl.value) return;
  if (info) {
    rootEl.value.style.setProperty('--custom-bg', `url("${info.url}")`);
    rootEl.value.classList.add('has-bg');
  } else {
    rootEl.value.style.removeProperty('--custom-bg');
    rootEl.value.classList.remove('has-bg');
  }
}
watch(() => store.bgFile.value, applyLocalBg, { immediate: true });
onMounted(() => applyLocalBg(store.bgFile.value));
// 卸载时清掉,避免 KeepAlive 缓存里残留旧 URL / 类名
onBeforeUnmount(() => applyLocalBg(null));

/* ---- 搜索过滤(递归,folder 内的 entry 也参与匹配)---- */
// Pin 页面渲染源:
//   1) desktop_layout(用户拖拽整理过的布局,含 folder)
//   2) 补上 desktop_pins 里所有「未出现在 layout」的 id(保证全部收藏都可见)
//   3) layout 为空 → 从 desktop_pins 纯 id 推导
//   layout 已被 store 消毒过(只含 pinned 成员),所以不会显示未收藏的
const displayNodes = computed<PinnedNode[]>(() => {
  const layout = store.pinnedNodes.value;
  const pinnedIds = store.pinned.value;  // Set<string>
  if (layout.length === 0) {
    return [...pinnedIds].map(id => ({ kind: 'icon' as const, entryId: id }));
  }
  // 收集 layout 里已有的 entryId
  const inLayout = new Set<string>();
  (function collect(nodes: PinnedNode[]) {
    for (const n of nodes) {
      if (n.kind === 'icon') inLayout.add(n.entryId);
      else collect(n.children);
    }
  })(layout);
  // 补:未出现在 layout 的 pinned entry
  const extra = [...pinnedIds].filter(id => !inLayout.has(id)).map(id => ({ kind: 'icon' as const, entryId: id }));
  return [...layout, ...extra];
});

const visibleNodes = computed<PinnedNode[]>(() => {
  const term = q.value.trim().toLowerCase();
  const list = displayNodes.value;
  if (!term) return list;
  function match(n: PinnedNode): boolean {
    if (n.kind === 'icon') {
      const e = registry.get(n.entryId);
      if (!e) return false;
      return (e.name + ' ' + e.title + ' ' + e.group + ' ' + e.framework).toLowerCase().includes(term);
    }
    return n.name.toLowerCase().includes(term) || n.children.some(match);
  }
  return list.filter(match);
});

const totalApps = computed(() => {
  function count(n: PinnedNode): number {
    if (n.kind === 'icon') return 1;
    return n.children.reduce((acc, c) => acc + count(c), 0);
  }
  return displayNodes.value.reduce((acc, n) => acc + count(n), 0);
});

/* ---- 点击 tile ---- */
function onTileClick(n: PinnedNode) {
  if (n.kind === 'icon') {
    const e = registry.get(n.entryId);
    if (e) router.push(e.route.path);
  } else {
    // 打开文件夹 modal
    openFolderId.value = n.id;
  }
}

/* ---- 文件夹 modal ---- */
// 当前打开的 folder id(null = 关闭);modal 展示其 children(全为 icon,防嵌套)
const openFolderId = ref<string | null>(null);
const openFolder = computed(() =>
  store.pinnedNodes.value.find(n => n.kind === 'folder' && n.id === openFolderId.value) ?? null
);
const modalGrid = ref<HTMLElement | null>(null);
function closeFolder() { openFolderId.value = null; }

// Esc 关闭 modal
onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown);
});
/* ---- 文件夹重命名 ---- */
// 当前正在编辑的 folder id(null = 无编辑中)。双击 folder tile 进入编辑态,
// label 替换为 input,失焦/Enter 保存,Esc 取消(还原原名)。
const renamingId = ref<string | null>(null);
const renameDraft = ref('');
const renameInput = ref<HTMLInputElement | null>(null);

function startRename(folder: PinnedNode) {
  if (folder.kind !== 'folder') return;
  renamingId.value = folder.id;
  renameDraft.value = nameOf(folder);
  // 下一帧聚焦 + 全选
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}
function commitRename() {
  if (!renamingId.value) return;
  store.renameFolder(renamingId.value, renameDraft.value);
  renamingId.value = null;
}
function cancelRename() {
  renamingId.value = null;
}

/** Esc 处理:modal 关闭优先;否则取消重命名 */
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (renamingId.value) { cancelRename(); return; }
    if (openFolderId.value) { closeFolder(); return; }
  }
}

/** modal 内拖拽源:基于 openFolder.children 查找(icon 在 folder 内,不在 visibleNodes) */
function findModalNodeById(id: string): PinnedNode | null {
  if (!openFolder.value) return null;
  return openFolder.value.children.find(n => nodeIdOf(n) === id) ?? null;
}

/** folder 右键菜单:阻止默认 + 打开 modal + 立即进入重命名 */
function onTileContextMenu(e: MouseEvent, n: PinnedNode) {
  if (n.kind !== 'folder') return;     // icon 不处理(让浏览器菜单继续)
  e.preventDefault();
  openFolderId.value = n.id;
  startRename(n);
}


/* ---- 派生 ---- */
function nameOf(n: PinnedNode): string {
  if (n.kind === 'icon') return registry.get(n.entryId)?.name ?? '?';
  return n.name;
}
function subOf(n: PinnedNode): string {
  if (n.kind === 'icon') return registry.get(n.entryId)?.framework ?? '';
  return `${n.children.length} APPS`;
}
function iconSvgOf(n: PinnedNode): string {
  if (n.kind === 'icon') {
    const e = registry.get(n.entryId);
    return e ? iconSvg(e.name) : iconSvg('__default__');
  }
  return iconSvg('__folder__');
}
function iconSvg(name: string): string {
  const inner = STROKE_ICONS[name] || `<rect x="6" y="6" width="12" height="12" rx="1"/>`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function isFolder(n: PinnedNode): boolean { return n.kind === 'folder'; }

/* ---- 顶栏交互(同 ClassicMode)---- */
function setTheme(id: ThemeId) { store.applyTheme(id); }
const bgInput = ref<HTMLInputElement | null>(null);
function pickBg() {
  if (store.bgFile.value) { store.setBg(null); flash('背景已清除'); return; }
  bgInput.value?.click();
}
function onBgFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { flash('请选择图片'); return; }
  // 直接传 Blob 给 store —— store 内部走 fileV1Service.upload(tags=['bg']),
  // 不再 FileReader.readAsDataURL(base64 走 KV 太重)。
  store.setBg(file).then(() => flash('背景已应用'))
    .catch(err => { console.error(err); flash('背景上传失败'); });
  (e.target as HTMLInputElement).value = '';
}
function setMode(m: DisplayMode) { store.setMode(m); }
function logout() { jwtAuth.logout(); }

/* ---- hint ---- */
const hintText = ref('');
let hintTimer: number | undefined;
function flash(msg: string) {
  hintText.value = msg;
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => { hintText.value = ''; }, 1400);
}

/* ============================================================
   拖拽(完全照搬 preview 逻辑:原生 HTML5 drag + FLIP 让位 + 合并手势)
   ============================================================ */
const STROKE_ICONS: Record<string, string> = {
  Button: `<path d="M8 12h8M12 8v8"/><rect x="4" y="6" width="16" height="12" rx="1.5"/>`,
  Icon:   `<circle cx="12" cy="12" r="6"/><path d="M12 8v8M8 12h8"/>`,
  Toggle: `<rect x="3" y="9" width="18" height="6" rx="3"/><circle cx="8" cy="12" r="2.5"/>`,
  Input:  `<rect x="4" y="9" width="16" height="6" rx="1"/><path d="M7 12h4"/>`,
  Card:   `<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 11h16M8 14h4"/>`,
  Modal:  `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>`,
  Tabs:   `<path d="M4 7h6l2 2h8v8H4z"/><path d="M4 11h16"/>`,
  Alert:  `<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 16v.5"/>`,
  Toast:  `<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M8 11h8M8 14h5"/>`,
  Tooltip: `<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M9 16l3 3 3-3"/>`,
};

// 透明 drag image(关闭浏览器默认 ghost);只创建一次,避免重复 append
const ghost = (() => {
  const existing = document.body.querySelector('.drag-ghost');
  if (existing) return existing as HTMLElement;
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  g.style.cssText = 'position:fixed;top:0;left:0;width:168px;pointer-events:none;z-index:9999;visibility:hidden;opacity:0;';
  document.body.appendChild(g);
  return g;
})();

let drag: null | {
  el: HTMLElement;
  nodeId: string;       // PinnedNode 的唯一 id(icon: 'i_<entryId>' 或 folder: folder.id)
  lastTarget: HTMLElement | null;
} = null;

function nodeIdOf(n: PinnedNode): string {
  return n.kind === 'icon' ? `i_${n.entryId}` : n.id;
}

/**
 * 把 DOM 上的 nodeId(`i_<entryId>` / `pf_<seq>`)转成 store 用的 entryId 或 folder.id。
 * store.findPinned 用 entryId 查 icon,用 folder.id 查 folder。
 * PinMode 与 store 的 id 协议不一致(预防 silent fail):PinMode 的 data-id 是 nodeIdOf,
 * store 的 findPinned 是 entryId / folder.id,所以调用 store 前必须 strip 掉 `i_` 前缀。
 */
function toStoreId(nodeId: string, kind: 'icon' | 'folder'): string {
  if (kind === 'icon') return nodeId.startsWith('i_') ? nodeId.slice(2) : nodeId;
  return nodeId;
}

/** 从 visibleNodes 里取节点 + 判断 kind(给 store 调用用) */
function findNodeByDomId(id: string): { node: PinnedNode; kind: 'icon' | 'folder' } | null {
  const n = visibleNodes.value.find(x => nodeIdOf(x) === id);
  if (!n) return null;
  return { node: n, kind: n.kind };
}

function onDragStart(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  const node = visibleNodes.value.find(n => nodeIdOf(n) === el.dataset.id);
  if (!node) { e.preventDefault(); return; }
  el.classList.add('is-source');
  document.body.classList.add('is-dragging');
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', nodeIdOf(node));
  try {
    e.dataTransfer!.setDragImage(ghost, 0, 0);
  } catch {
    // setDragImage can throw on Safari with detached DOM; ghost is optional,
    // drag still works without a custom image, so swallow.
  }
  drag = { el, nodeId: nodeIdOf(node), lastTarget: null };
}

function onDragOver(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  if (!drag || el === drag.el) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  const r = el.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const inside = Math.abs(dx) < r.width * MERGE_RATIO;
  if (inside) {
    if (drag.lastTarget && drag.lastTarget !== el) drag.lastTarget.classList.remove('is-drop-target');
    el.classList.add('is-drop-target');
    drag.lastTarget = el;
  } else {
    if (drag.lastTarget) drag.lastTarget.classList.remove('is-drop-target');
    drag.lastTarget = null;
    // FLIP:insertBefore 到 beforeId 之前 + animateAll
    if (grid.value) {
      const fromRects = captureRects(grid.value);
      const after = dx > 0;
      const afterNode = after ? el.nextSibling : null;
      grid.value.insertBefore(drag.el, afterNode || el);
      animateAll(grid.value, fromRects);
    }
  }
}

function onDragLeave() {
  // 不立即清(子元素切换会触发)
}

function onDrop(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  if (!drag) return;
  e.preventDefault();
  e.stopPropagation();
  el.classList.remove('is-drop-target');
  const r = el.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const inside = Math.abs(dx) < r.width * MERGE_RATIO;
  if (inside) {
    // 合并 / 加入文件夹
    const srcDomId = drag.nodeId;        // DOM nodeId 形态
    const dstDomId = el.dataset.id!;
    const srcInfo = findNodeByDomId(srcDomId);
    const dstInfo = findNodeByDomId(dstDomId);
    if (!srcInfo || !dstInfo) return;
    const srcId = toStoreId(srcDomId, srcInfo.kind);  // 转 entryId / folder.id
    const dstId = toStoreId(dstDomId, dstInfo.kind);
    if (srcId === dstId) return;
    if (dstInfo.node.kind === 'folder') {
      store.movePinnedNode(srcId, dstId, null);
      flash('已加入文件夹');
    } else if (dstInfo.node.kind === 'icon' && srcInfo.node.kind === 'icon') {
      store.mergePinnedNodes(srcId, dstId);
      flash('已合并');
    }
  } else {
    // 重排:由 dragover insertBefore 已处理,DOM 已到位;这里同步 state
    syncPinOrderFromDom();
  }
  drag.el.classList.remove('is-source');
  document.body.classList.remove('is-dragging');
  drag = null;
}

function onDragEnd() {
  if (!drag) return;
  drag.el.classList.remove('is-source');
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.icon.is-drop-target').forEach(n => n.classList.remove('is-drop-target'));
  drag = null;
}

/* ============================================================
   Modal 内拖拽(folder 内排序 + 拖到 modal 外移出到主桌面)
   复用 ghost / captureRects / animateAll;drag 单例共用。
   modal 内只渲染 icon(防嵌套),所以不做合并手势,只做排序。
   ============================================================ */
function onModalDragStart(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  const node = findModalNodeById(el.dataset.id ?? '');
  if (!node) { e.preventDefault(); return; }
  el.classList.add('is-source');
  document.body.classList.add('is-dragging');
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', nodeIdOf(node));
  try {
    e.dataTransfer!.setDragImage(ghost, 0, 0);
  } catch {
    // setDragImage can throw on Safari with detached DOM; ghost is optional,
    // drag still works without a custom image, so swallow.
  }
  drag = { el, nodeId: nodeIdOf(node), lastTarget: null };
}

/** modal 内 tile 之间 dragover:FLIP 让位(不做合并,folder 内不能嵌套) */
function onModalDragOver(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  if (!drag || el === drag.el) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  if (!modalGrid.value) return;
  const r = el.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const fromRects = captureRects(modalGrid.value);
  modalGrid.value.insertBefore(drag.el, dx > 0 ? el.nextSibling : el);
  animateAll(modalGrid.value, fromRects);
}

/** modal 内 drop:按 DOM 顺序把 folder.children 重排回 store */
function onModalDrop(e: DragEvent) {
  if (!drag) return;
  e.preventDefault();
  e.stopPropagation();
  syncFolderOrderFromDom();
  cleanupDrag();
}

/** 把 modal grid 的 DOM 顺序同步回 folder.children */
function syncFolderOrderFromDom() {
  const folder = openFolder.value;
  if (!folder || !modalGrid.value) return;
  const ids = [...modalGrid.value.querySelectorAll('.icon')].map(n => (n as HTMLElement).dataset.id);
  const byId = new Map(folder.children.map(n => [nodeIdOf(n), n]));
  const reordered: PinnedNode[] = [];
  for (const id of ids) {
    const n = byId.get(id ?? '');
    if (n) { reordered.push(n); byId.delete(id ?? ''); }
  }
  for (const n of byId.values()) reordered.push(n);  // 兜底
  store.reorderFolderChildren(folder.id, reordered);
}

/** 拖到 modal 面板外(遮罩)→ 移出 folder 到主桌面顶层末尾 */
function onOverlayDragOver(e: DragEvent) {
  if (!drag) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
}
function onOverlayDrop(e: DragEvent) {
  if (!drag) return;
  e.preventDefault();
  e.stopPropagation();
  const node = findModalNodeById(drag.nodeId);
  if (node && node.kind === 'icon') {
    // targetFolderId=null → 移到顶层;beforeId=null → 末尾
    store.movePinnedNode(node.entryId, null, null);
    flash('已移出到桌面');
    closeFolder();
  }
  cleanupDrag();
}

function cleanupDrag() {
  if (!drag) return;
  drag.el.classList.remove('is-source');
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.icon.is-drop-target').forEach(n => n.classList.remove('is-drop-target'));
  drag = null;
}

/** 重排后把 grid DOM 顺序同步回 store.pinnedNodes(顶层顺序) */
function syncPinOrderFromDom() {
  if (!grid.value) return;
  const ids = [...grid.value.querySelectorAll('.icon')]
    .map(n => (n as HTMLElement).dataset.id ?? '')
    .filter(Boolean);
  store.reorderTopLevel(ids);
}

function captureRects(scope: HTMLElement): Map<HTMLElement, DOMRect> {
  const map = new Map<HTMLElement, DOMRect>();
  scope.querySelectorAll('.icon').forEach(n => {
    if (n === drag?.el) return;
    map.set(n as HTMLElement, (n as HTMLElement).getBoundingClientRect());
  });
  return map;
}

function animateAll(scope: HTMLElement, fromRects: Map<HTMLElement, DOMRect>) {
  scope.querySelectorAll('.icon').forEach(n => {
    const el = n as HTMLElement;
    if (el === drag?.el) return;
    const from = fromRects.get(el);
    if (!from) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    // Force a synchronous layout flush so the transform above is committed
    // before we transition back. Reading offsetWidth blocks until the next
    // style/layout pass; this is the standard FLIP technique.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth;
    el.style.transition = `transform ${ANIM_MS}ms ${ANIM_EASE}`;
    el.style.transform = 'translate3d(0,0,0)';
    setTimeout(() => {
      el.style.transition = '';
      el.style.transform = '';
    }, ANIM_MS + 20);
  });
}

/* ---- 挂载时给所有 .icon 绑拖拽事件(简单 onMounted 重新绑)---- */
onMounted(() => {
  // 实际拖拽事件在模板里 @dragstart 等直接绑(见 template)
});
</script>

<template>
  <div
    ref="rootEl"
    class="pin-mode"
  >
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        wb / showcase
        <small>Style Library — 2026</small>
      </div>

      <div class="search-wrap">
        <label class="search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
            /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            v-model="q"
            type="text"
            placeholder="搜索已 pin 的组件…"
            autocomplete="off"
          >
          <kbd>⌘ K</kbd>
        </label>
      </div>

      <div class="topbar__right">
        <div
          class="theme-picker"
          title="切换主题色"
        >
          <div
            v-for="t in THEMES"
            :key="t.id"
            class="theme-picker__dot"
            :class="{ 'is-active': store.theme.value === t.id }"
            :style="{ background: t.border }"
            :title="t.name"
            @click="setTheme(t.id)"
          />
        </div>
        <button
          class="bg-btn"
          :class="{ 'has-bg': !!store.bgFile.value }"
          @click="pickBg"
        >
          {{ store.bgFile.value ? '清除背景' : '背景' }}
        </button>
        <input
          ref="bgInput"
          type="file"
          accept="image/*"
          hidden
          @change="onBgFile"
        >
        <button
          class="mode-btn"
          title="切回经典(sidebar)模式"
          @click="setMode('classic')"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
            /><rect
              x="14"
              y="3"
              width="7"
              height="7"
            />
            <rect
              x="3"
              y="14"
              width="7"
              height="7"
            /><rect
              x="14"
              y="14"
              width="7"
              height="7"
            />
          </svg>
          经典
        </button>
        <div class="auth">
          <template v-if="jwtState.token">
            <span class="auth__user">{{ jwtState.jwtUser?.email }}</span>
            <button
              class="auth__btn"
              @click="logout"
            >
              退出
            </button>
          </template>
          <button
            v-else
            class="auth__btn"
            @click="openLogin"
          >
            登录
          </button>
        </div>
      </div>
    </header>

    <!-- 主区 -->
    <main class="desktop">
      <div class="section-tag">
        Workspace · Pinned
      </div>
      <section
        ref="grid"
        class="grid"
      >
        <div
          v-for="n in visibleNodes"
          :key="nodeIdOf(n)"
          :data-id="nodeIdOf(n)"
          class="icon"
          :class="{ 'icon--folder': isFolder(n) }"
          draggable="true"
          @click="onTileClick(n)"
          @contextmenu="onTileContextMenu($event, n)"
          @dragstart="onDragStart"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @dragend="onDragEnd"
        >
          <div class="icon__art">
            <!-- folder:2×2 拼合 -->
            <template v-if="n.kind === 'folder'">
              <div
                v-for="(child, i) in n.children.slice(0, 4)"
                :key="i"
                class="piece"
                v-html="iconSvgOf(child)"
              />
              <div
                v-if="n.children.length > 4"
                class="piece is-overflow"
              >
                +{{ n.children.length - 4 }}
              </div>
            </template>
            <!-- solo icon:用 entry 名作为 SVG key(用 name 字段而非 title) -->
            <template v-else>
              <!-- v-html 由 script 顶部 eslint-disable vue/no-v-html 统一禁用,
                   见 iconSvgOf() 注释:返回的 SVG 来自内部 STROKE_ICONS,
                   不拼接用户输入。 -->
              <div v-html="iconSvgOf(n)" />
            </template>

            <!-- ★ 取消 pin 按钮:Pin 模式不提供此入口(请到 Classic 模式 ★ 取消) -->
          </div>
          <div class="icon__label">
            {{ nameOf(n) }}
          </div>
          <div class="icon__sub">
            {{ subOf(n) }}
          </div>
        </div>

        <div
          v-if="!visibleNodes.length"
          class="empty"
        >
          <template v-if="!store.pinnedNodes.value.length">
            还没有 pin 的组件 — 切到 <b>经典</b> 模式,点击卡片右下角 ★ 收藏
          </template>
          <template v-else>
            没有匹配 "{{ q }}" 的 pin 组件
          </template>
        </div>
      </section>
      <div class="meta">
        {{ visibleNodes.length }} NODES · {{ totalApps }} APPS
      </div>
    </main>

    <!-- 文件夹 modal:展示 folder 内组件;面板内拖拽排序,拖到面板外移出到主桌面 -->
    <Transition name="folder-fade">
      <div
        v-if="openFolder"
        class="folder-overlay"
        @dragover.prevent="onOverlayDragOver"
        @drop.prevent="onOverlayDrop"
        @click.self="closeFolder"
      >
        <div class="folder-modal">
          <header class="folder-modal__head">
            <h3
              class="folder-modal__title"
              :title="'双击重命名'"
              @dblclick="startRename(openFolder)"
            >
              <template v-if="renamingId === openFolder.id">
                <input
                  ref="renameInput"
                  v-model="renameDraft"
                  class="folder-modal__rename-input"
                  type="text"
                  maxlength="24"
                  @click.stop
                  @dblclick.stop
                  @keydown.enter.stop.prevent="commitRename()"
                  @keydown.esc.stop.prevent="cancelRename()"
                  @blur="commitRename()"
                >
              </template>
              <template v-else>
                {{ openFolder.name }}
              </template>
            </h3>
            <span class="folder-modal__count">{{ openFolder.children.length }} APPS</span>
            <button
              class="folder-modal__close"
              title="关闭 (Esc)"
              @click="closeFolder"
            >
              ×
            </button>
          </header>
          <section
            ref="modalGrid"
            class="folder-modal__grid"
          >
            <div
              v-for="c in openFolder.children"
              :key="nodeIdOf(c)"
              :data-id="nodeIdOf(c)"
              class="icon folder-modal__tile"
              draggable="true"
              @click="onTileClick(c)"
              @dragstart="onModalDragStart"
              @dragover="onModalDragOver"
              @drop="onModalDrop"
              @dragend="cleanupDrag"
            >
              <div
                class="icon__art"
                v-html="iconSvgOf(c)"
              />
              <div class="icon__label">
                {{ nameOf(c) }}
              </div>
              <div class="icon__sub">
                {{ subOf(c) }}
              </div>
            </div>
            <p
              v-if="!openFolder.children.length"
              class="folder-modal__empty"
            >
              文件夹是空的
            </p>
          </section>
          <footer class="folder-modal__foot">
            拖动排序 · 拖到窗外移出到桌面
          </footer>
        </div>
      </div>
    </Transition>

    <div
      class="hint"
      :class="{ 'is-on': !!hintText }"
    >
      {{ hintText }}
    </div>
  </div>
</template>

<style scoped>
/* PinMode 样式(对齐 preview:同 .icon / .icon__art / .icon__label 等) */
.pin-mode {
  --ink: #111;
  --ink-soft: #555;
  --ink-mute: #999;
  --line: #e8e8e8;
  --hover: rgba(255, 255, 255, 0.72);
  --tile: 168px;
  --tile-radius: 22px;
  --spring: cubic-bezier(.2, 1.4, .4, 1);
  --ease: cubic-bezier(.2, .7, .2, 1);

  font-family: -apple-system, system-ui, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--ink);
  min-height: 100vh;
}

/* 背景图:scoped 在 .pin-mode 内,只对当前 PinMode 生效。
   之前 --custom-bg 是 store 写到 :root,污染全局;现在由 PinMode 写到
   自己的 rootEl,这里就近消费 —— 切回 ClassicMode 时,PinMode 卸载
   (KeepAlive 缓存),bg 也不会泄漏。 */
.pin-mode.has-bg {
  background-image: var(--custom-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

/* 顶栏(对齐 preview) */
.topbar {
  position: sticky; top: 0; z-index: 20;
  display: grid;
  grid-template-columns: 320px 1fr 500px;
  align-items: center; gap: 24px;
  padding: 18px 36px;
  background: var(--tile-bg, rgba(255, 255, 255, 0.65));
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  backdrop-filter: blur(22px) saturate(160%);
  border-bottom: 1px solid var(--tile-border, var(--line));
}
.brand {
  font-family: 'Songti SC', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
  font-size: 26px; font-weight: 500; letter-spacing: -0.01em; line-height: 1;
}
.brand small {
  display: block;
  font-family: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 9px; letter-spacing: 0.24em; color: var(--ink-mute);
  margin-top: 6px; text-transform: uppercase;
}
.search-wrap { display: flex; justify-content: center; }
.search {
  display: flex; align-items: center; gap: 10px;
  width: 100%; max-width: 520px;
  padding: 10px 14px;
  border: 1px solid var(--line); border-radius: 2px;
  background: rgba(255, 255, 255, .55);
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.search:focus-within {
  border-color: var(--ink); background: #fff;
  box-shadow: 0 6px 24px -18px rgba(0,0,0,.25);
}
.search svg { color: var(--ink-mute); flex-shrink: 0; }
.search input {
  flex: 1; border: none; outline: none; background: transparent;
  font: 14px -apple-system, system-ui, 'PingFang SC', sans-serif;
  color: var(--ink);
}
.search input::placeholder { color: var(--ink-mute); }
.search kbd {
  font-family: ui-monospace, monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--ink-mute); border: 1px solid var(--line);
  border-radius: 2px; padding: 1px 6px; background: #fff;
}
.topbar__right {
  display: flex; justify-content: flex-end; align-items: center; gap: 12px;
}
.theme-picker {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--line); border-radius: 2px;
}
.theme-picker__dot {
  width: 14px; height: 14px; border-radius: 50%;
  border: 1px solid var(--line);
  cursor: pointer;
  transition: transform .15s var(--ease), border-color .15s var(--ease);
}
.theme-picker__dot:hover { transform: scale(1.15); }
.theme-picker__dot.is-active { border-color: var(--ink); border-width: 2px; }
.bg-btn {
  font-family: ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 6px 12px;
  border: 1px solid var(--line); border-radius: 2px;
  background: transparent; color: var(--ink-soft); cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}
.bg-btn:hover { border-color: var(--tile-border-hover, var(--ink)); color: var(--ink); }
.bg-btn.has-bg { border-color: var(--tile-border, var(--ink)); color: var(--ink); }
.mode-btn {
  font-family: ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 6px 12px;
  border: 1px solid var(--line); border-radius: 2px;
  background: transparent; color: var(--ink-soft); cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  transition: border-color .15s, color .15s, background .15s;
}
.mode-btn:hover { border-color: var(--ink); color: var(--ink); background: var(--hover); }
.mode-btn.is-active { background: var(--ink); color: #fff; }
.auth {
  display: flex; align-items: center; gap: 8px;
  font-family: ui-monospace, monospace; font-size: 11px;
}
.auth__user { color: var(--ink-mute); }
.auth__btn {
  font-family: inherit; font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 12px; border: 1px solid var(--line); border-radius: 2px;
  background: transparent; color: var(--ink-soft); cursor: pointer;
}
.auth__btn:hover { border-color: var(--ink); color: var(--ink); }

/* 主区 */
.desktop { padding: 56px 56px 96px; min-height: calc(100vh - 70px); }
.section-tag {
  font-family: ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-mute);
  margin: 32px 0 18px;
}
.section-tag::before { content: "— "; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--tile));
  gap: 44px 36px;
  justify-content: start;
  min-height: 80px;
}

.meta {
  margin-top: 32px;
  font-family: ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-mute);
}

/* icon / tile */
.icon {
  width: var(--tile);
  cursor: grab;
  user-select: none;
  -webkit-user-drag: element;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 6px 4px;
  border: 1px solid transparent; border-radius: 8px;
  transition:
    transform .25s var(--spring),
    background .15s var(--ease),
    border-color .15s var(--ease);
  will-change: transform, opacity;
  position: relative;
}
.icon:hover {
  background: var(--hover);   /* 外层 tile:中性浅色(与 preview 一致) */
  border-color: var(--line);
}
.icon:active { cursor: grabbing; }
.icon__art {
  width: var(--tile); height: var(--tile);
  background: var(--tile-bg, rgba(255, 255, 255, 0.85));
  border: 2px solid var(--tile-border, var(--line));
  border-radius: var(--tile-radius);
  display: flex; align-items: center; justify-content: center;
  color: var(--ink);
  transition: border-color .15s var(--ease), background .15s var(--ease), box-shadow .25s var(--ease);
  position: relative;
}
.icon:hover .icon__art {
  background: var(--tile-bg-hover, var(--tile-bg, rgba(255, 255, 255, 0.85)));
  border-color: var(--tile-border-hover, var(--tile-border, var(--line)));
  box-shadow: 0 16px 36px -28px rgba(0,0,0,.35);
}
.icon__art svg { width: 64px; height: 64px; color: var(--ink); }
.icon__label {
  font-family: 'Songti SC', Georgia, serif;
  font-size: 16px; font-weight: 500;
  text-align: center; line-height: 1.15; color: var(--ink);
  max-width: var(--tile);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.icon__sub {
  font-family: ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--ink-mute);
}

/* folder 拼合 2×2 */
.icon--folder .icon__art {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 6px;
}
.icon--folder .icon__art > .piece {
  border-radius: 12px;
  background: rgba(255,255,255,.65);
  border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
  color: var(--ink);
}
.icon--folder .icon__art > .piece svg { width: 28px; height: 28px; }
.icon--folder .icon__art > .piece.is-overflow {
  background: var(--paper);
  font-family: ui-monospace, monospace; font-size: 14px;
  font-weight: 500; color: var(--ink);
}

/* Pin 模式不提供 ★ 按钮(取消 pin 请到 Classic 模式) */

/* 拖拽态(对齐 preview) */
/* 拖拽中 body 不接受文本选择;cursor 用 grabbing(与 preview 一致) */
:global(body.is-dragging) { user-select: none; cursor: grabbing; }
:global(body.is-dragging .icon:not(.is-source)) { cursor: inherit; }

/* 拖拽态(与 preview 完全一致) */
.icon.is-source { opacity: 0.35; transform: scale(.96); }
.icon.is-source .icon__art {
  background: transparent;
  border-style: dashed;
  border-color: var(--ink-mute);   /* 与 preview 一致:虚线灰边 */
}
.icon.is-drop-target .icon__art {
  border-color: var(--drop-border, #2563eb);
  border-width: 3px;
  background: var(--drop-bg, rgba(37, 99, 235, 0.06));
  transform: scale(1.06);
}
.icon--folder.is-drop-target .icon__art > .piece { transform: scale(0.95); }

/* 空状态 */
.empty {
  grid-column: 1 / -1;
  margin-top: 80px; text-align: center;
  color: var(--ink-mute);
  font-family: 'Songti SC', Georgia, serif;
  font-size: 22px; font-style: italic;
}
.empty b { font-style: normal; color: var(--ink); }

/* ============================================================
   文件夹 modal
   ============================================================ */
.folder-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 24px;
  background: rgba(20, 18, 16, .32);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.folder-modal {
  width: min(760px, 100%);
  max-height: min(76vh, 720px);
  display: flex; flex-direction: column;
  background: var(--tile-bg, #fff);
  border: 2px solid var(--tile-border, var(--line));
  border-radius: 24px;
  box-shadow: 0 40px 90px -50px rgba(0, 0, 0, .55);
  overflow: hidden;
}
.folder-modal__head {
  display: flex; align-items: center; gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--tile-border, var(--line));
}
.folder-modal__title {
  margin: 0;
  font-family: 'Songti SC', Georgia, serif;
  font-size: 22px; font-weight: 500; letter-spacing: -0.01em;
  color: var(--ink);
}
.folder-modal__count {
  font-family: ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--ink-mute);
}
.folder-modal__close {
  margin-left: auto;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; line-height: 1;
  border: 1px solid transparent; border-radius: 50%;
  background: transparent; color: var(--ink-mute); cursor: pointer;
  transition: color .15s, background .15s, border-color .15s;
}
.folder-modal__close:hover {
  color: var(--ink); background: var(--hover);
  border-color: var(--tile-border, var(--line));
}
.folder-modal__title { cursor: text; }
.folder-modal__title:hover { color: var(--ink-soft); }
.folder-modal__rename-input {
  font: inherit; color: inherit; letter-spacing: inherit;
  background: #fff;
  border: 1px solid var(--tile-border, var(--line));
  border-radius: 4px;
  padding: 2px 8px;
  width: 220px; max-width: 100%;
  outline: none;
  font-family: 'Songti SC', Georgia, serif;
  font-size: 22px; font-weight: 500;
}
.folder-modal__rename-input:focus {
  border-color: var(--ink);
}
.folder-modal__grid {
  flex: 1; overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 116px);
  gap: 28px 24px;
  justify-content: start;
  align-content: start;
  padding: 28px 24px;
  min-height: 140px;
}
/* modal 内 tile:比桌面小一号 */
.folder-modal__tile { width: 116px; }
.folder-modal__tile .icon__art {
  width: 116px; height: 116px;
  border-radius: 18px;
}
.folder-modal__tile .icon__art :deep(svg),
.folder-modal__tile .icon__art svg { width: 46px; height: 46px; }
.folder-modal__tile .icon__label { font-size: 14px; max-width: 116px; }
.folder-modal__empty {
  grid-column: 1 / -1;
  margin: 32px 0; text-align: center;
  font-family: 'Songti SC', Georgia, serif;
  font-size: 18px; font-style: italic;
  color: var(--ink-mute);
}
.folder-modal__foot {
  padding: 12px 24px 16px;
  border-top: 1px solid var(--tile-border, var(--line));
  font-family: ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--ink-mute); text-align: center;
}

/* modal 进出场 */
.folder-fade-enter-active,
.folder-fade-leave-active { transition: opacity .2s var(--ease); }
.folder-fade-enter-from,
.folder-fade-leave-to { opacity: 0; }
.folder-fade-enter-active .folder-modal,
.folder-fade-leave-active .folder-modal { transition: transform .22s var(--spring); }
.folder-fade-enter-from .folder-modal,
.folder-fade-leave-to .folder-modal { transform: scale(.94) translateY(8px); }

/* hint */
.hint {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  z-index: 60;
  padding: 10px 16px;
  background: var(--ink); color: #fff;
  font-family: ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  border-radius: 2px;
  opacity: 0; pointer-events: none;
  transition: opacity .2s var(--ease), transform .2s var(--ease);
}
.hint.is-on { opacity: 1; transform: translateX(-50%) translateY(-4px); }

@media (max-width: 760px) {
  .topbar { grid-template-columns: 1fr; gap: 12px; padding: 14px 18px; }
  .topbar__right { justify-content: flex-start; flex-wrap: wrap; }
  .desktop { padding: 28px 18px 60px; }
  :root { --tile: 132px; }
}
</style>
