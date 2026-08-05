// SettingsPanel.tsx —— 用户设置面板(modal 形式)
//
// 通过 portal 渲染到 document.body,避开 ShadowRoot 内部的样式隔离。
// 当前提供:
//   1. 同步模式:auto / manual(已有功能,只补说明)
//   2. 退出前提醒 dirty 改动(off → 直接丢;on → dialog 确认)
//   3. (占位)冲突处理策略 — 后端 KV 暂不支持 version,留 UI 不连功能
//
// 设计原则:每项一行,左边标题 + 说明,右边控件。最大化可读性,
// 避免"按一下就生效"的暗箱。

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useJwtAuth } from '../hooks/useAuth';
import { useLoginModal } from '../hooks/useLoginModal';
import { logoutWithConfirm } from '../hooks/logoutWithConfirm';

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  /** 同步模式 — 双向绑定 */
  saveMode: 'auto' | 'manual';
  onChangeSaveMode: (m: 'auto' | 'manual') => void;
  /** 退出前是否提醒未保存改动 */
  warnOnDirtyExit: boolean;
  onToggleWarnOnDirtyExit: (v: boolean) => void;
  /** 手动模式 + dirty 时显示 Save 按钮 */
  dirty: boolean;
  saving: boolean;
  /** 返回 promise 以便退出确认流程在保存失败时提示用户 */
  onFlushDirty: () => void | Promise<void>;
}

function useEscapeClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const { open, onClose, saveMode, onChangeSaveMode, warnOnDirtyExit, onToggleWarnOnDirtyExit, dirty, saving, onFlushDirty } = props;
  const auth = useJwtAuth();
  const loginModal = useLoginModal();
  useEscapeClose(open, onClose);

  // 防止背景滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  // portal target 跟主组件一致(优先 shadowRoot,fallback body)
  const portalRoot =
    (typeof document !== 'undefined' &&
      document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const node = (
    <div className="sl-sl-settings-backdrop" onClick={onBackdropClick} role="dialog" aria-label="设置">
      <div className="sl-sl-settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="sl-sl-settings-panel__head">
          <h3 className="sl-sl-settings-panel__title">设置</h3>
          <button
            className="sl-sl-icon-btn"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="sl-sl-settings-panel__body">
          {/* 0. 账号(登录 / 退出) */}
          {auth.jwtAuthState !== 'logged-in' || !auth.token ? (
            <div className="sl-sl-settings__auth">
              <p className="sl-sl-settings__hint">登录后可保存快捷键到云端,跨设备同步。</p>
              <button className="sl-sl-btn sl-sl-btn--primary" onClick={loginModal.open}>
                登录
              </button>
            </div>
          ) : (
            <div className="sl-sl-settings__auth">
              <p className="sl-sl-settings__hint">已登录为 {auth.jwtUser?.email}</p>
              <button
                className="sl-sl-btn sl-sl-btn--ghost"
                onClick={() =>
                  void logoutWithConfirm({
                    saveMode,
                    dirty,
                    warnOnDirtyExit,
                    flushDirty: onFlushDirty,
                  })
                }
              >
                退出登录
              </button>
            </div>
          )}

          {/* 1. 同步模式 */}
          <section className="sl-sl-settings-row">
            <div className="sl-sl-settings-row__text">
              <h4 className="sl-sl-settings-row__title">同步模式</h4>
              <p className="sl-sl-settings-row__desc">
                <strong>自动</strong>:每次改动立刻同步到云端(200ms 防抖,跨设备实时一致)。
                <br />
                <strong>手动</strong>:改动只留在本地,需要点「保存到云端」按钮才上传(适合批量编辑)。
              </p>
            </div>
            <div className="sl-sl-settings-row__ctrl">
              <div className="sl-sl-settings-sync-ctrl">
                <div className="sl-sl-userkv-bar__mode" role="radiogroup" aria-label="同步模式">
                  <label className="sl-sl-userkv-bar__mode-label">
                    <input
                      type="radio"
                      name="settings-save-mode"
                      checked={saveMode === 'auto'}
                      onChange={() => onChangeSaveMode('auto')}
                    />
                    自动
                  </label>
                  <label className="sl-sl-userkv-bar__mode-label">
                    <input
                      type="radio"
                      name="settings-save-mode"
                      checked={saveMode === 'manual'}
                      onChange={() => onChangeSaveMode('manual')}
                    />
                    手动
                  </label>
                </div>
                {saveMode === 'manual' && (
                  <button
                    className="sl-sl-btn sl-sl-btn--save-dirty"
                    onClick={() => {
                      // 手动保存失败只打日志,别让 unhandled rejection 冒泡
                      const p = onFlushDirty();
                      if (p) {
                        void p.catch((e) =>
                          console.error('[settings] flush failed:', e),
                        );
                      }
                    }}
                    disabled={!dirty || saving}
                  >
                    {saving ? '保存中…' : dirty ? '保存到云端' : '无未保存改动'}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 2. 退出前提醒 */}
          <section className="sl-sl-settings-row">
            <div className="sl-sl-settings-row__text">
              <h4 className="sl-sl-settings-row__title">退出前提醒未保存改动</h4>
              <p className="sl-sl-settings-row__desc">
                开启后,在「手动」模式下退出登录或切回游客模式时,如果还有未上传的本地改动,
                会弹窗让你确认(避免误操作丢数据)。
              </p>
            </div>
            <div className="sl-sl-settings-row__ctrl">
              <label className="sl-sl-settings-toggle">
                <input
                  type="checkbox"
                  checked={warnOnDirtyExit}
                  onChange={(e) => onToggleWarnOnDirtyExit(e.target.checked)}
                />
                <span className="sl-sl-settings-toggle__track" aria-hidden="true">
                  <span className="sl-sl-settings-toggle__thumb" />
                </span>
              </label>
            </div>
          </section>

          {/* 3. 冲突处理(占位) */}
          <section className="sl-sl-settings-row sl-sl-settings-row--disabled">
            <div className="sl-sl-settings-row__text">
              <h4 className="sl-sl-settings-row__title">多端冲突处理</h4>
              <p className="sl-sl-settings-row__desc">
                当你在两台设备同时改同一个快捷键库时怎么处理。当前后端 KV 不支持版本号,
                所以总是「最后写覆盖」。完整的多端乐观锁支持(409 重试 / 手动合并)将在
                v2 上线。
              </p>
            </div>
            <div className="sl-sl-settings-row__ctrl">
              <span className="sl-sl-settings-row__badge">v2 计划</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
