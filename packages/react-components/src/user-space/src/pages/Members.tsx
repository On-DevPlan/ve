// pages/Members.tsx —— 成员列表视图
//
// 表格:email / nickname / role / 加入时间 / 操作
// 操作:
//   - 改角色(admin+;owner 不能改;admin 不能改 own role)
//   - 踢人(admin+;owner 不能被踢;admin 踢自己走退组)
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
    <section className="sl-us-view sl-us-members">
      <div className="sl-us-view__head">
        <h3 className="sl-us-view__title">成员</h3>
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      <table className="sl-us-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>昵称</th>
            <th>角色</th>
            <th>加入时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="sl-us-table__empty">
                暂无成员
              </td>
            </tr>
          )}
          {members.map((m) => {
            const isOwner = m.role === 'owner';
            const isSelf = m.isSelf;
            const canChangeThis = canManage && !isOwner && !(isSelf && group.myRole === 'admin');
            const canRemoveThis = canManage && !isOwner && !isSelf;
            const isEditing = editingId === m.userId;
            const isConfirmingRemove = pendingRemoveId === m.userId;
            return (
              <tr key={m.userId}>
                <td>
                  <span>{m.email}</span>
                  {isSelf && <span className="sl-us-badge sl-us-badge--self">YOU</span>}
                </td>
                <td>{m.nickname || '—'}</td>
                <td>
                  {isEditing ? (
                    <select
                      className="sl-us-input"
                      value={pendingRole ?? m.role}
                      onChange={(e) => setPendingRole(e.target.value as GroupMemberView['role'])}
                      disabled={saving}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`sl-us-badge sl-us-badge--role-${m.role}`}>
                      {m.role.toUpperCase()}
                    </span>
                  )}
                </td>
                <td>{m.joinedAt}</td>
                <td>
                  {isEditing ? (
                    <span className="sl-us-table__actions">
                      <button
                        className="sl-us-btn sl-us-btn--primary"
                        onClick={() => void commitChange(m)}
                        disabled={saving || !pendingRole || pendingRole === m.role}
                      >
                        保存
                      </button>
                      <button
                        className="sl-us-btn"
                        onClick={() => {
                          setEditingId(null);
                          setPendingRole(null);
                        }}
                        disabled={saving}
                      >
                        取消
                      </button>
                    </span>
                  ) : isConfirmingRemove ? (
                    <span className="sl-us-table__actions">
                      <button
                        className="sl-us-btn sl-us-btn--danger"
                        onClick={() => void commitRemove(m)}
                        disabled={saving}
                      >
                        确认踢出
                      </button>
                      <button
                        className="sl-us-btn"
                        onClick={() => setPendingRemoveId(null)}
                        disabled={saving}
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <span className="sl-us-table__actions">
                      <button
                        className="sl-us-btn"
                        disabled={!canChangeThis}
                        onClick={() => {
                          setEditingId(m.userId);
                          setPendingRole(m.role);
                        }}
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
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
