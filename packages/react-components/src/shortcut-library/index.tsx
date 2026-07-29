// index.tsx —— ShortcutLibrary 组件入口
// 布局:左 sidebar(分组) + 主区(快捷键表格) + 下(键盘预览,可折叠)
// 键盘预览支持:
//   - 物理按键短按:is-flash 闪亮 280ms(per-code 节流 50ms 防止自动连发造成视觉抖动)
//   - 长按 250ms:在键上方/侧边弹出 mapping popup,显示「该键绑定在: ...」
// 表格行 hover:右侧弹 floating description tooltip

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './index.css';
import { useShortcuts, findBindingsByCode, type BindingHit } from './useShortcuts';
import ImportModal from './ImportModal';
import type { ImportParseResult } from './import-parser';
import type { ImportStats } from './useShortcuts';
import type { Shortcut } from './types';
import Sidebar from './Sidebar';
import ShortcutTable from './ShortcutTable';
import Keyboard from './Keyboard';

// 按下后高亮停留时间 —— transition 渐变时长写在 CSS 中
const FLASH_DURATION_MS = 280;
// flash 节流:同一个 code 在 50ms 内重复触发,不重新启动 setTimeout。
// 自动连发(R-repeat 60Hz)时,这是必要的视觉去抖。
const FLASH_THROTTLE_MS = 50;
// 长按阈值 —— 鼠标按下到 popup 出现之间的等待时间
const LONG_PRESS_MS = 250;
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
  const [highlightedCodes, setHighlightedCodes] = useState<Set<string>>(new Set());
  const [hoveredCodes, setHoveredCodes] = useState<Set<string>>(new Set());
  // flashCodes: 用户物理按键的瞬时高亮集合 —— 与 on / hover 互不冲突
  const [flashCodes, setFlashCodes] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  // 键盘预览折叠态 —— 默认展开;用户手动收起后写入 LS,下次进详情页保持
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(loadPreviewCollapsed);
  // 记录每个 code 的清除 timer,组件卸载/重复按下时清理
  const flashTimers = useRef<Map<string, number>>(new Map());
  // flash 节流 —— 每个 code 最近一次触发的时间戳
  const flashLastAt = useRef<Map<string, number>>(new Map());
  // 长按 popup 状态(由 Keyboard 子组件回调触发)
  const [longPressPopup, setLongPressPopup] = useState<PopupState | null>(null);
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

  // 物理按键触发"瞬时高亮"——代码映射到 KeyboardEvent.code,避免和输入框冲突。
  // 节流:同一 code 在 FLASH_THROTTLE_MS 内不重复重启 timer,避免自动连发时 DOM 闪烁。
  const flashKey = useCallback((code: string) => {
    const now = performance.now();
    const last = flashLastAt.current.get(code) ?? 0;
    if (now - last < FLASH_THROTTLE_MS) return;
    flashLastAt.current.set(code, now);
    setFlashCodes((prev) => {
      if (prev.has(code)) return prev; // 已经在闪,不重复入集合,延长定时器
      const next = new Set(prev);
      next.add(code);
      return next;
    });
    const existing = flashTimers.current.get(code);
    if (existing) window.clearTimeout(existing);
    const t = window.setTimeout(() => {
      setFlashCodes((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      flashTimers.current.delete(code);
    }, FLASH_DURATION_MS);
    flashTimers.current.set(code, t);
  }, []);

  // 长按 popup:查询并展示
  // - 通过 Keyboard 子组件回调拿到 code 和 rect
  // - 用 createPortal 渲染到 host portal target,避免被 .sl-sl-preview 的 overflow 裁剪
  const handleLongPress = useCallback(
    (code: string, rect: DOMRect) => {
      const hits = findBindingsByCode(store.groups, code);
      // 即使没有 hits 也展示 popup,告诉用户「该键未被任何分组使用」
      setLongPressPopup({ code, rect, hits });
    },
    [store.groups],
  );

  const handleLongPressClose = useCallback(() => {
    setLongPressPopup(null);
  }, []);

  // popup 打开时,监听 Esc 关闭 + 外部点击关闭
  useEffect(() => {
    if (!longPressPopup) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleLongPressClose();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      // popup 内部点击不关闭(自己处理)
      if (target?.closest('.sl-sl-longpress')) return;
      handleLongPressClose();
    }
    window.addEventListener('keydown', onKeyDown);
    // capture 阶段以确保在 popup 之前拿到事件
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [longPressPopup, handleLongPressClose]);

  // 全局 keydown 监听:页面任意位置的物理按键都会触发闪
  // 但要忽略输入框(让用户能正常打字)
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
      // 响应修饰键 + 普通键(包含单纯修饰键单独按下的场景)
      flashKey(e.code);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flashKey]);

  // 卸载清理所有 flash timer,避免 setState on unmounted
  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  // 高亮最近一次录入:3 秒后自动浅色
  useEffect(() => {
    if (highlightedCodes.size === 0) return;
    const t = window.setTimeout(() => setHighlightedCodes(new Set()), 3000);
    return () => window.clearTimeout(t);
  }, [highlightedCodes]);

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
    <div className="sl-sl-root">
      <Sidebar
        groups={store.groups}
        selectedGroupId={store.selectedGroupId}
        onSelect={store.setSelectedGroupId}
        onAdd={store.addGroup}
        onRename={store.renameGroup}
        onDelete={store.deleteGroup}
        filter={store.query}
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

        <section className={`sl-sl-preview ${previewCollapsed ? 'is-collapsed' : ''}`}>
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
              flashCodes={flashCodes}
              onLongPress={handleLongPress}
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
            <span className="sl-sl-longpress__title">按键 <code>{longPressPopup.code}</code> 的映射</span>
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
