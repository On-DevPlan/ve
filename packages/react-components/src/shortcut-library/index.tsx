// index.tsx —— ShortcutLibrary 组件入口
// 布局:左 sidebar(分组) + 主区(快捷键表格) + 下(键盘预览,可折叠)
// 键盘预览支持三种"显示该键快捷键"的入口(统一汇入同一个 mapping popup):
//   - 悬停键(mouse):延迟 HOVER_OPEN_DELAY 弹出(无绑定的键不弹,避免噪音)
//   - 长按键(mouse / 物理键,KEY_HOLD_MS):弹出
//   - 双击键:弹出并 pin 住(pin 期间不被外部点击 / 移开关闭,但可被其它键替换)
// 物理按键短按:键挂 is-on 蓝亮;录入 3s 高亮走 highlightedCodes。
// 表格行 hover:右侧弹 floating description tooltip

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './index.css';
import { useShortcuts, findBindingsByCode, type BindingHit } from './src/hooks/useShortcuts';
import ImportModal from './src/pages/ImportModal';
import type { ImportParseResult } from './src/engine/import-parser';
import type { ImportStats } from './src/hooks/useShortcuts';
import type { Shortcut } from './src/types';
import { useJwtAuth } from './src/hooks/useAuth';
import { useLoginModal } from './src/hooks/useLoginModal';
import { logoutWithConfirm } from './src/hooks/logoutWithConfirm';
import SettingsPanel from './src/pages/SettingsPanel';
import Sidebar from './src/pages/Sidebar';
import ShortcutTable from './src/pages/ShortcutTable';
import Keyboard from './src/pages/Keyboard';


// 物理键盘长按阈值 —— 按住多少毫秒后弹 mapping popup。
// 400ms:单击(<300ms)不会误触,长按明显比 800ms 更容易出快捷键。
const KEY_HOLD_MS = 400;
// 悬停多久后弹 mapping popup —— 比长按更轻量,做"扫一眼"用;无绑定的键不弹。
const HOVER_OPEN_DELAY = 150;
// 长按 popup 最多展示的映射数,超出显示「…还有 N 条」
const LONG_PRESS_MAX = 5;

// 键盘预览折叠状态独立 key,不与 shortcut 数据混在一起,
// 避免清空数据时连带把"是否折叠"也抹掉
const PREVIEW_COLLAPSED_KEY = 'sl-shortcut-library:v1:previewCollapsed';

