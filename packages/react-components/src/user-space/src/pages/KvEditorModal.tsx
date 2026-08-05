// pages/KvEditorModal.tsx —— 新建 / 编辑 KV 共用表单(portal 渲染到 shadowRoot 外)。
// 新建:key 可填;编辑:key 锁定(唯一键不可改)。ttl 以「天」输入,提交时换算秒。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KvView } from '@api/components/user-space';

export interface KvEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** 编辑模式初始值;新建传 null */
  initial: KvView | null;
  saving: boolean;
  onSave: (payload: { key: string; value: string; tags: string[]; ttl: number }) => Promise<void>;
  onClose: () => void;
}

export default function KvEditorModal({ open, mode, initial, saving, onSave, onClose }: KvEditorModalProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [ttlDays, setTtlDays] = useState(0);

  useEffect(() => {
    if (!open) return;
    setKey(mode === 'edit' && initial ? initial.key : '');
    setValue(mode === 'edit' && initial ? initial.value : '');
    setTagsText(mode === 'edit' && initial ? (initial.tags ?? []).join(', ') : '');
    setTtlDays(0);
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
              disabled={saving}
              rows={6}
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">Tags(逗号分隔)</span>
            <input
              className="sl-us-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={saving}
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
              disabled={saving}
            />
          </label>
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={saving}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={saving || !key.trim() || mode === 'edit' && !initial}
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
