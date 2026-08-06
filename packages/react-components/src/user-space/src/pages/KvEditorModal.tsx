// pages/KvEditorModal.tsx —— 新建 / 编辑 KV 共用表单(portal 渲染到 shadowRoot 外)。
// 新建:key 可填;编辑:key 锁定(唯一键不可改)。ttl 以「天」输入,提交时换算秒。
// 编辑模式额外带「版本历史」:列出历史版本摘要(无 value 全文),可选中某版本
// 回滚到它(需 write 权限)。恢复后由父级刷新 initial,value 输入框随之更新。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KvVersionView, KvView } from '@api/components/user-space';

export interface KvEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** 编辑模式初始值;新建传 null */
  initial: KvView | null;
  saving: boolean;
  /**
   * 是否允许写入。false 时 value/tags/ttl 输入框与「保存」按钮均 disabled,
   * 编辑模式下给读者一个真正的只读详情视图(只有 Key 始终锁定,见下方)。
   * 默认 true,保持非 reader 行为不变。
   */
  canWrite?: boolean;
  /** 编辑模式的历史版本摘要(version_no DESC,最新在前)。创建模式不拉。 */
  versions?: KvVersionView[];
  versionsLoading?: boolean;
  /** 回滚到指定版本。版本列表不含 value 全文,所以"选择版本"的动作即回滚。 */
  onRestoreVersion?: (version: number) => void;
  onSave: (payload: { key: string; value: string; tags: string[]; ttl: number }) => Promise<void>;
  onClose: () => void;
}

/** replaced_at(RFC3339)压成「MM-DD HH:mm」;非法/空串原样返回。 */
function formatReplacedAt(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function KvEditorModal({ open, mode, initial, saving, canWrite = true, versions = [], versionsLoading = false, onRestoreVersion, onSave, onClose }: KvEditorModalProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [ttlDays, setTtlDays] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setKey(mode === 'edit' && initial ? initial.key : '');
    setValue(mode === 'edit' && initial ? initial.value : '');
    setTagsText(mode === 'edit' && initial ? (initial.tags ?? []).join(', ') : '');
    setTtlDays(0);
    setSelectedVersion(null);
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tags = tagsText.split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label={mode === 'create' ? '新建 KV' : '编辑 KV'}>
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{mode === 'create' ? '新建 KV' : '编辑 KV'}</h3>
          <button className="sl-us-icon-btn" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="sl-us-modal__body">
          <label className="sl-us-field">
            <span className="sl-us-label">Key</span>
            <input
              className="sl-us-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={saving || mode === 'edit'}
              placeholder="如 api_url"
              autoFocus
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">Value</span>
            <textarea
              className="sl-us-input sl-us-input--textarea"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={saving || !canWrite}
              rows={6}
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">Tags(逗号分隔)</span>
            <input
              className="sl-us-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={saving || !canWrite}
              placeholder="prod, cache"
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">TTL(天,0=永久)</span>
            <input
              className="sl-us-input"
              type="number"
              min={0}
              value={ttlDays}
              onChange={(e) => setTtlDays(Number(e.target.value))}
              disabled={saving || !canWrite}
            />
          </label>
          {mode === 'edit' && (
            <div className="sl-us-field sl-us-versions">
              <span className="sl-us-label">版本历史</span>
              {versionsLoading ? (
                <span className="sl-us-muted">加载中…</span>
              ) : versions.length === 0 ? (
                <span className="sl-us-muted">暂无历史版本</span>
              ) : (
                <div className="sl-us-versions__row">
                  <select
                    className="sl-us-input sl-us-input--compact"
                    value={selectedVersion ?? ''}
                    onChange={(e) => setSelectedVersion(e.target.value ? Number(e.target.value) : null)}
                    disabled={saving}
                    aria-label="选择历史版本"
                  >
                    <option value="">选择版本</option>
                    {versions.map((v) => (
                      <option key={v.versionNo} value={v.versionNo} title={v.replacedAt || undefined}>
                        v{v.versionNo} · {v.valueLen}B · {formatReplacedAt(v.replacedAt)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="sl-us-btn"
                    disabled={!canWrite || !selectedVersion || saving}
                    title={canWrite ? '将当前值回滚到所选版本' : '只读,无法恢复版本'}
                    onClick={() => selectedVersion && onRestoreVersion?.(selectedVersion)}
                  >
                    恢复该版本
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={saving}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={saving || !canWrite || !key.trim() || mode === 'edit' && !initial}
            onClick={() => void onSave({
              key: key.trim(),
              value,
              tags,
              ttl: ttlDays > 0 ? ttlDays * 86400 : 0,
            })}
          >
            {saving ? '保存中…' : mode === 'create' ? '创建' : '保存'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
