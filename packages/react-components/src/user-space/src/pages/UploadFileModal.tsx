// pages/UploadFileModal.tsx —— 上传文件表单(portal 渲染到 shadowRoot 外)。
//
// 设计:复用 .sl-us-modal* 样式 + portal 模式,与 KvEditorModal / DuplicateKvModal
// 同构。accessLevel 固定为 public(本期只做公开图床),无 UI 开关。
//
// 文件选择走 <input type="file">;提交时把 File 透传给父级 onUpload(浏览器原生
// File extends Blob,父级 store.uploadFile 签名接收 Blob,兼容 File)。
//
// tags 逗号分隔输入,与 KV 创建表单一致;空数组 = 无 tag(replace 语义)。
//
// 大文件(≥ CHUNKED_UPLOAD_MIN_SIZE)父级走分片上传:progress 非空时渲染
// 进度条(计算指纹 → 分片上传 → 服务器合并),「取消」变「停止上传」
// (软取消:会话保留,重传同文件断点续传);completing 阶段合并不可中断。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHUNKED_UPLOAD_MIN_SIZE } from '@api/components/user-space';
import type { FileUploadProgress } from '@api/components/user-space';

export interface UploadFileModalProps {
  open: boolean;
  saving: boolean;
  /** 分片上传进度;null = 小文件直传(无比例信息,只有按钮 loading 文案) */
  progress: FileUploadProgress | null;
  /** 停止分片上传(仅 hashing/uploading 阶段有效;completing 不可中断) */
  onCancelUpload?: () => void;
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

/** 进度阶段文案:hashing / uploading(含秒传)/ completing。 */
function progressLabel(p: FileUploadProgress): string {
  const pct = `${Math.round(p.ratio * 100)}%`;
  if (p.phase === 'hashing') return `计算文件指纹 ${pct}`;
  if (p.phase === 'completing') return '服务器合并中…';
  if (p.instant) return '秒传命中,直接引用';
  const chunks = p.chunkCount !== undefined && p.receivedChunks !== undefined
    ? `(${p.receivedChunks}/${p.chunkCount} 片)`
    : '';
  const resumed = p.resumed ? ' · 续传' : '';
  return `分片上传中 ${pct} ${chunks}${resumed}`;
}

export default function UploadFileModal({
  open,
  saving,
  progress,
  onCancelUpload,
  onUpload,
  onClose,
}: UploadFileModalProps) {
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
  // 分片进行中(hashing/uploading)可停止;completing 合并不可中断
  const chunkedActive = progress !== null && (progress.phase === 'hashing' || progress.phase === 'uploading');

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
            {file && file.size >= CHUNKED_UPLOAD_MIN_SIZE && (
              <span className="sl-us-field__hint">文件较大,将分片上传(支持断点续传与秒传)。</span>
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
          {progress && (
            <div className="sl-us-progress">
              <span className="sl-us-progress__label">{progressLabel(progress)}</span>
              {progress.phase === 'completing' ? (
                <div className="sl-us-progress__bar" role="progressbar" aria-label="合并中">
                  <div className="sl-us-progress__fill sl-us-progress__fill--indeterminate" />
                </div>
              ) : (
                <div
                  className="sl-us-progress__bar"
                  role="progressbar"
                  aria-valuenow={Math.round(progress.ratio * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="sl-us-progress__fill"
                    style={{ width: `${Math.min(100, Math.round(progress.ratio * 100))}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {submitError && <div className="sl-us-error">{submitError}</div>}
        </div>
        <footer className="sl-us-modal__foot">
          <button
            className="sl-us-btn"
            onClick={chunkedActive ? onCancelUpload : onClose}
            disabled={saving && !chunkedActive}
          >
            {chunkedActive ? '停止上传' : '取消'}
          </button>
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
