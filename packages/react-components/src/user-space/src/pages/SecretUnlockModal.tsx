// pages/SecretUnlockModal.tsx —— 二级密码解锁弹窗(2026-09-19)。
//
// 三种模式:
//   1. unlock      —— 首次输入二级密码(若 salt 不存在则后端自动生成,等价 setup)
//   2. reset       —— 改密码,要同时输旧密码 + 新密码
//   3. forced-unlock —— 与 unlock 同 UI,语义上是「强制重新解锁」(旧密码忘了 etc.)
//
// UI 复用同一个 modal:模式由 prop 决定。表单字段按 mode 切换显示。
// 业务逻辑(unlock/reset 调用 + error 显示)由父组件负责,modal 只做表单。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type SecretUnlockMode = 'unlock' | 'reset';

export interface SecretUnlockModalProps {
  open: boolean;
  mode: SecretUnlockMode;
  busy: boolean;
  error: string | null;
  /** unlock 模式只需要 password;reset 需要 oldPassword + newPassword。
   *  返回值:unlock mode -> {password}, reset mode -> {oldPassword, newPassword}。 */
  onSubmit: (input: { password?: string; oldPassword?: string; newPassword?: string }) => Promise<void>;
  onClose: () => void;
}

export default function SecretUnlockModal({ open, mode, busy, error, onSubmit, onClose }: SecretUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword(''); setOldPassword(''); setNewPassword(''); setNewPassword2('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);
  if (!portalRoot) return null;

  const isReset = mode === 'reset';
  const newPwMismatch = isReset && newPassword.length > 0 && newPassword !== newPassword2;
  const canSubmit = busy
    ? false
    : isReset
      ? oldPassword.length >= 6 && newPassword.length >= 6 && !newPwMismatch
      : password.length >= 6;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    if (isReset) {
      await onSubmit({ oldPassword, newPassword });
    } else {
      await onSubmit({ password });
    }
  }

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label={isReset ? '重置二级密码' : '解锁二级密码'}>
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{isReset ? '重置二级密码' : '🔓 解锁二级密码'}</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        <div className="sl-us-modal__body">
          <p className="sl-us-muted" style={{ fontSize: '12px', margin: '0 0 12px' }}>
            {isReset
              ? '验证旧密码后,事务内全表重加密所有 secret KV,然后写入新 salt。旧密文将用新密码可读;不会丢失。'
              : '输入二级密码以解锁 secret KV。后续本会话内所有 KV 请求自动带 header,不需要重复输入。'}
          </p>
          {!isReset && (
            <div className="sl-us-field">
              <span className="sl-us-field__label">二级密码</span>
              <input
                type="password"
                className="sl-us-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoFocus
                placeholder="至少 6 位"
              />
            </div>
          )}
          {isReset && (
            <>
              <div className="sl-us-field">
                <span className="sl-us-field__label">旧二级密码</span>
                <input
                  type="password"
                  className="sl-us-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="sl-us-field">
                <span className="sl-us-field__label">新二级密码</span>
                <input
                  type="password"
                  className="sl-us-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="sl-us-field">
                <span className="sl-us-field__label">确认新二级密码</span>
                <input
                  type="password"
                  className="sl-us-input"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  disabled={busy}
                />
                {newPwMismatch && <span className="sl-us-field__hint">两次新密码不一致</span>}
              </div>
            </>
          )}
          {error && <div className="sl-us-error">{error}</div>}
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={busy}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {busy ? '处理中…' : isReset ? '改密' : '解锁'}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(node, portalRoot);
}
