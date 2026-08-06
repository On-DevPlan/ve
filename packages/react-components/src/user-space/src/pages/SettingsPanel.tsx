// pages/SettingsPanel.tsx —— 用户空间设置面板(modal,portal 渲染到 shadowRoot 外)
//
// 原则:
//   - 只放"组件自己的偏好",不接管登录/退出(那是整个应用全局的事,见 useAuth)
//   - 每项一行:标题 + 说明 + 右侧控件,避免"按一下就生效"的暗箱
//
// 当前设置项:
//   1. KV 列表每页条数(10 / 20 / 50)—— 影响 Inventory 分页,持久化到 LS
//   2. 默认工作空间(只读信息)—— 提示在「概览」tab 用 ★ 设为默认

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** KV 列表每页条数 — 双向绑定 */
  kvPageSize: number;
  onChangeKvPageSize: (n: number) => void;
  /** 当前默认工作空间名(信息展示);未设置传 null */
  defaultGroupName: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function SettingsPanel({ open, onClose, kvPageSize, onChangeKvPageSize, defaultGroupName }: SettingsPanelProps) {
  const headRef = useRef<HTMLDivElement | null>(null);

  // Esc 关闭 + 聚焦关闭按钮(键盘可达)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    headRef.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 防止背景滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const node = (
    <div
      className="sl-us-modal-backdrop"
      role="dialog"
      aria-label="设置"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sl-us-modal" style={{ width: 'min(480px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <header className="sl-us-modal__head" ref={headRef}>
          <h3 className="sl-us-modal__title">设置</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="sl-us-modal__body">
          {/* 1. KV 每页条数 */}
          <div className="sl-us-field">
            <span className="sl-us-field__label">KV 列表每页条数</span>
            <div className="sl-us-settings-options" role="radiogroup" aria-label="每页条数">
              {PAGE_SIZE_OPTIONS.map((n) => {
                const active = kvPageSize === n;
                return (
                  <button
                    key={n}
                    className={`sl-us-settings-option ${active ? 'is-active' : ''}`}
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChangeKvPageSize(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <span className="sl-us-field__hint">影响「KV 库存」tab 的分页;持久化到本地。</span>
          </div>

          {/* 2. 默认工作空间(只读信息) */}
          <div className="sl-us-field">
            <span className="sl-us-field__label">默认工作空间</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {defaultGroupName
                ? <span className="sl-us-chip sl-us-chip--default">{defaultGroupName}</span>
                : <span className="sl-us-muted">未设置</span>}
              <span className="sl-us-field__hint">在「概览」tab 点 ★ 设为默认;所有 KV 操作(不传 groupId)走此组。</span>
            </div>
          </div>
        </div>

        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
