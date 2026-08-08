// pages/Invitations.tsx —— 邀请管理视图
//
// 列表显示组内活跃邀请(status=1),每行含:
//   - 邀请码(可复制 + 显示二维码简化版:仅展示 code)
//   - 收件人邮箱 / 角色 / maxUses / 已用 / 过期时间
//   - 撤销按钮(admin+)
// 顶部"发起邀请"按钮(admin+)打开表单,创建后把新邀请插入列表。

import { useEffect, useState, type FormEvent } from 'react';
import type { GroupInvitationView, GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

interface Props {
  group: GroupSummary;
  invitations: GroupInvitationView[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  onCreate: (args: {
    inviteeEmail: string;
    role: Exclude<GroupInvitationView['role'], 'owner'>;
    maxUses?: number;
    ttlSeconds?: number;
  }) => Promise<GroupInvitationView>;
  onRevoke: (invitationId: number) => Promise<void>;
  onReload: () => Promise<void>;
  onAcceptExternal?: (code: string) => Promise<GroupSummary>;
}

export default function Invitations({
  group, invitations, loading, error, saving, onCreate, onRevoke, onReload, onAcceptExternal,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<GroupInvitationView['role'], 'owner'>>('writer');
  const [maxUses, setMaxUses] = useState(1);
  const [ttlDays, setTtlDays] = useState(7);
  const [lastCreated, setLastCreated] = useState<GroupInvitationView | null>(null);
  const [copied, setCopied] = useState(false);

  const [acceptCode, setAcceptCode] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    setComposing(false);
    setLastCreated(null);
    setEmail('');
    setRole('writer');
    setMaxUses(1);
    setTtlDays(7);
    setCopied(false);
  }, [group.id]);

  const canInvite = hasMinRole(group.myRole, 'admin');

  async function copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 降级:老浏览器 / HTTP 下 clipboard API 不可用 → prompt 手动复制
      window.prompt('复制邀请码:', code);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ttlSeconds = ttlDays > 0 ? ttlDays * 86400 : 0;
    const maxUsesFinal = maxUses > 0 ? maxUses : 0;
    const created = await onCreate({
      inviteeEmail: email.trim(),
      role,
      maxUses: maxUsesFinal,
      ttlSeconds,
    });
    setLastCreated(created);
    setComposing(false);
    setEmail('');
  }

  async function submitAccept() {
    if (!acceptCode.trim() || !onAcceptExternal) return;
    setAccepting(true);
    try {
      await onAcceptExternal(acceptCode.trim());
      setAcceptCode('');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <section className="sl-us-section sl-us-invitations">
      <div className="sl-us-section__head">
        <h3 className="sl-us-section__title">邀请</h3>
        <span className="sl-us-toolbar__spacer" />
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
        {canInvite && (
          <button
            className="sl-us-btn sl-us-btn--primary"
            onClick={() => setComposing((v) => !v)}
            disabled={saving}
          >
            {composing ? '取消' : '发起邀请'}
          </button>
        )}
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      {lastCreated && (
        <div className="sl-us-invite-result">
          <div className="sl-us-invite-result__row">
            <span className="sl-us-invite-result__label">邀请码</span>
            <code className="sl-us-invite-result__code">{lastCreated.code}</code>
            <button
              className="sl-us-btn sl-us-btn--sm"
              onClick={() => void copyCode(lastCreated.code)}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          {!lastCreated.inviteeEmail && (
            <div className="sl-us-invite-result__hint">
              未指定收件人,请手动把邀请码发给对方
            </div>
          )}
        </div>
      )}

      {onAcceptExternal && (
        <div className="sl-us-accept">
          <input
            className="sl-us-input"
            placeholder="输入邀请码以加入新工作空间"
            value={acceptCode}
            onChange={(e) => setAcceptCode(e.target.value)}
            disabled={accepting}
          />
          <button
            className="sl-us-btn sl-us-btn--primary"
            onClick={() => void submitAccept()}
            disabled={accepting || !acceptCode.trim()}
          >
            {accepting ? '加入中…' : '接受邀请'}
          </button>
        </div>
      )}

      {composing && (
        <form className="sl-us-invite-form" onSubmit={submit}>
          <input
            className="sl-us-input"
            type="email"
            placeholder="收件人邮箱(可选,留空则手动分发)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoFocus
          />
          <select
            className="sl-us-input"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            disabled={saving}
          >
            <option value="admin">admin</option>
            <option value="writer">writer</option>
            <option value="reader">reader</option>
          </select>
          <input
            className="sl-us-input"
            type="number"
            min={0}
            placeholder="最大使用次数 (0=无限)"
            value={Number.isFinite(maxUses) ? maxUses : 1}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            disabled={saving}
          />
          <input
            className="sl-us-input"
            type="number"
            min={0}
            placeholder="有效期 (天,0=永不过期)"
            value={Number.isFinite(ttlDays) ? ttlDays : 7}
            onChange={(e) => setTtlDays(Number(e.target.value))}
            disabled={saving}
          />
          <button
            type="submit"
            className="sl-us-btn sl-us-btn--primary"
            disabled={saving}
          >
            {saving ? '创建中…' : '创建邀请'}
          </button>
        </form>
      )}

      <table className="sl-us-table">
        <thead>
          <tr>
            <th>邀请码</th>
            <th>收件人</th>
            <th>角色</th>
            <th>使用次数</th>
            <th>过期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {invitations.length === 0 && !loading && (
            <tr>
              <td colSpan={6} className="sl-us-table__empty">
                暂无活跃邀请
              </td>
            </tr>
          )}
          {invitations.map((inv) => (
            <tr key={inv.id}>
              <td>
                <code className="sl-us-code">{inv.code}</code>
              </td>
              <td>
                {inv.inviteeEmail
                  ? inv.inviteeEmail
                  : <span className="sl-us-muted" title="待 admin 分发">—</span>}
              </td>
              <td>
                <span className={`sl-us-badge sl-us-badge--role-${inv.role}`}>
                  {inv.role.toUpperCase()}
                </span>
              </td>
              <td>
                {inv.usedCount} / {inv.maxUses === 0 ? '∞' : inv.maxUses}
              </td>
              <td>{inv.expiresAt}</td>
              <td>
                {canInvite ? (
                  <button
                    className="sl-us-btn sl-us-btn--danger-ghost"
                    onClick={() => void onRevoke(inv.id)}
                    disabled={saving}
                  >
                    撤销
                  </button>
                ) : (
                  <span className="sl-us-muted">权限不足</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
