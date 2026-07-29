// index.tsx —— ShortcutLibrary 组件入口
// 布局:左 sidebar(分组) + 主区(快捷键表格) + 下(键盘预览)

import { useCallback, useEffect, useRef, useState } from 'react';
import './index.css';
import { useShortcuts } from './useShortcuts';
import ImportModal from './ImportModal';
import type { ImportParseResult } from './import-parser';
import type { ImportStats } from './useShortcuts';
import Sidebar from './Sidebar';
import ShortcutTable from './ShortcutTable';
import Keyboard from './Keyboard';

// 按下后高亮停留时间 —— transition 渐变时长写在 CSS 中
const FLASH_DURATION_MS = 280;

export default function ShortcutLibrary() {
  const store = useShortcuts();
  const [highlightedCodes, setHighlightedCodes] = useState<Set<string>>(new Set());
  const [hoveredCodes, setHoveredCodes] = useState<Set<string>>(new Set());
  // flashCodes: 用户物理按键的瞬时高亮集合 —— 与 on / hover 互不冲突
  const [flashCodes, setFlashCodes] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  // 记录每个 code 的清除 timer,组件卸载/重复按下时清理
  const flashTimers = useRef<Map<string, number>>(new Map());

  function handleImport(data: ImportParseResult): ImportStats {
    return store.importGroups(data);
  }

  // 物理按键触发"瞬时高亮"——代码映射到 KeyboardEvent.code,避免和输入框冲突
  const flashKey = useCallback((code: string) => {
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
            onAddShortcut={(combo, desc) => store.addShortcut(store.selectedGroup!.id, combo, desc)}
            onUpdateShortcut={(id, patch) => store.updateShortcut(store.selectedGroup!.id, id, patch)}
            onDeleteShortcut={(id) => store.deleteShortcut(store.selectedGroup!.id, id)}
            onCapture={setHighlightedCodes}
            onHover={(codes) => setHoveredCodes(codes ?? new Set())}
          />
        ) : (
          <div className="sl-sl-empty-state">
            <h2>还没有分组</h2>
            <p>在左侧输入名称(例如 VSCode、Chrome)并点击 +,即可开始管理快捷键。</p>
          </div>
        )}

        <section className="sl-sl-preview">
          <div className="sl-sl-preview__head">
            <span className="sl-sl-preview__title">键盘预览</span>
            <span className="sl-sl-preview__hint">
              {hoveredCodes.size > 0
                ? '悬浮在表格行上'
                : highlightedCodes.size > 0
                  ? '高亮的是最近一次录入的按键'
                  : '在页面上按下任意键试试 →'}
            </span>
          </div>
          <Keyboard
            highlightedCodes={highlightedCodes}
            hoveredCodes={hoveredCodes}
            flashCodes={flashCodes}
          />
        </section>
      </main>

      {showImport && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
