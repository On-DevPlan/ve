// composables/useDesktopStore.ts —— 桌面状态 + 收藏 + 双模式 + KV 同步
//
// 职责:
//   1) 从 useRegistry() 构建默认 Desktop(按 group 自动建 folder)
//   2) 维护 desktop / pinned / theme / bgFile / mode 响应式状态
//   3) 实时同步到 KV 域(成功则不写 localStorage;失败 fallback + 标 dirty)
//   4) 401 / 未登录 → 完全跳过 KV,只 localStorage(Phase 1 兼容 file:// preview)
//   5) 暴露 isPinned / togglePin / setMode / visibleNodes 给 HomePC.vue
//
// KV 契约(2026-08-08 user-kv-integration):
//   - key  'desktop_layout'  value = JSON.stringify(Desktop)            tags = ['desktop']
//   - key  'desktop_pins'    value = JSON.stringify(string[])            tags = ['desktop']
//   - key  'desktop_mode'    value = 'classic' | 'pin'                  tags = ['desktop']
//   - key  'desktop_theme'   value = ThemeId                             tags = ['desktop']
//   - key  'desktop_bg_ref'  value = JSON.stringify({fileKey:'desktop_bg'})  tags = ['desktop']
//   - 背景图存 file 域 key='desktop_bg',accessLevel=private(本轮用 dataURL 走 LS,Phase 3 接 fileV1)
//
// 离线 fallback:
//   - KV 失败(401 / 网络) → 写 localStorage 标 dirty
//   - dirty=true 时,Phase 2 可加 pushToRemote() 在登录/网络恢复时回写
//   - 本轮仅写 dirty,不做自动回写(等 Phase 2 登录态接入后做)

import { ref, computed, watch, type Ref } from 'vue';
import { useRegistry } from './useRegistry';
import { kvV1Service, fileV1Service, type FileInfo } from '@/api/services';
import { jwtAuth } from '@/api/http/auth-store';
import { resolveFileUrl } from '@/api/tools/file-url';

// 重新导出 FileInfo —— PinMode 用它在 rootEl 上写 CSS(背景是展示态,
// 写在 store 的契约之外;但 PinMode 又需要这个类型做参数签名)
export type { FileInfo };

/* ============================================================
   Schema
   ============================================================ */
export type IconNode = {
  kind: 'icon';
  id: string;
  entryId: string;
  ref?: string;
};
export type FolderNode = {
  kind: 'folder';
  id: string;
  name: string;
  children: Node[];
  color?: string;
};
export type Node = IconNode | FolderNode;
export type Desktop = Node[];

export type ThemeId = 'cream' | 'blush' | 'sky' | 'sage' | 'lavender' | 'butter';

/** 双模式:classic = sidebar+CardGrid 杂志式;pin = 只显示已收藏 */
export type DisplayMode = 'classic' | 'pin';

/** Pin 模式内的 folder(可包含多个 entryId) */
export interface PinnedFolder {
  kind: 'folder';
  id: string;
  name: string;
  children: PinnedNode[];
}
/** Pin 模式 tile 节点:entry 或 folder */
export interface PinnedIcon {
  kind: 'icon';
  entryId: string;
}
export type PinnedNode = PinnedFolder | PinnedIcon;

export interface DesktopStoreState {
  pinned: string[];                  // 收藏的 entryId(★ 操作)→ KV 'desktop_pins'
  pinnedFolders: PinnedNode[];       // Pin 页面布局树(含 folder)→ KV 'desktop_layout'
  theme: ThemeId;                    // → KV 'desktop_theme'
  mode: DisplayMode;                 // → KV 'desktop_mode'
  /** 背景图文件信息(fileV1 上传,fileKey='desktop_bg',tags=['bg']);
   *  url 用于 <img src>;fileId 用于删除旧文件。null = 无背景 → KV 'desktop_bg' */
  bgFile: FileInfo | null;
}

/* ============================================================
   主题
   ============================================================ */
export const THEMES: { id: ThemeId; border: string; bg: string; hover: string; name: string }[] = [
  { id: 'cream',    border: '#fcf1ed', bg: '#fff8f5', hover: '#f5e2d8', name: 'Cream' },
  { id: 'blush',    border: '#fcd4e3', bg: '#fff5f9', hover: '#f5b6cf', name: 'Blush' },
  { id: 'sky',      border: '#a7cadd', bg: '#eaf3f9', hover: '#7fa6c4', name: 'Sky' },
  { id: 'sage',     border: '#dde9d6', bg: '#f5faf2', hover: '#b8d2ab', name: 'Sage' },
  { id: 'lavender', border: '#e3dcec', bg: '#f8f5fa', hover: '#c4b8d6', name: 'Lavender' },
  { id: 'butter',   border: '#f7eccc', bg: '#fffaee', hover: '#ebd89e', name: 'Butter' },
];

