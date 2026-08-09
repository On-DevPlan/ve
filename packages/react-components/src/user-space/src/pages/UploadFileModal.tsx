// pages/UploadFileModal.tsx —— 上传文件表单(portal 渲染到 shadowRoot 外)。
//
// 设计:复用 .sl-us-modal* 样式 + portal 模式,与 KvEditorModal / DuplicateKvModal
// 同构。accessLevel 固定为 public(本期只做公开图床),无 UI 开关。
//
// 文件选择走 <input type="file">;提交时把 File 透传给父级 onUpload(浏览器原生
// File extends Blob,父级 store.uploadFile 签名接收 Blob,兼容 File)。
//
// tags 逗号分隔输入,与 KV 创建表单一致;空数组 = 无 tag(replace 语义)。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface UploadFileModalProps {
  open: boolean;
  saving: boolean;
  onUpload: (args: { file: File; tags: string[] }) => Promise<void>;
  onClose: () => void;
}

/** 字节数 → 人类可读字符串,与 Files.tsx 保持一致。 */
function formatSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function UploadFileModal({ open, saving, onUpload, onClose }: UploadFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTagsText('');
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  const tags = tagsText.split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const confirmDisabled = saving || !file;

  async function handleConfirm(): Promise<void> {
    if (confirmDisabled || !file) return;
    setSubmitError(null);
    try {
      await onUpload({ file, tags });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '上传失败');
    }
    // 成功路径:父级会 onClose()
  }

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label="上传文件">
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">上传文件</h3>
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
            <span className="sl-us-field__label">文件</span>
            <input
              className="sl-us-input"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={saving}
              autoFocus
            />
            {file && (
              <span className="sl-us-field__hint">
                <span className="sl-us-key">{file.name || '(未命名)'}</span> · {file.type || '未知类型'} · {formatSize(file.size)}
              </span>
            )}
          </div>
          <div className="sl-us-field">
            <span className="sl-us-field__label">Tags(逗号分隔)</span>
            <input
              className="sl-us-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={saving}
              placeholder="prod, banner"
            />
            <span className="sl-us-field__hint">文件将以 public 访问级别上传(本期只做公开图床)。</span>
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
            {saving ? '上传中…' : '上传'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
