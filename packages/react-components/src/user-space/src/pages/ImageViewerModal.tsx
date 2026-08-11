// pages/ImageViewerModal.tsx —— 点击文件缩略图打开的看图 modal。
//
// 设计:复用 .sl-us-modal* 样式 + portal 模式(同 DuplicateFileModal)。
// 展示:大图(优先 lg 高清档,缺失退原图)+ 底部两个下载按钮:
//   缩略图(sm) / 高清图(lg),各标注字节大小(size 字段来自后端 thumbnails)。
// 关闭:backdrop 点击 / 右上角 × / Escape。

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FileView } from '@api/components/user-space';

export interface ImageViewerModalProps {
  /** null = 关闭;非 null = 展示该文件的大图 + 下载项。 */
  file: FileView | null;
  onClose: () => void;
}

/** 字节数 → 人类可读(B / KB / MB)。与 Files.tsx 本地副本一致。 */
function formatSize(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** image/png → png;拿不到就回退 .img。 */
function imageExt(contentType: string | undefined): string {
  if (!contentType) return '.img';
  const mime = contentType.split('/');
  return mime.length === 2 && mime[1] ? `.${mime[1]}` : '.img';
}

export default function ImageViewerModal({ file, onClose }: ImageViewerModalProps) {
  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const sm = file.thumbnails?.find((t) => t.level === 'sm');
  const lg = file.thumbnails?.find((t) => t.level === 'lg');
  // 高清图:优先 lg 档;后端没给 lg 就用原图。
  const hdUrl = lg?.url ?? file.url;
  const hdSize = lg?.size ?? file.size;
  const ext = imageExt(file.contentType);

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="sl-us-modal"
        style={{ width: 'min(720px, 94vw)' }}
        role="dialog"
        aria-label={`查看图片 ${file.displayName}`}
      >
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{file.displayName}</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="sl-us-modal__body sl-us-image-viewer__body">
          <img
            className="sl-us-image-viewer__img"
            src={hdUrl}
            alt={file.displayName}
          />
        </div>
        <footer className="sl-us-modal__foot sl-us-image-viewer__foot">
          {sm && (
            <a
              className="sl-us-btn sl-us-btn--ghost"
              href={sm.url}
              download={`${file.displayName}-sm${ext}`}
              title="下载 sm 缩略图"
            >
              缩略图 · {formatSize(sm.size)} ⬇
            </a>
          )}
          <a
            className="sl-us-btn sl-us-btn--primary"
            href={hdUrl}
            download={`${file.displayName}-hd${ext}`}
            title="下载高清图"
          >
            高清图 · {formatSize(hdSize)} ⬇
          </a>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
