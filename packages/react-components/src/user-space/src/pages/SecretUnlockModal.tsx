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

/**
 * 二级密码输入框 —— 故意用 type="text"。
 * 浏览器(Chrome/Edge)对 type="password" 会触发「保存到密码管理器 / 更新账号密码」弹窗;
 * 二级密码不是账号凭据,会让用户点错覆盖登录密码。type="text" + 多种 data- 属性让
 * 密码管理器/自动填充都跳过本字段。
 */
function SecretInput(props: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  name: string;
}) {
  return (
    <input
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      className="sl-us-input sl-us-secret-input"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      placeholder={props.placeholder}
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      data-lpignore="true"
      aria-label={props.name}
    />
  );
}

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
      <div className="sl-us-modal" role="dialog" aria-label={isReset ? '修改二级密码' : '设置 / 解锁二级密码'}>
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{isReset ? '修改二级密码' : '设置二级密码 / 解锁'}</h3>
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
              ? '修改二级密码:验证旧密码后,服务端会在事务内把全部 secret KV 重加密为新密码可解。不会丢失数据。'
              : '首次输入即为「设置二级密码」;已设置过则用于「解锁」。解锁后本会话内所有 KV 请求自动携带,不需重复输入。\n加密某个 KV:在「KV 库存」打开该条编辑弹窗,勾选「用二级密码加密」。'}
          </p>
          {!isReset && (
            <div className="sl-us-field">
              <span className="sl-us-field__label">二级密码</span>
              <SecretInput
                name="二级密码"
                value={password}
                onChange={setPassword}
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
                <SecretInput
                  name="旧二级密码"
                  value={oldPassword}
                  onChange={setOldPassword}
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="sl-us-field">
                <span className="sl-us-field__label">新二级密码</span>
                <SecretInput
                  name="新二级密码"
                  value={newPassword}
                  onChange={setNewPassword}
                  disabled={busy}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="sl-us-field">
                <span className="sl-us-field__label">确认新二级密码</span>
                <SecretInput
                  name="确认新二级密码"
                  value={newPassword2}
                  onChange={setNewPassword2}
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
