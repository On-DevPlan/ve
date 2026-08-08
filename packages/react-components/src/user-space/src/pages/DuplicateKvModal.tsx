// pages/DuplicateKvModal.tsx —— 把当前 KV 复制到另一个工作空间。
//
// 设计:复用 KvEditorModal 的 .sl-us-modal* 样式 + portal 模式。展示态只读
// 当前 group + source key,用户选一个目标 group 后调 store.duplicateKv。
//
// 同组复制实际无意义(等同于 set 但多了次后端写),所以 <select> 默认排除源组
// —— 只列 caller 在其中拥有 writer+ 权限的其他组。如果没有任何可选目标组,
// 「确认」按钮 disable 并提示原因。
//
// source/target 必须不同:<select> 不会给 source 选项,所以 disable 规则
// 退化成「未选目标 / 无可写目标组」。

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasMinRole } from '@api/components/user-space';
import type { GroupSummary } from '@api/components/user-space';

export interface DuplicateKvModalProps {
  open: boolean;
  /** 源 KV 所在组(只读展示)。 */
  sourceGroup: GroupSummary;
  /** 源 key(只读展示)。 */
  sourceKey: string;
  /** 所有 caller 可见的工作空间列表(Inventory 页一定已有)。 */
  groups: GroupSummary[];
  /** Modal 内 saving 态(沿用父级 saving 标志,跟现有弹窗一致)。 */
  saving: boolean;
  /** 提交:把 KV 从 sourceGroup 复制到 targetGroupId;成功返回后端写的 newKey。 */
  onDuplicate: (args: { targetGroupId: number }) => Promise<{ newKey: string }>;
  onClose: () => void;
}

export default function DuplicateKvModal({ open, sourceGroup, sourceKey, groups, saving, onDuplicate, onClose }: DuplicateKvModalProps) {
  // 候选目标组:剔除源组 + 只留 caller 可写的(writer+)
  const writableOthers = useMemo(
    () => groups.filter((g) => g.id !== sourceGroup.id && hasMinRole(g.myRole, 'writer')),
    [groups, sourceGroup.id],
  );

  const [targetId, setTargetId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 每次重开弹窗:重置选择态,默认选第一个候选;没有候选就置 null。
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setSubmitting(false);
    setTargetId(writableOthers.length > 0 ? writableOthers[0].id : null);
  }, [open, writableOthers]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const noTargets = writableOthers.length === 0;
  // 未选目标 或 选了源组(防御性 —— select 不会给,但 props 万一传错)→ disable。
  const confirmDisabled = submitting || saving || noTargets || targetId === null || targetId === sourceGroup.id;

  async function handleConfirm(): Promise<void> {
    if (confirmDisabled || targetId === null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onDuplicate({ targetGroupId: targetId });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '复制失败');
      setSubmitting(false);
    }
    // 成功路径:父级会 onClose(),不重置 submitting(避免闪一下 enabled 按钮)。
  }

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label="复制 KV">
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">复制 KV 到其他工作空间</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </header>
        <div className="sl-us-modal__body">
          <div className="sl-us-field">
            <span className="sl-us-field__label">来源工作空间</span>
            <input className="sl-us-input" value={sourceGroup.name} disabled readOnly />
          </div>
          <div className="sl-us-field">
            <span className="sl-us-field__label">Key</span>
            <input className="sl-us-input" value={sourceKey} disabled readOnly />
          </div>
          <div className="sl-us-field">
            <span className="sl-us-field__label">目标工作空间</span>
            {noTargets ? (
              <span className="sl-us-field__hint">
                你在其他工作空间中没有 writer+ 权限,无法复制。先加入一个组或邀请自己。
              </span>
            ) : (
              <select
                className="sl-us-input"
                value={targetId ?? ''}
                onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : null)}
                disabled={submitting}
                aria-label="选择目标工作空间"
              >
                {writableOthers.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <span className="sl-us-field__hint">仅显示你有写权限的工作空间;目标 key 冲突时自动加 _copy 后缀。</span>
          </div>
          {submitError && <div className="sl-us-error">{submitError}</div>}
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={submitting}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={confirmDisabled}
            onClick={() => void handleConfirm()}
          >
            {submitting ? '复制中…' : '复制'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}