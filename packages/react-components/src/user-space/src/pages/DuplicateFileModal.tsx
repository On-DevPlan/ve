// pages/DuplicateFileModal.tsx —— 把当前文件复制到另一个工作空间。
//
// 设计:复用 DuplicateKvModal 的 .sl-us-modal* 样式 + portal 模式。展示态只读
// 当前 group + source file(displayName + url),用户选一个目标 group 后调
// store.duplicateFile。
//
// 同组复制实际无意义,所以 <select> 默认排除源组 —— 只列 caller 在其中拥有
// writer+ 权限的其他组。如果没有任何可选目标组,「确认」按钮 disable 并提示原因。
//
// source/target 必须不同:<select> 不会给 source 选项,所以 disable 规则
// 退化成「未选目标 / 无可写目标组」。

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasMinRole } from '@api/components/user-space';
import type { FileView, GroupSummary } from '@api/components/user-space';

export interface DuplicateFileModalProps {
  open: boolean;
  /** 源文件所在组(只读展示)。 */
  sourceGroup: GroupSummary;
  /** 源文件(displayName 展示 + url 引用);可空(打开瞬间 source 还未注入)。 */
  sourceFile: FileView | null;
  /** 所有 caller 可见的工作空间列表(Files 页一定已有)。 */
  groups: GroupSummary[];
  /** Modal 内 saving 态(沿用父级 saving 标志,跟现有弹窗一致)。 */
  saving: boolean;
  /** 提交:把文件从 sourceGroup 复制到 targetGroupId;成功返回后端写的 newFileId。 */
  onDuplicate: (args: { targetGroupId: number }) => Promise<{ newFileId: string }>;
  onClose: () => void;
}

export default function DuplicateFileModal({ open, sourceGroup, sourceFile, groups, saving, onDuplicate, onClose }: DuplicateFileModalProps) {
  // 候选目标组:剔除源组 + 只留 caller 可写的(writer+)
  const writableOthers = useMemo(
    () => groups.filter((g) => g.id !== sourceGroup.id && hasMinRole(g.myRole, 'writer')),
    [groups, sourceGroup.id],
  );

  const [targetId, setTargetId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 每次重开弹窗:重置选择态,默认选第一个候选;没有候选就置 null。
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setTargetId(writableOthers.length > 0 ? writableOthers[0].id : null);
  }, [open, writableOthers]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const noTargets = writableOthers.length === 0;
  // 未选目标 或 选了源组(防御性 —— select 不会给,但 props 万一传错)→ disable。
  const confirmDisabled = saving || noTargets || targetId === null || targetId === sourceGroup.id;

  async function handleConfirm(): Promise<void> {
    if (confirmDisabled || targetId === null) return;
    setSubmitError(null);
    try {
      await onDuplicate({ targetGroupId: targetId });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '复制失败');
    }
    // 成功路径:父级会 onClose()
  }

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label="复制文件">
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">复制文件到其他工作空间</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
            disabled={saving}
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
            <span className="sl-us-field__label">文件名</span>
            <input
              className="sl-us-input"
              value={sourceFile?.displayName ?? ''}
              disabled
              readOnly
            />
          </div>
          <div className="sl-us-field">
            <span className="sl-us-field__label">链接</span>
            <input
              className="sl-us-input"
              value={sourceFile?.url ?? ''}
              disabled
              readOnly
            />
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
                disabled={saving}
                aria-label="选择目标工作空间"
              >
                {writableOthers.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <span className="sl-us-field__hint">仅显示你有写权限的工作空间;新文件 ID 由后端生成。</span>
          </div>
          {submitError && <div className="sl-us-error">{submitError}</div>}
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={saving}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={confirmDisabled}
            onClick={() => void handleConfirm()}
          >
            {saving ? '复制中…' : '复制'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
