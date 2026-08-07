// pages/Members.tsx —— 成员列表视图
//
// 列表:头像 + 邮箱 + 角色 chip + 加入时间 + 行 actions(改角色 / 踢出)
// 操作:admin+ 可改角色/踢人;owner 不可被改/踢;admin 不能改 own role(避免自我降权)
// UI 在按钮 disabled 状态做"为什么不能点"的提示;后端是单一事实源。

import { useEffect, useState } from 'react';
import type { GroupMemberView, GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

interface Props {
  group: GroupSummary;
  members: GroupMemberView[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  onChangeRole: (userId: number, role: GroupMemberView['role']) => Promise<void>;
  onRemove: (userId: number) => Promise<void>;
  onReload: () => Promise<void>;
}

const ROLE_OPTIONS: GroupMemberView['role'][] = ['admin', 'writer', 'reader'];

function avatarInitial(m: GroupMemberView): string {
  if (m.nickname) return m.nickname.slice(0, 1).toUpperCase();
  return (m.email || '?').slice(0, 1).toUpperCase();
}

export default function Members({
  group, members, loading, error, saving, onChangeRole, onRemove, onReload,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<GroupMemberView['role'] | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null);

  useEffect(() => {
    setEditingId(null);
    setPendingRemoveId(null);
  }, [group.id]);

  const canManage = hasMinRole(group.myRole, 'admin');

  async function commitChange(m: GroupMemberView) {
    if (!pendingRole) return;
    await onChangeRole(m.userId, pendingRole);
    setEditingId(null);
    setPendingRole(null);
  }

  async function commitRemove(m: GroupMemberView) {
    await onRemove(m.userId);
    setPendingRemoveId(null);
  }

  return (
    <div>
      <div className="sl-us-toolbar">
        <span style={{ color: 'var(--fg-2)', fontSize: 12.5 }}>{members.length} 个成员</span>
        <span className="sl-us-toolbar__spacer" />
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading}>
          ↻ 刷新
        </button>
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      <div className="sl-us-section">
        {members.length === 0 && !loading ? (
          <div className="sl-us-empty">
            <div className="sl-us-empty__title">暂无成员</div>
          </div>
        ) : (
          members.map((m) => {
            const isOwner = m.role === 'owner';
            const isSelf = m.isSelf;
            const canChangeThis = canManage && !isOwner && !(isSelf && group.myRole === 'admin');
            const canRemoveThis = canManage && !isOwner && !isSelf;
            const isEditing = editingId === m.userId;
            const isConfirmingRemove = pendingRemoveId === m.userId;
            return (
              <div key={m.userId} className="sl-us-member">
                <div className="sl-us-member__avatar">{avatarInitial(m)}</div>
                <div className="sl-us-member__main">
                  <div className="sl-us-member__name">
                    {m.email}
                    {isSelf && <span className="sl-us-chip" style={{ fontSize: 10, padding: '0 5px' }}>me</span>}
                  </div>
                  <div className="sl-us-member__email">{m.nickname || m.email}</div>
                </div>

                {isEditing ? (
                  <select
                    className="sl-us-input sl-us-input--compact"
                    value={pendingRole ?? m.role}
                    onChange={(e) => setPendingRole(e.target.value as GroupMemberView['role'])}
                    disabled={saving}
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className={`sl-us-chip sl-us-chip--${m.role}`}>{m.role.toUpperCase()}</span>
                )}

                <span className="sl-us-member__spacer" />

                {isEditing ? (
                  <>
                    <button
                      className="sl-us-btn"
                      onClick={() => { setEditingId(null); setPendingRole(null); }}
                      disabled={saving}
                    >
                      取消
                    </button>
                    <button
                      className="sl-us-btn sl-us-btn--primary"
                      onClick={() => void commitChange(m)}
                      disabled={saving || !pendingRole || pendingRole === m.role}
                    >
                      保存
                    </button>
                  </>
                ) : isConfirmingRemove ? (
                  <>
                    <button className="sl-us-btn" onClick={() => setPendingRemoveId(null)} disabled={saving}>
                      取消
                    </button>
                    <button
                      className="sl-us-btn sl-us-btn--primary"
                      onClick={() => void commitRemove(m)}
                      disabled={saving}
                    >
                      确认踢出
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="sl-us-btn"
                      disabled={!canChangeThis}
                      onClick={() => { setEditingId(m.userId); setPendingRole(m.role); }}
                      title={canChangeThis ? '改角色' : '权限不足'}
                    >
                      改角色
                    </button>
                    <button
                      className="sl-us-btn sl-us-btn--danger-ghost"
                      disabled={!canRemoveThis}
                      onClick={() => setPendingRemoveId(m.userId)}
                      title={canRemoveThis ? '踢出' : '权限不足'}
                    >
                      踢出
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
