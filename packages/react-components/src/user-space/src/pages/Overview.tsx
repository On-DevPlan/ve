// pages/Overview.tsx —— 工作空间概览(基本信息 + 危险操作)
//
// 显示:
//   - 名称 / 描述(可编辑,myRole >= admin)
//   - 成员数量 / 角色
//   - 创建时间 / 最近活跃
// 操作:
//   - 改名称 / 描述(写权限校验)
//   - 设默认工作空间(右上角 ☆ 按钮,见 Sidebar)
//   - 主动退组 / 解散组(老板唯一 / 其他人;owner 不可退)

import { useState } from 'react';
import type { GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

interface Props {
  group: GroupSummary;
  saving: boolean;
  onSave: (args: { name?: string; description?: string }) => Promise<void>;
  onLeave: () => Promise<void>;
  onDissolve: () => Promise<void>;
}

export default function Overview({ group, saving, onSave, onLeave, onDissolve }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [confirming, setConfirming] = useState<'leave' | 'dissolve' | null>(null);

  const canEdit = hasMinRole(group.myRole, 'admin');
  const canDissolve = group.myRole === 'owner';
  const canLeave = group.myRole !== 'owner';

  async function commit() {
    const payload: { name?: string; description?: string } = {};
    if (name.trim() && name.trim() !== group.name) payload.name = name.trim();
    if (description !== group.description) payload.description = description;
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    await onSave(payload);
    setEditing(false);
  }

  function cancel() {
    setName(group.name);
    setDescription(group.description);
    setEditing(false);
  }

  return (
    <section className="sl-us-view sl-us-overview">
      <h3 className="sl-us-view__title">概览</h3>

      <div className="sl-us-card">
        <div className="sl-us-card__row">
          <label className="sl-us-label">名称</label>
          {editing ? (
            <input
              className="sl-us-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
          ) : (
            <span className="sl-us-value">{group.name}</span>
          )}
        </div>
        <div className="sl-us-card__row">
          <label className="sl-us-label">描述</label>
          {editing ? (
            <textarea
              className="sl-us-input sl-us-input--textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
            />
          ) : (
            <span className="sl-us-value">{group.description || '—'}</span>
          )}
        </div>
        <div className="sl-us-card__row">
          <label className="sl-us-label">成员</label>
          <span className="sl-us-value">{group.memberCount} 人</span>
        </div>
        <div className="sl-us-card__row">
          <label className="sl-us-label">我的角色</label>
          <span className={`sl-us-badge sl-us-badge--role-${group.myRole}`}>
            {group.myRole.toUpperCase()}
          </span>
        </div>
        <div className="sl-us-card__row">
          <label className="sl-us-label">创建时间</label>
          <span className="sl-us-value">{group.createdAt}</span>
        </div>
      </div>

      <div className="sl-us-actions">
        {editing ? (
          <>
            <button
              className="sl-us-btn sl-us-btn--primary"
              onClick={() => void commit()}
              disabled={saving || !name.trim()}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              className="sl-us-btn"
              onClick={cancel}
              disabled={saving}
            >
              取消
            </button>
          </>
        ) : (
          <button
            className="sl-us-btn"
            onClick={() => setEditing(true)}
            disabled={!canEdit}
            title={canEdit ? '编辑' : '需 admin 及以上权限'}
          >
            编辑
          </button>
        )}
      </div>

      <div className="sl-us-danger">
        <h4 className="sl-us-danger__title">危险操作</h4>
        {canLeave && (
          <div className="sl-us-danger__row">
            <span>退出该工作空间(将不可访问组内数据)</span>
            {confirming === 'leave' ? (
              <span className="sl-us-danger__confirm">
                <button
                  className="sl-us-btn sl-us-btn--danger"
                  onClick={() => void onLeave()}
                  disabled={saving}
                >
                  确认退出
                </button>
                <button
                  className="sl-us-btn"
                  onClick={() => setConfirming(null)}
                  disabled={saving}
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                className="sl-us-btn sl-us-btn--danger-ghost"
                onClick={() => setConfirming('leave')}
              >
                退出
              </button>
            )}
          </div>
        )}
        {canDissolve && (
          <div className="sl-us-danger__row">
            <span>解散工作空间(组内无 KV 且无人以此为默认组时才可解散)</span>
            {confirming === 'dissolve' ? (
              <span className="sl-us-danger__confirm">
                <button
                  className="sl-us-btn sl-us-btn--danger"
                  onClick={() => void onDissolve()}
                  disabled={saving}
                >
                  确认解散
                </button>
                <button
                  className="sl-us-btn"
                  onClick={() => setConfirming(null)}
                  disabled={saving}
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                className="sl-us-btn sl-us-btn--danger-ghost"
                onClick={() => setConfirming('dissolve')}
              >
                解散
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
