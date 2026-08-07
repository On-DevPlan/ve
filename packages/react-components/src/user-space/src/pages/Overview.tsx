// pages/Overview.tsx —— 工作空间概览
//
// 布局:
//   1. Toolbar(identity chip + ★ 设为默认 / 编辑)
//   2. 4 列 stats(成员 / KV / 邀请 / 创建时间)
//   3. 工作空间信息 section(名称/描述/角色/默认组/创建时间)
//   4. 危险操作(退出 / 解散,二次确认)
//
// ★ "设为默认" 按钮:已为默认时禁用并显示文字态;非默认时是主操作。
//   调 onSetDefault → userSpaceStore.setDefaultGroup(group.id)
//   后端 PATCH /user/default-group,默认组切换会通过 refreshUser 同步到 jwtUser。

import { useState } from 'react';
import type { GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

interface Props {
  group: GroupSummary;
  defaultGroupName: string | null;
  saving: boolean;
  onSave: (args: { name?: string; description?: string }) => Promise<void>;
  onSetDefault: () => Promise<void>;
  onLeave: () => Promise<void>;
  onDissolve: () => Promise<void>;
}

export default function Overview({ group, defaultGroupName, saving, onSave, onSetDefault, onLeave, onDissolve }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [confirming, setConfirming] = useState<'leave' | 'dissolve' | null>(null);

  const canEdit = hasMinRole(group.myRole, 'admin');
  const canDissolve = group.myRole === 'owner';
  const canLeave = group.myRole !== 'owner';
  const canSetDefault = hasMinRole(group.myRole, 'writer') && !group.isDefault;

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
    <div>
      {/* Toolbar: 身份 / 设为默认 / 编辑 */}
      <div className="sl-us-toolbar">
        <span className="sl-us-key">{group.name}</span>
        <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>· ID {group.id}</span>
        <span className="sl-us-toolbar__spacer" />
        {/* ★ 设为默认 —— 主要操作 */}
        {group.isDefault ? (
          <span className="sl-us-chip sl-us-chip--default" title="当前默认工作空间">
            ★ 默认
          </span>
        ) : (
          <button
            className="sl-us-btn"
            disabled={!canSetDefault || saving}
            onClick={() => void onSetDefault()}
            title={canSetDefault ? '将当前组设为默认工作空间' : '需 writer 及以上权限'}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>★</span>
            设为默认
          </button>
        )}
        {editing ? (
          <>
            <button className="sl-us-btn" onClick={cancel} disabled={saving}>取消</button>
            <button
              className="sl-us-btn sl-us-btn--primary"
              onClick={() => void commit()}
              disabled={saving || !name.trim()}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </>
        ) : (
          <button
            className="sl-us-btn"
            onClick={() => setEditing(true)}
            disabled={!canEdit}
            title={canEdit ? '编辑名称 / 描述' : '需 admin 及以上权限'}
          >
            编辑
          </button>
        )}
      </div>

      {/* 统计卡 */}
      <div className="sl-us-stats">
        <div className="sl-us-stat">
          <div className="sl-us-stat__label">成员</div>
          <div className="sl-us-stat__value">{group.memberCount}</div>
          <div className="sl-us-stat__hint">含 owner 1</div>
        </div>
        <div className="sl-us-stat">
          <div className="sl-us-stat__label">KV 项</div>
          <div className="sl-us-stat__value">—</div>
          <div className="sl-us-stat__hint">查看 KV 库存 tab</div>
        </div>
        <div className="sl-us-stat">
          <div className="sl-us-stat__label">活跃邀请</div>
          <div className="sl-us-stat__value">—</div>
          <div className="sl-us-stat__hint">查看邀请 tab</div>
        </div>
        <div className="sl-us-stat">
          <div className="sl-us-stat__label">创建时间</div>
          <div className="sl-us-stat__value" style={{ fontSize: 14, fontWeight: 500 }}>{group.createdAt}</div>
          <div className="sl-us-stat__hint">{group.updatedAt}</div>
        </div>
      </div>

      {/* 工作空间信息 */}
      <div className="sl-us-section">
        <div className="sl-us-section__head">
          <span className="sl-us-section__title">工作空间信息</span>
        </div>
        <div className="sl-us-section__body">
          <div className="sl-us-section__row">
            <span className="sl-us-section__row-label">名称</span>
            <span>
              {editing ? (
                <input
                  className="sl-us-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  autoFocus
                  style={{ maxWidth: 320 }}
                />
              ) : (
                group.name
              )}
            </span>
          </div>
          <div className="sl-us-section__row">
            <span className="sl-us-section__row-label">描述</span>
            <span>
              {editing ? (
                <textarea
                  className="sl-us-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  rows={2}
                  style={{ padding: 6, maxWidth: 480, fontFamily: 'inherit' }}
                />
              ) : (
                group.description || <span style={{ color: 'var(--fg-3)' }}>未填写</span>
              )}
            </span>
          </div>
          <div className="sl-us-section__row">
            <span className="sl-us-section__row-label">所有者</span>
            <span>用户 #{group.ownerId}</span>
          </div>
          <div className="sl-us-section__row">
            <span className="sl-us-section__row-label">我的角色</span>
            <span><span className={`sl-us-chip sl-us-chip--${group.myRole}`}>{group.myRole.toUpperCase()}</span></span>
          </div>
          <div className="sl-us-section__row">
            <span className="sl-us-section__row-label">默认组</span>
            <span>
              {group.isDefault ? (
                <>
                  <span className="sl-us-chip sl-us-chip--default">★ 是</span>
                  <span style={{ color: 'var(--fg-3)', fontSize: 11.5, marginLeft: 6 }}>
                    所有 KV 操作(不传 groupId)走此组
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--fg-3)' }}>
                  否 · 当前默认是
                  {defaultGroupName && <span className="sl-us-key" style={{ marginLeft: 4 }}>{defaultGroupName}</span>}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 危险操作 */}
      {(canLeave || canDissolve) && (
        <div className="sl-us-danger">
          <div className="sl-us-danger__head">危险操作</div>
          {canLeave && (
            <div className="sl-us-danger__row">
              <div className="sl-us-danger__row-main">
                <div>退出该工作空间</div>
                <div className="sl-us-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  退出后不可访问组内数据(owner 不可退)
                </div>
              </div>
              {confirming === 'leave' ? (
                <div className="sl-us-danger__row-confirm">
                  <button className="sl-us-btn sl-us-btn--primary" onClick={() => void onLeave()} disabled={saving}>
                    确认退出
                  </button>
                  <button className="sl-us-btn" onClick={() => setConfirming(null)} disabled={saving}>
                    取消
                  </button>
                </div>
              ) : (
                <button className="sl-us-btn sl-us-btn--danger-ghost" onClick={() => setConfirming('leave')}>
                  退出
                </button>
              )}
            </div>
          )}
          {canDissolve && (
            <div className="sl-us-danger__row">
              <div className="sl-us-danger__row-main">
                <div>解散工作空间</div>
                <div className="sl-us-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  组内无 KV 且无人以此为默认组时才可解散
                </div>
              </div>
              {confirming === 'dissolve' ? (
                <div className="sl-us-danger__row-confirm">
                  <button className="sl-us-btn sl-us-btn--primary" onClick={() => void onDissolve()} disabled={saving}>
                    确认解散
                  </button>
                  <button className="sl-us-btn" onClick={() => setConfirming(null)} disabled={saving}>
                    取消
                  </button>
                </div>
              ) : (
                <button className="sl-us-btn sl-us-btn--danger-ghost" onClick={() => setConfirming('dissolve')}>
                  解散
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
