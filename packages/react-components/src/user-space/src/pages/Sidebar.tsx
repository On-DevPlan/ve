// pages/Sidebar.tsx —— 左侧工作空间列表面板(可搜索、创建、设默认)
// "我的工作空间"按以下顺序展示:
//   - 当前默认组(☆ badge)
//   - 我创建的组(owned)
//   - 我加入的组(joined)
// 排序:默认组在前 / owned 在前 / 其余按更新时间倒序

import { useState, type FormEvent } from 'react';
import type { GroupSummary } from '@api/components/user-space';

interface Props {
  groups: GroupSummary[];
  selectedGroupId: number | null;
  defaultGroupId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string, description: string) => Promise<void> | void;
  onSetDefault: (id: number) => Promise<void> | void;
  disabled?: boolean;
}

function roleBadge(role: GroupSummary['myRole']): string {
  switch (role) {
    case 'owner':
      return 'OWNER';
    case 'admin':
      return 'ADMIN';
    case 'writer':
      return 'WRITER';
    case 'reader':
      return 'READER';
  }
}

export default function Sidebar({
  groups,
  selectedGroupId,
  defaultGroupId,
  onSelect,
  onCreate,
  onSetDefault,
  disabled,
}: Props) {
  const [filter, setFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase()),
  );

  async function submitCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name, newDesc.trim());
      setNewName('');
      setNewDesc('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="sl-us-sidebar">
      <div className="sl-us-sidebar__head">
        <span className="sl-us-sidebar__title">工作空间</span>
        <span className="sl-us-sidebar__count">{groups.length}</span>
      </div>

      <input
        className="sl-us-input"
        placeholder="搜索工作空间…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <ul className="sl-us-sidebar__list">
        {filtered.length === 0 && (
          <li className="sl-us-sidebar__empty">
            {groups.length === 0 ? '尚无工作空间' : '无匹配工作空间'}
          </li>
        )}
        {filtered.map((g) => {
          const active = g.id === selectedGroupId;
          const isDefault = g.id === defaultGroupId;
          return (
            <li
              key={g.id}
              className={`sl-us-sidebar__item ${active ? 'is-active' : ''}`}
              onClick={() => onSelect(g.id)}
            >
              <span className="sl-us-sidebar__name">{g.name}</span>
              <span className="sl-us-sidebar__meta">
                <span className={`sl-us-badge sl-us-badge--role-${g.myRole}`}>
                  {roleBadge(g.myRole)}
                </span>
                {isDefault && (
                  <span className="sl-us-badge sl-us-badge--default" title="默认工作空间">
                    ★
                  </span>
                )}
                <span className="sl-us-sidebar__count">{g.memberCount}</span>
              </span>
              {!isDefault && g.myRole !== 'reader' && (
                <button
                  className="sl-us-icon-btn"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onSetDefault(g.id);
                  }}
                  title="设为默认工作空间"
                >
                  设为默认
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className={`sl-us-sidebar__create ${expanded ? 'is-open' : ''}`}
        onSubmit={submitCreate}
      >
        <button
          type="button"
          className="sl-us-sidebar__create-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '取消' : '+ 新建工作空间'}
        </button>
        {expanded && (
          <>
            <input
              className="sl-us-input"
              placeholder="工作空间名称(必填)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              autoFocus
            />
            <input
              className="sl-us-input"
              placeholder="描述(可选)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              disabled={creating}
            />
            <button
              type="submit"
              className="sl-us-btn sl-us-btn--primary"
              disabled={creating || !newName.trim()}
            >
              {creating ? '创建中…' : '创建'}
            </button>
          </>
        )}
      </form>
    </aside>
  );
}