function loadPreviewCollapsed(): boolean {
  try {
    return localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

// 长按 popup 的位置信息 —— 通过 getBoundingClientRect 计算,portal 渲染到 document.body
interface PopupState {
  code: string;
  rect: DOMRect;
  hits: BindingHit[];
}

export default function ShortcutLibrary() {
  const store = useShortcuts();
  const auth = useJwtAuth();
  const loginModal = useLoginModal();
  const [highlightedCodes, setHighlightedCodes] = useState<Set<string>>(new Set());
  const [hoveredCodes, setHoveredCodes] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // 键盘预览折叠态 —— 默认展开;用户手动收起后写入 LS,下次进详情页保持
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(loadPreviewCollapsed);

  // 拖拽布局:sidebar 宽度 + 键盘预览高度(都不持久化,组件实例间独立)。
  //
  // 性能设计(live resize):拖拽期间内容【实时跟随】,代价是每帧一次 Layout。
  // 降到最低成本的手段:
  //   - pointermove 只写 ref,rAF 去重每帧一次 frame() → 直改 CSS 变量(实时)
  //   - move 中绝不读布局属性(避免强制同步布局)
  //   - 拖拽期间 root 挂 .sl-sl-dragging:禁所有 transition(reflow 后不触发动画
  //     重绘)+ 对 keyboard/table 加 contain:paint(缩小重绘范围)
  //   - pointerup 同步 React state 一次(供初始渲染/未来持久化)
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [previewHeight, setPreviewHeight] = useState(200);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  const dragType = useRef<null | 'sidebar' | 'preview'>(null);
  const dragStart = useRef<{ x: number; y: number; w: number; h: number }>(
    { x: 0, y: 0, w: 0, h: 0 },
  );
  // rAF 去重标记 + 最新指针偏移(ref 写入,不触发渲染)
  const rafId = useRef<number | null>(null);
  const latest = useRef<{ dx: number; dy: number } | null>(null);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 500;
  const PREVIEW_MIN = 80;
  const PREVIEW_MAX = 500;

  function startDrag(type: 'sidebar' | 'preview', e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    // 指针捕获:移出元素/窗口也不丢事件
    e.currentTarget.setPointerCapture?.(e.pointerId);

    dragType.current = type;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: sidebarWidth,
      h: previewHeight,
    };

    // 拖拽期间:禁文本选择 + 改光标 + 挂 dragging class(禁 transition / 缩重绘范围)
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'sidebar' ? 'col-resize' : 'row-resize';
    rootRef.current?.classList.add('sl-sl-dragging');
  }

  // rAF 每帧一次:直改 CSS 变量 → 内容实时跟随(一次 Layout)。夹紧纯数学,不读 DOM。
  function frame() {
    rafId.current = null;
    const p = latest.current;
    if (!p) return;
    if (dragType.current === 'sidebar') {
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.w + p.dx));
      rootRef.current?.style.setProperty('--sl-sl-sidebar-w', `${w}px`);
    } else if (dragType.current === 'preview') {
      const h = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, dragStart.current.h - p.dy));
      previewRef.current?.style.setProperty('--sl-sl-preview-h', `${h}px`);
    }
    latest.current = null;
  }

  // pointerup:恢复样式,同步一次 React state(终值用 pointerup 事件坐标算,不依赖 latest)
  function endDrag(e: PointerEvent) {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    rootRef.current?.classList.remove('sl-sl-dragging');
    const t = dragType.current;
    if (t) {
      if (t === 'sidebar') {
        setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.w + (e.clientX - dragStart.current.x))));
      } else {
        setPreviewHeight(Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, dragStart.current.h - (e.clientY - dragStart.current.y))));
      }
    }
    latest.current = null;
    dragType.current = null;
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragType.current) return;
      latest.current = { dx: e.clientX - dragStart.current.x, dy: e.clientY - dragStart.current.y };
      // rAF 去重:一帧内多次 pointermove 只调度一次 frame
      if (rafId.current === null) rafId.current = requestAnimationFrame(frame);
    }
    function onUp(e: PointerEvent) {
      endDrag(e);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  // 键盘可达性:splitter 可聚焦,方向键按固定步长直接提交(低频,允许走 Layout)
  const SPLIT_STEP = 16;
  function onSplitterKeyDown(type: 'sidebar' | 'preview', e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' && type === 'sidebar') {
      e.preventDefault();
      setSidebarWidth((v) => Math.min(SIDEBAR_MAX, v + SPLIT_STEP));
    } else if (e.key === 'ArrowLeft' && type === 'sidebar') {
      e.preventDefault();
      setSidebarWidth((v) => Math.max(SIDEBAR_MIN, v - SPLIT_STEP));
    } else if (e.key === 'ArrowUp' && type === 'preview') {
      e.preventDefault();
      setPreviewHeight((v) => Math.min(PREVIEW_MAX, v + SPLIT_STEP));
    } else if (e.key === 'ArrowDown' && type === 'preview') {
      e.preventDefault();
      setPreviewHeight((v) => Math.max(PREVIEW_MIN, v - SPLIT_STEP));
    }
  }

  // 长按 popup 状态(由 Keyboard 子组件回调触发)
  const [longPressPopup, setLongPressPopup] = useState<PopupState | null>(null);
  // 物理键盘 / 鼠标当前被按住的 code 集合。键持续按住时,对应的 visual key
  // 挂 is-on(蓝底);KEY_HOLD_MS 长按命中后弹 mapping popup;松开后立刻移除。
  const [heldKeys, setHeldKeys] = useState<Set<string>>(new Set());
  // 每个 code 的 hold 倒计时 timer。命中后弹 popup,清掉。
  const holdTimers = useRef<Map<string, number>>(new Map());
  // 悬停延迟弹 popup 的 timer(同一时刻只挂一个:mouseenter 先清旧再挂新)。
  const hoverTimer = useRef<number | undefined>(undefined);
  // 同步一份 heldKeys(只读)给 onBlur 用 —— onBlur 里要清掉所有 timer,
  // 但 React 的 setHeldKeys 异步,onBlur 直接读 heldKeys state 拿不到最新值。
  // 用 ref 同步最新值。
  const heldKeysRef = useRef<Set<string>>(new Set());
  // 每次 heldKeys state 变化,同步到 ref
  useEffect(() => { heldKeysRef.current = heldKeys; }, [heldKeys]);
  // 行 hover tooltip —— 包含当前 shortcut 和 rect(由 ShortcutTable 回调提供)
  const [hoveredShortcut, setHoveredShortcut] = useState<{
    shortcut: Shortcut;
    rect: DOMRect;
  } | null>(null);
  // portal 目标节点 —— 优先挂到 shadowRoot(host 提供),fallback 到 document.body
  const portalRoot =
    (typeof document !== 'undefined' &&
      document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  // 折叠状态持久化
  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_COLLAPSED_KEY, previewCollapsed ? '1' : '0');
    } catch {
      /* quota / private mode — ignore */
    }
  }, [previewCollapsed]);

  function handleImport(data: ImportParseResult): ImportStats {
    return store.importGroups(data);
  }

  // 长按 popup:查询并展示
  // - 通过 Keyboard 子组件回调拿到 code 和 rect
  // - 用 createPortal 渲染到 host portal target,避免被 .sl-sl-preview 的 overflow 裁剪
  const handleLongPress = useCallback(
    (code: string, rect: DOMRect) => {
      const hits = findBindingsByCode(store.groups, code);
      // 即使没有 hits 也展示 popup,告诉用户「该键未被任何分组使用」。
      // 长按是非 pin 的(松开后可被外部点击关闭)。
      setLongPressPopup({ code, rect, hits });
    },
    [store.groups],
  );

  const handleLongPressClose = useCallback(() => {
    setLongPressPopup(null);
  }, []);

  // 悬停进入:延迟 HOVER_OPEN_DELAY 后弹(无绑定不弹)。
  // 用 setLongPressPopup 的函数式更新读最新 popup,避免闭包里 popup 过期。
  // 任何新触发(hover / hold / dblclick)都会覆盖当前 popup —— 没有"锁住"逻辑。
  const handleHoverEnter = useCallback(
    (code: string, rect: DOMRect) => {
      // 先清掉上一个未触发的 hover timer,快速划过时不连发
      if (hoverTimer.current !== undefined) {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = undefined;
      }
      const t = window.setTimeout(() => {
        hoverTimer.current = undefined;
        const hits = findBindingsByCode(store.groups, code);
        setLongPressPopup((prev) => {
          if (hits.length === 0) return prev; // 无绑定不弹(悬停是"扫一眼",空 popup 是噪音)
          return { code, rect, hits };
        });
      }, HOVER_OPEN_DELAY);
      hoverTimer.current = t;
    },
    [store.groups],
  );

  // 悬停离开:取消待触发的 hover timer;关闭当前 popup。
  const handleHoverLeave = useCallback((code: string) => {
    if (hoverTimer.current !== undefined) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    }
    setLongPressPopup((prev) => (prev?.code === code ? null : prev));
  }, []);

  // 双击:弹 popup 并 pin 住。清掉可能残留的 hold / hover 定时器,避免它们事后
  // 把 pin 改回非 pin。即使无绑定也弹(pin 是用户主动检查)。
  const handleDoubleClickKey = useCallback(
    (code: string, rect: DOMRect) => {
      if (hoverTimer.current !== undefined) {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = undefined;
      }
      // 清掉第二次 pointerdown 启动的 hold timer,否则 400ms 后会把 pin 改回非 pin
      const ht = holdTimers.current.get(code);
      if (ht) {
        window.clearTimeout(ht);
        holdTimers.current.delete(code);
      }
      const hits = findBindingsByCode(store.groups, code);
      setLongPressPopup({ code, rect, hits });
    },
    [store.groups],
  );

  // 统一的「按下」「松开」入口(鼠标 / 触屏 / 物理键共享)。
  // 鼠标按下 visual key → onPress → 父组件把 code 加到 heldKeys(键变蓝)
  // 同时启动 KEY_HOLD_MS timer;命中后弹 mapping popup(位置取按键正上方);
  // onRelease 清掉。
  // 物理键 keydown → onKeyDown → 同样路径(见下面 useEffect)。
  // 不在 onPress 时传 rect —— 物理键没有 rect,而且 hover/滚动时 key 位置
  // 可能变化,在 timer 命中那一刻去查 DOM 拿最新位置。
  const findKeyRect = (code: string): DOMRect | null => {
    // 1. 优先从 shadow DOM 里找(visual key 在那里)
    const shadowHost = document.querySelector('main.detail .detail__container > *');
    const inside = shadowHost?.shadowRoot?.querySelector(
      `[data-shortcut-code="${code}"]`,
    );
    if (inside instanceof HTMLElement) return inside.getBoundingClientRect();
    // 2. 兜底:外部 document 找(测试环境 / 其他挂载方式)
    const outside = document.querySelector(`[data-shortcut-code="${code}"]`);
    if (outside instanceof HTMLElement) return outside.getBoundingClientRect();
    return null;
  };
  const holdPress = useCallback((code: string) => {
    setHeldKeys((prev) => {
      if (prev.has(code)) return prev;
      const next = new Set(prev);
      next.add(code);
      return next;
    });
    // 启动 hold timer:用 setTimeout,KEY_HOLD_MS 后弹 popup
    const existing = holdTimers.current.get(code);
    if (existing) window.clearTimeout(existing);
    const t = window.setTimeout(() => {
      holdTimers.current.delete(code);
      // 取按键 rect 决定 popup 位置;找不到时退回零 rect(走 default 位置)
      const rect = findKeyRect(code) ?? (
        { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect
      );
      handleLongPress(code, rect);
    }, KEY_HOLD_MS);
    holdTimers.current.set(code, t);
  }, [handleLongPress]);

  const holdRelease = useCallback((code: string) => {
    setHeldKeys((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
    const t = holdTimers.current.get(code);
    if (t) {
      window.clearTimeout(t);
      holdTimers.current.delete(code);
    }
  }, []);

  // popup 打开时,监听 Esc 关闭 + 外部点击关闭
  // 关键:监听 pointerup 而不是 pointerdown。长按命中时,鼠标还按在 key 上,
  // 用 pointerdown 会在 popup 刚挂上时(或者浏览器把那个 pointerdown 重新派发)
  // 误判为「外部按下」,popup 一闪即逝;改 pointerup 后,只有「松开后再次按下」
  // 才会关,符合直觉。
  useEffect(() => {
    if (!longPressPopup) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleLongPressClose();
    }
    function onPointerUp(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      // popup 内部松开不关闭
      if (target?.closest('.sl-sl-longpress')) return;
      handleLongPressClose();
    }
    window.addEventListener('keydown', onKeyDown);
    // pointerup 用 bubble 即可:触发「点外面关闭」时,目标不在 popup 上,
    // 自然冒泡到 window,handler 判断后关闭。
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [longPressPopup, handleLongPressClose]);

  // 全局 keydown / keyup 监听:物理键盘长按 → visual key 变蓝 → KEY_HOLD_MS
  // 后弹 mapping popup。鼠标 / 触屏长按由 Keyboard 子组件直接 onPress。
  // 两条路径汇合到 holdPress / holdRelease 这对回调,统一 heldKeys + 800ms
  // 倒计时。
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      // OS auto-repeat 防御:e.repeat=true 不重复进 hold(否则每个
      // 周期都重启 800ms timer,popup 永远弹不出来)。
      if (e.repeat) return;
      // 物理键按下没有 rect,holdPress 内部 timer 命中那一刻会自己查 DOM。
      holdPress(e.code);
    }
    function onKeyUp(e: KeyboardEvent) {
      // 任何键松开都从 heldKeys 移除。
      holdRelease(e.code);
    }
    function onBlur() {
      // 失焦(Alt+Tab 出去)时清掉所有 hold + timer,避免切回来
      // 时还卡着「已按住」状态。
      heldKeysRef.current.forEach((code) => {
        const t = holdTimers.current.get(code);
        if (t) window.clearTimeout(t);
      });
      holdTimers.current.clear();
      setHeldKeys(new Set());
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [holdPress, holdRelease]);

  // 物理键盘长按 3s 命中 → 弹 mapping popup。每个 code 一个独立 timer。
  // keyup / blur 会清掉所有 hold timer 和 heldKeys(在 onKeyUp / onBlur 里
  // 显式处理)。hold timer 由 holdPress / holdRelease 统一管理,这里
  // 不用 useEffect 重复一遍。

  // 高亮最近一次录入:3 秒后自动清除。
  // 与 longPressPopup 互斥:长按命中期间不清高亮,否则基态→蓝底→灰→
  // 又回蓝底的瞬时跳变(高亮 3s timer 触发 + popup 打开 + 其它路径
  // 重新设置高亮)会被感知为「长按中闪一下」。
  useEffect(() => {
    if (highlightedCodes.size === 0) return;
    if (longPressPopup) return; // 长按期间挂起 3s timer
    const t = window.setTimeout(() => setHighlightedCodes(new Set()), 3000);
    return () => window.clearTimeout(t);
  }, [highlightedCodes, longPressPopup]);

  // 搜索在 sidebar + table 之间共享
  // query 由 store 提供;过滤 sidebar 在 Sidebar.tsx 内部做

  // 长按 popup 的定位:在 key 上方偏移,靠近视口右/下边界时翻转
  const longPressPopupPos = useMemo(() => {
    if (!longPressPopup) return null;
    const POPUP_WIDTH = 260;
    const POPUP_MAX_HEIGHT = 240;
    const VIEWPORT_PAD = 8;
    const GAP = 8;
    const { rect } = longPressPopup;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    let top = rect.bottom + GAP;
    let left = rect.left;
    if (top + POPUP_MAX_HEIGHT > vh - VIEWPORT_PAD) {
      top = rect.top - GAP - POPUP_MAX_HEIGHT;
      if (top < VIEWPORT_PAD) top = vh - POPUP_MAX_HEIGHT - VIEWPORT_PAD;
    }
    if (left + POPUP_WIDTH > vw - VIEWPORT_PAD) {
      left = vw - POPUP_WIDTH - VIEWPORT_PAD;
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    return { top, left };
  }, [longPressPopup]);

  // 行 hover tooltip 定位:出现在行的右侧,垂直居中。靠右边界时改在左侧。
  const rowtipPos = useMemo(() => {
    if (!hoveredShortcut) return null;
    const TOOLTIP_WIDTH = 240;
    const GAP = 8;
    const VIEWPORT_PAD = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const { rect } = hoveredShortcut;
    let left = rect.right + GAP;
    // 右侧空间不够 → 放行左侧
    if (left + TOOLTIP_WIDTH > vw - VIEWPORT_PAD) {
      left = rect.left - GAP - TOOLTIP_WIDTH;
      if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    }
    const top = rect.top + rect.height / 2 - 30; // 大致居中,实际高度由内容决定
    return { top, left };
  }, [hoveredShortcut]);

  return (
    <div
      ref={rootRef}
      className="sl-sl-root"
      style={{ ['--sl-sl-sidebar-w' as string]: `${sidebarWidth}px` }}
    >
      <div className={`sl-sl-userkv-bar sl-sl-userkv-bar--${auth.jwtAuthState}`}>
        {auth.jwtAuthState === 'logged-in' && auth.token ? (
          <span className="sl-sl-sync-pill">已登录 {auth.jwtUser?.email ?? ''}</span>
        ) : (
          <button className="sl-sl-btn sl-sl-btn--ghost" onClick={loginModal.open}>
            登录
          </button>
        )}
        <button
          className="sl-sl-icon-btn"
          aria-label="设置"
          title="设置"
          onClick={() => setShowSettings(true)}
        >
          ⚙
        </button>
        {auth.jwtAuthState === 'logged-in' && (
          <button
            className="sl-sl-btn sl-sl-btn--ghost"
            onClick={() =>
              void logoutWithConfirm({
                saveMode: store.saveMode,
                dirty: store.dirty,
                warnOnDirtyExit: store.warnOnDirtyExit,
                // 返回 promise,让 logoutWithConfirm 在失败时弹「保存失败」alert
                flushDirty: () => store.flushDirty(),
              })
            }
          >
            退出
          </button>
        )}
      </div>

      <Sidebar
        groups={store.groups}
        selectedGroupId={store.selectedGroupId}
        onSelect={store.setSelectedGroupId}
        onAdd={store.addGroup}
        onRename={store.renameGroup}
        onDelete={store.deleteGroup}
        filter={store.query}
      />
      <div
        className="sl-sl-resize-handle sl-sl-resize-handle--col"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={sidebarWidth}
        aria-label="调整侧栏宽度"
        tabIndex={0}
        onPointerDown={(e) => startDrag('sidebar', e)}
        onKeyDown={(e) => onSplitterKeyDown('sidebar', e)}
      />

      <main className="sl-sl-main">
        <header className="sl-sl-topbar">
          <input
            className="sl-sl-input sl-sl-topbar__search"
            placeholder="搜索组合键或说明 (例如 Ctrl+R / 打开目录)"
            value={store.query}
            onChange={(e) => store.setQuery(e.target.value)}
          />
          <button
            className="sl-sl-btn sl-sl-btn--ghost"
            onClick={() => setShowImport(true)}
          >
            导入
          </button>
          <span className="sl-sl-topbar__meta">
            {store.groups.length} 个分组 · 共{' '}
            {store.groups.reduce((n, g) => n + g.shortcuts.length, 0)} 条
          </span>
        </header>

        {store.selectedGroup ? (
          <ShortcutTable
            group={store.selectedGroup}
            query={store.query}
            onAddShortcut={(combo, desc, condition) => store.addShortcut(store.selectedGroup!.id, combo, desc, condition)}
            onUpdateShortcut={(id, patch) => store.updateShortcut(store.selectedGroup!.id, id, patch)}
            onDeleteShortcut={(id) => store.deleteShortcut(store.selectedGroup!.id, id)}
            onCapture={setHighlightedCodes}
            onHover={(codes) => setHoveredCodes(codes ?? new Set())}
            onShortcutHover={(shortcut, rect) => {
              if (shortcut && rect) setHoveredShortcut({ shortcut, rect });
              else setHoveredShortcut(null);
            }}
          />
        ) : (
          <div className="sl-sl-empty-state">
            <h2>还没有分组</h2>
            <p>在左侧输入名称(例如 VSCode、Chrome)并点击 +,即可开始管理快捷键。</p>
          </div>
        )}

        {!previewCollapsed && (
          <div
            className="sl-sl-resize-handle sl-sl-resize-handle--row"
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={previewHeight}
            aria-label="调整键盘预览高度"
            tabIndex={0}
            onPointerDown={(e) => startDrag('preview', e)}
            onKeyDown={(e) => onSplitterKeyDown('preview', e)}
          />
        )}
        <section
          ref={previewRef}
          className={`sl-sl-preview ${previewCollapsed ? 'is-collapsed' : ''}`}
          style={previewCollapsed ? undefined : { ['--sl-sl-preview-h' as string]: `${previewHeight}px` }}
        >
          <div className="sl-sl-preview__head">
            <span className="sl-sl-preview__title">键盘预览</span>
            <span className="sl-sl-preview__hint">
              {previewCollapsed
                ? '已折叠 · 点右侧展开查看按键状态'
                : hoveredCodes.size > 0
                  ? '悬浮在表格行上'
                  : highlightedCodes.size > 0
                    ? '高亮的是最近一次录入的按键'
                    : '在页面上按下任意键试试 →'}
            </span>
            <button
              className="sl-sl-icon-btn sl-sl-preview__toggle"
              title={previewCollapsed ? '展开键盘预览' : '收起键盘预览'}
              aria-label={previewCollapsed ? '展开键盘预览' : '收起键盘预览'}
              aria-expanded={!previewCollapsed}
              onClick={() => setPreviewCollapsed((v) => !v)}
            >
              {previewCollapsed ? '▴' : '▾'}
            </button>
          </div>
          {!previewCollapsed && (
            <Keyboard
              highlightedCodes={highlightedCodes}
              hoveredCodes={hoveredCodes}
              heldKeys={heldKeys}
              onPress={holdPress}
              onRelease={holdRelease}
              onKeyHoverEnter={handleHoverEnter}
              onKeyHoverLeave={handleHoverLeave}
              onDoubleClickKey={handleDoubleClickKey}
            />
          )}
        </section>
      </main>

      {showImport && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        saveMode={store.saveMode}
        onChangeSaveMode={store.setSaveMode}
        warnOnDirtyExit={store.warnOnDirtyExit}
        onToggleWarnOnDirtyExit={store.setWarnOnDirtyExit}
        dirty={store.dirty}
        saving={store.saving}
        onFlushDirty={() => store.flushDirty()}
      />

      {/* 长按 popup —— portal 到 host target(优先 shadowRoot,fallback document.body),
          避免被 .sl-sl-preview 的 overflow-x:auto 裁剪。
          外部点击/键盘 Esc 关闭;Keyboard 鼠标松开也会主动关闭 */}
      {portalRoot && longPressPopup && longPressPopupPos && createPortal(
        <div
          className="sl-sl-longpress"
          role="dialog"
          aria-label={`按键 ${longPressPopup.code} 的映射`}
          style={{ top: longPressPopupPos.top, left: longPressPopupPos.left }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="sl-sl-longpress__head">
            <span className="sl-sl-longpress__title">
              按键 <code>{longPressPopup.code}</code> 的映射
            </span>
            <button
              className="sl-sl-icon-btn"
              aria-label="关闭"
              onClick={handleLongPressClose}
            >×</button>
          </div>
          {longPressPopup.hits.length === 0 ? (
            <div className="sl-sl-longpress__empty">该键尚未被任何分组使用</div>
          ) : (
            <ul className="sl-sl-longpress__list">
              {longPressPopup.hits.slice(0, LONG_PRESS_MAX).map((h) => (
                <li key={h.shortcutId} className="sl-sl-longpress__item">
                  <div className="sl-sl-longpress__row">
                    <span className="sl-sl-longpress__group">{h.groupName}</span>
                    <span className="sl-sl-longpress__combo">{h.comboLabel}</span>
                  </div>
                  <div className="sl-sl-longpress__desc">
                    {h.description || <span className="sl-sl-empty">未填写说明</span>}
                  </div>
                  {h.condition && (
                    <div className="sl-sl-longpress__cond">条件: {h.condition}</div>
                  )}
                </li>
              ))}
              {longPressPopup.hits.length > LONG_PRESS_MAX && (
                <li className="sl-sl-longpress__more">
                  … 还有 {longPressPopup.hits.length - LONG_PRESS_MAX} 条
                </li>
              )}
            </ul>
          )}
        </div>,
        portalRoot,
      )}

      {/* 行 hover tooltip —— 鼠标在表格行上时,右侧显示完整快捷键 + 说明 + 条件。
          使用 portal 避免被 .sl-sl-table__viewport 的 overflow:auto 裁剪。 */}
      {portalRoot && hoveredShortcut && rowtipPos && createPortal(
        <div
          className="sl-sl-rowtip"
          role="tooltip"
          style={{ top: rowtipPos.top, left: rowtipPos.left }}
        >
          <div className="sl-sl-rowtip__combo">
            {hoveredShortcut.shortcut.combo.map((k, i) => (
              <span key={`${k.code}-${i}`}>
                {i > 0 && <span style={{ color: 'var(--sl-color-text-mute)', margin: '0 2px' }}>+</span>}
                <kbd className="sl-sl-chip">{k.label}</kbd>
              </span>
            ))}
          </div>
          <div className="sl-sl-rowtip__desc">
            {hoveredShortcut.shortcut.description || (
              <span className="sl-sl-empty">未填写说明</span>
            )}
          </div>
          {hoveredShortcut.shortcut.condition && (
            <div className="sl-sl-rowtip__cond">条件: {hoveredShortcut.shortcut.condition}</div>
          )}
        </div>,
        portalRoot,
      )}
    </div>
  );
}