// byEntryId 占位:目前 smartName 不依赖 registry(若需要查 entry 名,后续在 schema 内注入 registry)

/* ============================================================
   id 生成
   ============================================================ */
let _seq = 1000;
const iconId = (entryId: string) => `i_${entryId.replace(/[^a-z0-9]/gi, '_')}_${++_seq}`;
/**
 * desktop(经典)folder id —— 按 name 哈希,与 pin folder(pf_)区分。
 * 仅在 buildDefaultDesktop 初始化时用一次,不需要全局唯一(只在内存中)。
 */
const folderId = (name: string) => `f_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${++_seq}`;
/**
 * pin folder id —— 用时间戳 + 随机数,保证全局唯一。
 * 修复:之前用模块级 _seq,每次页面刷新后从 1000 重新开始,导致
 * 同一会话多个 folder 出现 id 冲突(findPinned 只匹配第一个,
 * 改名/拖拽操作错位到错误 folder)。
 */
const pfolderId = () => `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ============================================================
   默认 Desktop
   ============================================================ */
function buildDefaultDesktop(registry: ReturnType<typeof useRegistry>): Desktop {
  const byGroup = new Map<string, typeof registry.entries.value>();
  for (const e of registry.entries.value) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group)!.push(e);
  }
  const out: Desktop = [];
  for (const [gname, list] of byGroup) {
    if (list.length === 1) {
      out.push({ kind: 'icon', id: iconId(list[0].id), entryId: list[0].id });
    } else {
      out.push({
        kind: 'folder',
        id: folderId(gname),
        name: gname,
        children: list.map(e => ({ kind: 'icon', id: iconId(e.id), entryId: e.id })),
      });
    }
  }
  return out;
}

/* ============================================================
   Pin 模式操作(folder 内重排 / 合并 / 拆出)
   输入:当前的 PinnedNode[];输出:新的 PinnedNode[]
   ============================================================ */
type PinnedArr = PinnedNode[];
interface FoundPinned { node: PinnedNode; parent: PinnedArr; index: number; }

/** 递归查找:id 匹配 icon.entryId 或 folder.id,可深入 folder.children。
 *  (Pin 模式 modal 内拖拽的 icon 在 folder 内,只搜顶层会找不到) */
function findPinned(arr: PinnedArr, id: string): FoundPinned | null {
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item.kind === 'icon' && item.entryId === id) {
      return { node: item, parent: arr, index: i };
    }
    if (item.kind === 'folder' && item.id === id) {
      return { node: item, parent: arr, index: i };
    }
    if (item.kind === 'folder') {
      const inner = findPinned(item.children, id);
      if (inner) return inner;
    }
  }
  return null;
}
function smartName(parts: string[]): string {
  const ns = parts.filter(Boolean);
  if (ns.length === 0) return 'Untitled';
  if (ns.length === 1) return ns[0];
  return `${ns[0].slice(0, 4)} · ${ns[1].slice(0, 4)}`;
}

function _movePinnedNode(arr: PinnedArr, srcId: string, targetFolderId: string | null, beforeId: string | null): PinnedArr {
  const src = findPinned(arr, srcId);
  if (!src) return arr;

  const target: PinnedArr = targetFolderId === null
    ? arr
    : (() => {
        const t = findPinned(arr, targetFolderId);
        if (!t || t.node.kind !== 'folder') return arr;
        return t.node.children as PinnedArr;
      })();

  // 防嵌套:folder 不能移进另一个 folder(合并走 _mergePinnedNodes 的展开语义)。
  // 必须在 splice 前检查,否则已 mutate 无法回退。
  if (target !== arr && src.node.kind === 'folder') return arr;

  src.parent.splice(src.index, 1);

  if (beforeId === null) {
    target.push(src.node);
  } else {
    const idx = target.findIndex(n =>
      (n.kind === 'icon' && n.entryId === beforeId) || (n.kind === 'folder' && n.id === beforeId)
    );
    if (idx < 0) target.push(src.node);
    else target.splice(idx, 0, src.node);
  }
  return arr;
}

function _mergePinnedNodes(arr: PinnedArr, srcId: string, dstId: string): PinnedArr {
  if (srcId === dstId) return arr;
  const src = findPinned(arr, srcId);
  const dst = findPinned(arr, dstId);
  if (!src || !dst) return arr;

  // 防嵌套:合并只允许在顶层进行(folder 内不能再建子 folder)。
  // findPinned 递归后 src/dst 可能位于 folder.children 内,此时拒绝合并;
  // folder 内排序/拖出走 _movePinnedNode,不经过这里。
  if (src.parent !== arr || dst.parent !== arr) return arr;

  // 情形 1:dst 是 folder → 合并 src 的 children
  if (dst.node.kind === 'folder') {
    const dstFolder = dst.node;
    if (src.node.kind === 'folder') {
      dstFolder.children.push(...src.node.children);
    } else {
      dstFolder.children.push(src.node);
    }
  }
  // 情形 2:dst 是 icon → 新建 folder
  else {
    const srcName = src.node.kind === 'folder' ? src.node.name : '';
    const dstName = '';
    const newF: PinnedFolder = {
      kind: 'folder',
      id: pfolderId(),
      name: smartName([srcName, dstName]),
      children: [],
    };
    if (src.node.kind === 'folder') newF.children.push(...src.node.children);
    else newF.children.push(src.node);
    newF.children.push(dst.node);
    dst.parent.splice(dst.index, 1, newF);
  }
  src.parent.splice(src.index, 1);
  return cleanupPinned(arr);
}

/** 递归收集 PinnedNode 内所有 icon 的 entryId(供 removePinned 用) */
function flattenPinnedIcons(node: PinnedNode): string[] {
  if (node.kind === 'icon') return [node.entryId];
  return node.children.flatMap(flattenPinnedIcons);
}

/**
 * 消毒 desktop_layout:递归过滤 PinnedNode 树,
 * 只保留「entryId ∈ pinned」的 icon(folder 递归;空 folder 删除)。
 * 防止 KV 里旧/脏数据在 Pin 页面显示未收藏的项。
 */
function sanitizeLayout(nodes: PinnedNode[], pinned: Set<string>): PinnedNode[] {
  const out: PinnedNode[] = [];
  for (const n of nodes) {
    if (n.kind === 'icon') {
      if (pinned.has(n.entryId)) out.push(n);
    } else if (n.kind === 'folder') {
      const kids = sanitizeLayout(n.children, pinned);
      if (kids.length) out.push({ ...n, children: kids });
    }
  }
  return out;
}

function _extractPinned(arr: PinnedArr, iconEntryId: string, fromFolderId: string, beforeId: string | null): PinnedArr {
  const folder = findPinned(arr, fromFolderId);
  if (!folder || folder.node.kind !== 'folder') return arr;
  const idx = folder.node.children.findIndex(n =>
    n.kind === 'icon' ? n.entryId === iconEntryId : n.id === iconEntryId
  );
  if (idx < 0) return arr;
  const [taken] = folder.node.children.splice(idx, 1);
  const takenNode: PinnedNode = taken.kind === 'folder' ? taken : { kind: 'icon', entryId: taken.entryId };
  if (beforeId === null) arr.push(takenNode);
  else {
    const j = arr.findIndex(n =>
      (n.kind === 'icon' && n.entryId === beforeId) || (n.kind === 'folder' && n.id === beforeId)
    );
    if (j < 0) arr.push(takenNode);
    else arr.splice(j, 0, takenNode);
  }
  return cleanupPinned(arr);
}

function cleanupPinned(arr: PinnedArr): PinnedArr {
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    if (n.kind === 'folder') {
      cleanupPinned(n.children as PinnedArr);
      if (n.children.length === 0) { arr.splice(i, 1); i--; }
      else if (n.children.length === 1) {
        const c = n.children[0];
        const replaced: PinnedNode = c.kind === 'folder' ? c : { kind: 'icon', entryId: c.entryId };
        arr.splice(i, 1, replaced);
      }
    }
  }
  return arr;
}

function buildDefaultPinned(): PinnedNode[] {
  // 默认空:Pin 页面从 desktop_pins(★ 收藏的 id)推导
  return [];
}

/* ============================================================
   离线 fallback:localStorage
   ============================================================ */
const LS_KEY = 'wb-showcase:desktop-store:v2';

function loadLS(): Partial<DesktopStoreState> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // LS parse failure (corrupted JSON / quota exceeded / privacy mode): fall back to defaults.
    // No way to recover, intentionally swallow so startup never crashes on bad state.
  }
  return null;
}
function saveLS(s: Partial<DesktopStoreState>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded / private mode / storage disabled: in-memory only. Safe to drop.
  }
}

/* ============================================================
   KV 同步层(失败 = 写 LS + dirty)
   ============================================================ */
/* ============================================================
   KV 持久化:5 个独立 key(用户契约),增量同步 + debounce
   - desktop_pins    : 收藏的 config id 数组 ["btn","icn",...]  ← 收藏操作
   - desktop_layout  : Pin 页面布局树(含 folder,PinnedNode[])
   - desktop_theme   : 主题 id
   - desktop_bg      : 背景图(dataURL 或引用)
   - desktop_mode    : 'classic' | 'pin'
   folder 不单独存 —— 在 desktop_layout 里
   ============================================================ */
const TAG = ['desktop'] as const;

async function kvSet(key: string, value: string): Promise<boolean> {
  if (!jwtAuth.state.token) return false;
  try {
    await kvV1Service.set({ key, value, tags: [...TAG], ttl: 0 });
    return true;
  } catch {
    return false;
  }
}
async function kvGet(key: string): Promise<string | null> {
  if (!jwtAuth.state.token) return null;
  try {
    const item = await kvV1Service.get({ key });
    return item.value;
  } catch {
    return null;
  }
}

/** 把 state 的每个字段序列化成对应 KV key 的 value */
function serializeField(field: keyof DesktopStoreState, state: DesktopStoreState): string {
  switch (field) {
    case 'pinned':        return JSON.stringify([...state.pinned]);      // id 数组
    case 'pinnedFolders': return JSON.stringify(state.pinnedFolders);    // PinnedNode[] 树(含 folder)
    case 'theme':         return state.theme;
    case 'mode':          return state.mode;
    case 'bgFile':         return state.bgFile ? JSON.stringify({ fileId: state.bgFile.fileId, url: state.bgFile.url }) : '';
    default:              return '';
  }
}

/** state 字段 → KV key 名映射(folder 用 desktop_layout,不单独 pinned_folders) */
const KV_KEY_MAP: Record<keyof DesktopStoreState, string> = {
  pinned: 'desktop_pins',
  pinnedFolders: 'desktop_layout',   // Pin 页面布局(含 folder)
  theme: 'desktop_theme',
  mode: 'desktop_mode',
  bgFile: 'desktop_bg',
};

/** 增量同步:只写与上次快照不同的 key */
let lastSynced: Partial<DesktopStoreState> | null = null;

/**
 * 深拷贝一个 state 快照,用于 lastSynced 基线。
 *
 * 为什么必须深拷贝:
 *   movePinnedNode / mergePinnedNodes 等函数是**原地修改**(对 pinnedNodes.value
 *   直接 splice/push),而 lastSynced 若持有同一数组引用,原地修改会连基线一起改掉,
 *   增量比较 JSON.stringify(state) === JSON.stringify(lastSynced) 永远成立 →
 *   desktop_layout 永远写不出去。深拷贝让基线不受后续原地修改影响。
 */
function cloneState(s: DesktopStoreState): DesktopStoreState {
  return {
    pinned: [...s.pinned],
    pinnedFolders: JSON.parse(JSON.stringify(s.pinnedFolders)),
    theme: s.theme,
    mode: s.mode,
    bgFile: s.bgFile,
  };
}

async function syncToKV(state: DesktopStoreState): Promise<boolean> {
  if (!jwtAuth.state.token) return false;

  const fields = Object.keys(KV_KEY_MAP) as (keyof DesktopStoreState)[];
  const changed = fields.filter(f =>
    serializeField(f, state) !== (lastSynced ? serializeField(f, lastSynced as DesktopStoreState) : null)
  );

  if (!lastSynced) {
    // 首次同步:全量写
    const results = await Promise.all(fields.map(f => kvSet(KV_KEY_MAP[f], serializeField(f, state))));
    if (results.every(Boolean)) lastSynced = cloneState(state);
    return results.every(Boolean);
  }

  if (changed.length === 0) return true;

  const results = await Promise.all(changed.map(f => kvSet(KV_KEY_MAP[f], serializeField(f, state))));
  if (results.every(Boolean)) {
    lastSynced = cloneState(state);
  }
  return results.every(Boolean);
}

/* ============================================================
   Store(composable,singleton)
   ============================================================ */
export interface UseDesktopStore {
  // 状态
  desktop: Ref<Desktop>;
  pinned: Ref<Set<string>>;
  pinnedNodes: Ref<PinnedNode[]>;
  theme: Ref<ThemeId>;
  mode: Ref<DisplayMode>;
  bgFile: Ref<FileInfo | null>;
  // 视图计算
  visibleNodes: Ref<Node[]>;
  // 收藏
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void;
  removePinned: (node: PinnedNode) => void;
  // Pin 模式拖拽
  movePinnedNode: (srcId: string, targetFolderId: string | null, beforeId: string | null) => void;
  mergePinnedNodes: (srcId: string, dstId: string) => void;
  extractPinned: (iconEntryId: string, fromFolderId: string, beforeId: string | null) => void;
  reorderFolderChildren: (folderId: string, children: PinnedNode[]) => void;
  renameFolder: (folderId: string, name: string) => void;
  reorderTopLevel: (orderedNodeIds: string[]) => void;
  // 模式切换
  setMode: (m: DisplayMode) => void;
  // 主题
  applyTheme: (id: ThemeId) => void;
  // 背景
  setBg: (file: Blob | null) => Promise<void>;
  // 重置
  resetLayout: () => void;
  // 状态
  loading: Ref<boolean>;
}

let _store: UseDesktopStore | null = null;

export function useDesktopStore(): UseDesktopStore {
  if (_store) return _store;

  const registry = useRegistry();
  const ls = loadLS();

  // ---- 启动顺序:有 KV → 读 KV;否则用 LS;再否则默认 ----
  // 但 KV 是 async,组件已挂载 → 先用 LS 默认值,KV 加载完后异步覆盖
  // desktop(classic 模式用 registry 直接渲染,不需要持久化)
  const desktop = ref<Desktop>(buildDefaultDesktop(registry)) as Ref<Desktop>;
  const pinned  = ref<Set<string>>(new Set(ls?.pinned ?? []));
  const pinnedNodes = ref<PinnedNode[]>(ls?.pinnedFolders ?? buildDefaultPinned());
  const theme   = ref<ThemeId>(ls?.theme ?? 'cream');
  const mode    = ref<DisplayMode>(ls?.mode ?? 'classic');  // 默认 classic(杂志式)
  const bgFile   = ref<FileInfo | null>(ls?.bgFile ?? null);
  const loading = ref(false);

  // 异步加载 KV(5 个独立 key,并行 GET)
  if (jwtAuth.state.token) {
    loading.value = true;
    (async () => {
      const [pinsV, layoutV, themeV, modeV, bgV] = await Promise.all([
        kvGet('desktop_pins'),
        kvGet('desktop_layout'),
        kvGet('desktop_theme'),
        kvGet('desktop_mode'),
        kvGet('desktop_bg'),
      ]);
      if (pinsV) {
        // 防御:desktop_pins 必须是纯 string id 数组,过滤非法项(旧格式/对象/脏数据)
        try {
          const arr = JSON.parse(pinsV);
          if (Array.isArray(arr)) pinned.value = new Set(arr.filter((x): x is string => typeof x === 'string'));
        } catch {
          // Corrupted KV value: drop it and let the user re-pin. Swallow parse error.
        }
      }
      if (layoutV) {
        // 防御:desktop_layout 是 PinnedNode[] 树;过滤掉不在 pinned 里的 icon(避免显示未收藏的)
        try {
          const parsed = JSON.parse(layoutV);
          if (Array.isArray(parsed)) pinnedNodes.value = sanitizeLayout(parsed, pinned.value);
        } catch {
          // Corrupted KV value: drop it and fall back to default layout.
        }
      }
      if (themeV && THEMES.some(t => t.id === themeV)) applyTheme(themeV as ThemeId);
      if (modeV === 'classic' || modeV === 'pin') mode.value = modeV;
      if (bgV) {
        try {
          const obj = JSON.parse(bgV);
          if (obj && obj.fileId && obj.url) {
            // 从 fileId 重新 info 拿最新 url(可能带签名/过期),保证可用
            const info = await fileV1Service.info({ fileId: obj.fileId });
            // 改写 URL 为同源相对路径 /files/<fileId>,走 /files/ 代理避免 CORS/mixed-content
            bgFile.value = { ...info, url: resolveFileUrl(info.url) };
            // 不在此处写 DOM —— 背景的渲染交给 PinMode 自己的 rootEl
            // (避免污染 :root / body,保持 PinMode 视觉自包含)
          }
        } catch { /* 兼容旧格式或损坏 */ }
      }
      // 初始化 lastSynced 快照(避免加载后立即触发全量写)
      // 用 cloneState 深拷贝:否则后续 movePinnedNode/mergePinnedNodes 的原地修改
      // 会连这个基线一起改,增量比较永远无变化 → desktop_layout 写不出去。
      lastSynced = cloneState({
        pinned: [...pinned.value],
        pinnedFolders: pinnedNodes.value,
        theme: theme.value,
        mode: mode.value,
        bgFile: bgFile.value,
      });
      loading.value = false;
    })();
  }

  // ---- visibleNodes:Pin 模式过滤(classic 模式不用此值,用 useSearch 拿搜索结果)----
  const visibleNodes = computed<Node[]>(() => {
    if (mode.value === 'classic') return [];  // classic 模式不消费此值
    // pin 模式:递归过滤,folder 整收藏 → 原样,否则只取收藏成员
    const p = pinned.value;
    function filterNode(n: Node): Node | null {
      if (n.kind === 'icon') return p.has(n.entryId) ? n : null;
      const kids = n.children.map(filterNode).filter(Boolean) as Node[];
      if (p.has(n.id)) return n;
      return kids.length ? { ...n, children: kids } : null;
    }
    return desktop.value.map(filterNode).filter(Boolean) as Node[];
  });

  function isPinned(id: string) { return pinned.value.has(id); }
  function togglePin(id: string) {
    const next = new Set(pinned.value);
    if (next.has(id)) next.delete(id); else next.add(id);
    pinned.value = next;
    // 同步 layout:新增时往末尾加一个 icon;删除时从 layout 里摘掉
    const arr = pinnedNodes.value;
    if (next.has(id)) {
      // 防御:已经存在于 layout(可能在某个 folder 内)就不重复加
      const existingIds = new Set(arr.flatMap(flattenPinnedIcons));
      if (!existingIds.has(id)) {
        arr.push({ kind: 'icon', entryId: id });
        pinnedNodes.value = [...arr];
      }
    } else {
      // 删除:从 layout 递归摘掉该 entryId(从任何 folder 内)
      const filtered = removeIconFromLayout(arr, id);
      pinnedNodes.value = filtered;
    }
    syncPinnedOrderFromLayout();
  }

  /** 从 layout 树里递归删掉某个 entryId 对应的 PinnedIcon */
  function removeIconFromLayout(nodes: PinnedNode[], entryId: string): PinnedNode[] {
    const out: PinnedNode[] = [];
    for (const n of nodes) {
      if (n.kind === 'icon') {
        if (n.entryId !== entryId) out.push(n);
      } else {
        const kids = removeIconFromLayout(n.children, entryId);
        if (kids.length) out.push({ ...n, children: kids });
      }
    }
    return out;
  }

  /** 取消 pin(★ 或 Pin 页面删除):同步从 desktop_pins(pinned)和 desktop_layout(pinnedNodes)移除 */
  function removePinned(node: PinnedNode) {
    // 1) 从 pinned 移除(icon → entryId;folder → 所有成员 entryId)
    const next = new Set(pinned.value);
    if (node.kind === 'icon') {
      next.delete(node.entryId);
    } else {
      for (const c of flattenPinnedIcons(node)) next.delete(c);
    }
    pinned.value = next;
    // 2) 从 pinnedNodes 移除该节点(仅顶层;folder 内成员由 extractPinned 处理)
    const arr = pinnedNodes.value;
    const idx = arr.findIndex(x => x === node);
    if (idx >= 0) {
      arr.splice(idx, 1);
      pinnedNodes.value = [...arr];
    }
    // 3) 用 layout 顺序重写 pinned(从 displayNodes 视角同步,见 movePinnedNode 处注释)
    syncPinnedOrderFromLayout();
  }

  // Pin 模式 folder 拖拽
  // 内部 _*Pinned* 函数是**原地修改**(对传入数组 splice/push)。两处配套约束:
  //   1) 这里用 `[...pinnedNodes.value]` 换掉顶层引用,保证 ref setter 触发 watch;
  //   2) syncToKV 的 lastSynced 基线必须深拷贝(见 cloneState)—— 否则基线与
  //      pinnedNodes.value 共享嵌套节点,原地修改会把基线一起改掉,增量比较
  //      永远"无变化",desktop_layout 永远写不出去(移入文件夹不调接口的根因)。
  function movePinnedNode(srcId: string, targetFolderId: string | null, beforeId: string | null) {
    _movePinnedNode(pinnedNodes.value, srcId, targetFolderId, beforeId);
    // 从 folder 移出 src 后,该 folder 可能剩 0 / 1 个 children,需 cleanupPinned 拆解
    cleanupPinned(pinnedNodes.value);
    pinnedNodes.value = [...pinnedNodes.value];
    syncPinnedOrderFromLayout();
  }
  function mergePinnedNodes(srcId: string, dstId: string) {
    _mergePinnedNodes(pinnedNodes.value, srcId, dstId);
    pinnedNodes.value = [...pinnedNodes.value];
    syncPinnedOrderFromLayout();
  }
  function extractPinned(iconEntryId: string, fromFolderId: string, beforeId: string | null) {
    _extractPinned(pinnedNodes.value, iconEntryId, fromFolderId, beforeId);
    pinnedNodes.value = [...pinnedNodes.value];
    syncPinnedOrderFromLayout();
  }

  /**
   * 整体替换某个 folder 的 children 顺序(Pin modal 内拖拽排序用)。
   * children 由调用方按 DOM 顺序给出;只允许 icon(防嵌套,folder 直接过滤掉)。
   */
  function reorderFolderChildren(folderId: string, children: PinnedNode[]) {
    const found = findPinned(pinnedNodes.value, folderId);
    if (!found || found.node.kind !== 'folder') return;
    found.node.children = children.filter(c => c.kind === 'icon');
    // 过滤/重排后 folder 可能剩 0/1 个 children,cleanupPinned 拆解
    cleanupPinned(pinnedNodes.value);
    pinnedNodes.value = [...pinnedNodes.value];
    syncPinnedOrderFromLayout();
  }

  /**
   * 重命名 folder(Pin 模式双击编辑)。空名称 = 清除自定义,回退智能推断。
   * 写入 customName 字段,显式触发 syncToKV 写 desktop_layout(不等 watch,
   * 因为 deep watch 对嵌套对象属性变更不可靠)。
   */
  function renameFolder(folderId: string, name: string) {
    const found = findPinned(pinnedNodes.value, folderId);
    if (!found || found.node.kind !== 'folder') return;
    const trimmed = name.trim();
    // 空名称 = 还原默认智能推断名("Untitled" 或合并名)
    found.node.name = trimmed === '' ? smartName(['', '']) : trimmed;
    // 深拷贝整个 pinnedNodes 树,强制 Vue reactive 重新 wrap 每个节点(plain object)
    pinnedNodes.value = JSON.parse(JSON.stringify(pinnedNodes.value));
    // 显式同步:构造 state,触发 LS + KV 写入,debounce 与 watch 共用定时器
    const state: DesktopStoreState = {
      pinned: [...pinned.value],
      pinnedFolders: pinnedNodes.value,
      theme: theme.value,
      mode: mode.value,
      bgFile: bgFile.value,
    };
    saveLS(state);
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const ok = await syncToKV(state);
      if (!ok && jwtAuth.state.token) {
        console.warn('[useDesktopStore] renameFolder sync failed');
      }
    }, 200);
  }

  /**
   * 整体重排顶层 nodes(Pin 模式拖拽 folder 重排)。
   * 调用方按 DOM 顺序给出 node id,store 按 id 重组 pinnedNodes.value 顶层数组。
   * 走与 merge/move 相同的同步路径:顶层 ref 重赋值 + watch + cloneState + syncToKV,
   * 确保 desktop_layout 增量写入。
   */
  function reorderTopLevel(orderedNodeIds: string[]) {
    const cur = pinnedNodes.value;
    const byId = new Map(cur.map(n => [nodeIdOf(n), n]));
    const reordered: PinnedNode[] = [];
    for (const id of orderedNodeIds) {
      const n = byId.get(id);
      if (n) { reordered.push(n); byId.delete(id); }
    }
    for (const n of byId.values()) reordered.push(n);  // 兜底:不在 DOM 的补末尾
    pinnedNodes.value = reordered;
    syncPinnedOrderFromLayout();
  }

  /**
   * 把当前 layout(pinnedNodes)按**显示顺序**写回 pinned Set。
   *
   * 背景:desktop_pins 是 string[] 形式持久化(KV 'desktop_pins'),
   * pinned 是 Set<pinned.id>。两者顺序独立会出 bug:
   *   - merge / move 后 layout 顺序变了,但 pinned 还是旧顺序
   *   - 下次刷新:先加载 desktop_pins 兜底显示,顺序与 desktop_layout 不一致 → 跳位
   *
   * 契约:desktop_layout 是显示真值;desktop_pins 只是收藏 id 集合的镜像,
   * 顺序跟随 layout(按 layout 顶层 + 递归 folder 的访问顺序)。
   */
  function syncPinnedOrderFromLayout() {
    const out: string[] = [];
    function walk(nodes: PinnedNode[]) {
      for (const n of nodes) {
        if (n.kind === 'icon') out.push(n.entryId);
        else walk(n.children);
      }
    }
    walk(pinnedNodes.value);
    pinned.value = new Set(out);
  }

  function setMode(m: DisplayMode) {
    if (m !== 'classic' && m !== 'pin') return;
    mode.value = m;
  }

  function applyTheme(id: ThemeId) {
    // 主题色只作为响应式状态保存,不再写 :root CSS 变量
    // (避免影响 ClassicMode / 其他组件)。每个 mode 组件自己把颜色应用到自己的 scope。
    theme.value = id;
    const t = THEMES.find(x => x.id === id)!;
    return { border: t.border, hover: t.hover, bg: t.bg, bgHover: t.hover };
  }

  /**
   * 写背景数据到 store。**不**直接操作 DOM —— 渲染由 PinMode 监听 bgFile
   * 后,写到自己的 rootEl 上(:root / body 是全局 scope,会污染 ClassicMode
   * 与其他组件)。上传 + 删除旧文件 + 状态写入仍在这里,确保 bgFile 同步。
   */
  async function uploadBg(file: Blob): Promise<void> {
    const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
    const info = await fileV1Service.upload({ file, groupId, tags: ['bg'] });
    const oldFileId = bgFile.value?.fileId;
    bgFile.value = info;
    if (oldFileId && oldFileId !== info.fileId) {
      try { await fileV1Service.delete({ fileId: oldFileId, groupId }); } catch { /* 旧文件可能已被后端清理 */ }
    }
  }

  async function setBg(file: Blob | null): Promise<void> {
    if (!file) {
      // 清除背景:删 file,清 KV;DOM 端由 PinMode 监听 bgFile=null 后自己清理
      const oldFileId = bgFile.value?.fileId;
      bgFile.value = null;
      if (oldFileId) {
        const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
        try { await fileV1Service.delete({ fileId: oldFileId, groupId }); } catch { /* ignore */ }
      }
      // 显式触发 KV 同步(背景清掉也需写 desktop_bg=空)
      const state: DesktopStoreState = {
        pinned: [...pinned.value],
        pinnedFolders: pinnedNodes.value,
        theme: theme.value,
        mode: mode.value,
        bgFile: null,
      };
      saveLS(state);
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => { await syncToKV(state); }, 200);
      return;
    }
    await uploadBg(file);
    // uploadBg 设了 bgFile,watch 会触发 syncToKV('desktop_bg')
  }

  function resetLayout() {
    desktop.value = buildDefaultDesktop(registry);
    pinned.value = new Set();
  }

  // ---- 实时同步:任一状态变 → 写 KV(失败 → 写 LS)----
  // watch + 200ms debounce:连续改动合并成一次 KV 写入(增量:只写变化的 key)
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  watch([desktop, pinned, pinnedNodes, theme, mode, bgFile], () => {
    const state: DesktopStoreState = {
      pinned: [...pinned.value],
      pinnedFolders: pinnedNodes.value,
      theme: theme.value,
      mode: mode.value,
      bgFile: bgFile.value,
    };
    // 1) 先写 LS(总有,作为 fallback / 离线降级)—— 立即写,不等 debounce
    saveLS(state);
    // 2) KV 写入 debounce 200ms(避免连续 pin/拖拽触发多次请求)
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const ok = await syncToKV(state);
      if (!ok && jwtAuth.state.token) {
        console.warn('[useDesktopStore] KV sync failed, saved to localStorage');
      }
    }, 200);
  }, { deep: true });

  // 启动时应用主题(背景的 DOM 渲染由 PinMode 自己监听 bgFile 后写)
  applyTheme(theme.value);

  _store = {
    desktop, pinned, pinnedNodes, theme, mode, bgFile,
    visibleNodes, isPinned, togglePin, removePinned,
    movePinnedNode, mergePinnedNodes, extractPinned, reorderFolderChildren, renameFolder, reorderTopLevel,
    setMode, applyTheme, setBg, resetLayout, loading,
  };
  return _store;
}
