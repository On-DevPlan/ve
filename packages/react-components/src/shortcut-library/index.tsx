// index.tsx —— ShortcutLibrary 组件入口
// 布局:左 sidebar(分组) + 主区(快捷键表格) + 下(键盘预览)

import { useEffect, useState } from 'react';
import './index.css';
import { useShortcuts } from './useShortcuts';
import Sidebar from './Sidebar';
import ShortcutTable from './ShortcutTable';
import Keyboard from './Keyboard';

export default function ShortcutLibrary() {
  const store = useShortcuts();
  const [highlightedCodes, setHighlightedCodes] = useState<Set<string>>(new Set());

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
              {highlightedCodes.size > 0 ? '高亮的是最近一次录入的按键' : '录入或选择快捷键以高亮'}
            </span>
          </div>
          <Keyboard highlightedCodes={highlightedCodes} />
        </section>
      </main>
    </div>
  );
}
