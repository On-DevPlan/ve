// Sidebar.tsx —— 左侧分组列表面板
// 显示全部分组(可搜索过滤),支持新增/重命名/删除;当前选中项高亮

import { useState, type ReactNode } from 'react';
import type { Group } from '../types';

interface Props {
  groups: Group[];
  selectedGroupId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  filter: string;
  /** 侧边栏底部账户/同步区(登录入口、设置、退出),由宿主注入 */
  footer?: ReactNode;
}

export default function Sidebar({
  groups,
  selectedGroupId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  filter,
  footer,
}: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // 就地二次确认删除:× → ? → 再点一次真删
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase()),
  );

  function commitNew() {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName('');
  }

  function commitRename() {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) onRename(editingId, name);
    setEditingId(null);
    setEditingName('');
  }

  return (
    <aside className="sl-sl-sidebar">
      <div className="sl-sl-sidebar__head">
        <span className="sl-sl-sidebar__title">应用分组</span>
        <span className="sl-sl-sidebar__count">{groups.length}</span>
      </div>

      <div className="sl-sl-sidebar__new">
        <input
          className="sl-sl-input"
          placeholder="新增分组…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitNew();
          }}
        />
        <button
          className="sl-sl-btn sl-sl-btn--primary"
          onClick={commitNew}
          disabled={!newName.trim()}
          aria-label="新增分组"
        >
          +
        </button>
      </div>

      <ul className="sl-sl-sidebar__list">
        {filtered.length === 0 && (
          <li className="sl-sl-sidebar__empty">无匹配分组</li>
        )}
        {filtered.map((g) => {
          const active = g.id === selectedGroupId;
          const isEditing = editingId === g.id;
          return (
            <li
              key={g.id}
              className={`sl-sl-sidebar__item ${active ? 'is-active' : ''}`}
              onClick={() => !isEditing && onSelect(g.id)}
            >
              {isEditing ? (
                <input
                  className="sl-sl-input sl-sl-input--inline"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditingName('');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="sl-sl-sidebar__name">{g.name}</span>
                  <span className="sl-sl-sidebar__badge">{g.shortcuts.length}</span>
                </>
              )}
              {!isEditing && (
                <span className="sl-sl-sidebar__actions">
                  <button
                    className="sl-sl-icon-btn"
                    title="重命名"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(g.id);
                      setEditingName(g.name);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className={`sl-sl-icon-btn sl-sl-icon-btn--danger${
                      confirmDeleteId === g.id ? ' is-confirming' : ''
                    }`}
                    title={confirmDeleteId === g.id ? '再点一次确认删除' : '删除'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDeleteId === g.id) {
                        onDelete(g.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(g.id);
                      }
                    }}
                    onBlur={() => {
                      // 失焦取消待确认
                      if (confirmDeleteId === g.id) setConfirmDeleteId(null);
                    }}
                  >
                    {confirmDeleteId === g.id ? '?' : '×'}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {footer}
    </aside>
  );
}
