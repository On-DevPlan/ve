// pages/Sidebar.tsx —— 左侧工作空间列表面板(品牌区 + 列表 + 创建表单 + 用户卡)
// 布局:
//   - 品牌区(产品 logo + 名字)
//   - "工作空间" label + 列表(默认组用 ★ 标识)
//   - 底部用户卡(头像 + 邮箱 + 设置齿轮)
//
// 设默认入口:每个非默认组行内 hover 显示"★ 默认"按钮,click → onSetDefault

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GroupSummary } from '@api/components/user-space';

interface Props {
  groups: GroupSummary[];
  selectedGroupId: number | null;
  defaultGroupId: number | null;
  /** 当前登录用户邮箱(用户卡 + 账户菜单显示);未登录传 null */
  userEmail: string | null;
  onSelect: (id: number) => void;
  onCreate: (name: string, description: string) => Promise<void> | void;
  onSetDefault: (id: number) => Promise<void> | void;
  onLogout: () => void;
  disabled?: boolean;
}

export default function Sidebar({
  groups,
  selectedGroupId,
  defaultGroupId,
  userEmail,
  onSelect,
  onCreate,
  onSetDefault,
  onLogout,
  disabled,
}: Props) {
  const [filter, setFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 点账户菜单外部 → 关闭
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

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
      setExpanded(false);
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    setMenuOpen(false);
    if (window.confirm('确认退出登录?')) onLogout();
  }

  const avatarLetter = userEmail ? userEmail.slice(0, 1).toUpperCase() : '?';

  return (
    <aside className="sl-us-side">
      {/* 品牌 */}
      <div className="sl-us-side__brand">
        <div className="sl-us-side__brand-mark" />
        <div className="sl-us-side__brand-name">User Space</div>
      </div>

      {/* 工作空间列表 */}
      <div className="sl-us-side__section">
        <div className="sl-us-side__label">
          <span>工作空间</span>
          <button
            className="sl-us-side__add"
            title="新建工作空间"
            onClick={() => setExpanded((v) => !v)}
            disabled={disabled}
            aria-label="新建工作空间"
          >
            +
          </button>
        </div>

        <input
          className="sl-us-input"
          style={{ height: 26, fontSize: 12 }}
          placeholder="搜索…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="sl-us-side__list" style={{ marginTop: 4 }}>
          {filtered.length === 0 && (
            <div className="sl-us-muted" style={{ padding: '8px 8px', textAlign: 'center' }}>
              {groups.length === 0 ? '尚无工作空间' : '无匹配'}
            </div>
          )}
          {filtered.map((g) => {
            const active = g.id === selectedGroupId;
            const isDefault = g.id === defaultGroupId;
            return (
              <div
                key={g.id}
                className={`sl-us-side__item ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(g.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(g.id);
                  }
                }}
              >
                <span className="sl-us-side__item-mark">◇</span>
                <span className="sl-us-side__item-name">{g.name}</span>
                {isDefault ? (
                  <span
                    className="sl-us-chip sl-us-chip--default"
                    style={{ fontSize: 10, padding: '0 5px' }}
                    title="默认工作空间"
                  >
                    默认
                  </span>
                ) : g.myRole !== 'reader' ? (
                  <button
                    className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
                    style={{ width: 20, height: 20, fontSize: 11, padding: 0 }}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onSetDefault(g.id);
                    }}
                    title="设为默认工作空间"
                    aria-label={`将 ${g.name} 设为默认`}
                  >
                    ★
                  </button>
                ) : (
                  <span className="sl-us-side__item-meta">{g.memberCount}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 创建表单(展开态) */}
      {expanded && (
        <form
          className="sl-us-side__section"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 12, paddingBottom: 12 }}
          onSubmit={submitCreate}
        >
          <div className="sl-us-side__label" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <span>新建工作空间</span>
          </div>
          <input
            className="sl-us-input"
            placeholder="名称(必填)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={creating}
            autoFocus
            style={{ marginBottom: 6 }}
          />
          <input
            className="sl-us-input"
            placeholder="描述(可选)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            disabled={creating}
            style={{ marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="sl-us-btn sl-us-btn--ghost"
              onClick={() => setExpanded(false)}
              disabled={creating}
              style={{ flex: 1 }}
            >
              取消
            </button>
            <button
              type="submit"
              className="sl-us-btn sl-us-btn--primary"
              disabled={creating || !newName.trim()}
              style={{ flex: 1 }}
            >
              {creating ? '创建中…' : '创建'}
            </button>
          </div>
        </form>
      )}

      {/* 用户卡(底部) */}
      <div className="sl-us-side__user-wrap" ref={menuRef}>
        {menuOpen && (
          <div className="sl-us-side__menu" role="menu">
            <div className="sl-us-side__menu-head">
              <div className="sl-us-side__user-avatar">{avatarLetter}</div>
              <div className="sl-us-side__menu-email" title={userEmail ?? undefined}>
                {userEmail ?? '未登录'}
              </div>
            </div>
            <button
              className="sl-us-side__menu-item sl-us-side__menu-item--danger"
              onClick={handleLogout}
              role="menuitem"
            >
              退出登录
            </button>
          </div>
        )}
        <div className="sl-us-side__user">
          <div className="sl-us-side__user-avatar">{avatarLetter}</div>
          <div className="sl-us-side__user-name">{userEmail ?? '未登录'}</div>
          <button
            className="sl-us-side__user-action"
            title="账户"
            aria-label="账户菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⚙
          </button>
        </div>
      </div>
    </aside>
  );
}
