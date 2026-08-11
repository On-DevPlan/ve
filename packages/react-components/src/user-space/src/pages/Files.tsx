// pages/Files.tsx —— 文件管理视图(列表 + 上传 + 删除 + tag 过滤 + 跨组复制)
//
// 权限:upload / patch 走 owner|admin|writer;delete 走 owner|admin (后端 403)。
// 行 actions 默认隐藏,hover 整行才显示(避免视觉噪音),与 KV 库存视觉一致。
//
// 缩略图规则:FileView.isPreviewable = public + image MIME 才出 <img> 缩略图;其余
// 走静态图标框。tag 来自列表内 items 收集(后端未提供 facet,与 KV 库存对齐)。
//
// accessLevel 行内 select:onChange → onAccessLevelChange(item, value);
// 复制按钮永远显示给 canWrite(reader 看不到);删除按钮仅 owner/admin 显示。

import { useMemo, useState } from 'react';
import type { FileAccessLevel, FileListResult, FileThumbnail, FileView, GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';
import { ApiError } from '@api/services/base';

export interface FilesProps {
  group: GroupSummary;
  files: FileListResult | null;
  loading: boolean;
  /** 原始失败对象(保留 Error 形态,用来读 ApiError.code)。
   * null 时不渲染错误条。 */
  error: unknown | null;
  saving: boolean;
  page: number;
  pageSize: number;
  selectedTag: string | null;
  /** 当前失败动作 —— 用来把后端 code:50「permission denied」翻成中文可读消息。 */
  errorAction: 'list' | 'upload' | 'patch' | 'delete' | 'duplicate' | null;
  onPageChange: (page: number) => void;
  onTagChange: (tag: string | null) => void;
  onUpload: () => void;
  /** 行内改 accessLevel。父级会发 PATCH + reload。 */
  onAccessLevelChange: (item: FileView, accessLevel: FileAccessLevel) => void;
  /** 复制到其他工作空间(父级开 DuplicateFileModal);仅 canWrite 显示按钮。 */
  onDuplicate: (item: FileView) => void;
  /** 删除文件;仅 owner/admin 显示按钮;父级内部已处理 confirm 提示。 */
  onDelete: (item: FileView) => void;
  onReload: () => Promise<void>;
}

/** 字节数 → 人类可读字符串(B / KB / MB / GB)。 */
function formatSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** RFC3339 压成「MM-DD HH:mm」;非法/空串原样返回。 */
function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 按 fileKind 返回图标字符。图片自己渲染 <img>,不走这里。 */
function fileKindIcon(kind: FileView['fileKind']): string {
  switch (kind) {
    case 'text': return '📄';
    case 'image': return '🖼';
    default: return '📎';
  }
}

/** 文件 tab 失败消息翻译器 —— 后端 ApiError(尤其 code:50「permission denied」)
 *  对普通用户不可读。已知动作 + role 上下文 → 中文可执行提示。
 *  默认 fall through 到原始 message,兜底任何未识别错误。 */
function fileErrorMessage(
  err: unknown,
  action: 'list' | 'upload' | 'patch' | 'delete' | 'duplicate',
  group: GroupSummary,
): string {
  if (!(err instanceof ApiError) || err.code !== 50) {
    return err instanceof Error ? err.message : String(err);
  }
  const role = group.myRole;
  switch (action) {
    case 'list':
      return `你不是该工作空间的成员,无法查看文件`;
    case 'upload':
      return `需要 writer 或更高权限才能上传文件。当前角色:${role}`;
    case 'patch':
      return `需要 writer 或更高权限才能修改文件属性。当前角色:${role}`;
    case 'duplicate':
      return `需要 writer 或更高权限才能复制文件到其他工作空间。当前角色:${role}`;
    case 'delete':
      return `只有 owner/admin 才能删除文件。当前角色:${role}`;
  }
}

/** 缩略图单元格:默认显示 sm 档缩略图(后端返回的 thumbnails 列表中
 *  level==='sm' 的 URL);sm 缺失则退到原图 url。点击在 thumb ↔ full 之间切换,
 *  通过本地 state 走 React 渲染而不是直写 DOM src,避免与 React 渲染冲突。
 *  data-src = 缩略图 URL(懒加载初始目标),data-full = 原图 URL(点击切换目标),
 *  data-state = "thumb" | "full" 给 CSS cursor 切换用。 */
interface ThumbImgProps {
  url: string;             // 原图(兜底)
  thumbnails?: FileThumbnail[];
  alt: string;
}

function ThumbImg({ url, thumbnails, alt }: ThumbImgProps) {
  const sm = thumbnails?.find((t) => t.level === 'sm');
  // 默认显示 sm 缩略图;sm 缺失则退到原图
  const defaultSrc = sm?.url ?? url;
  const [src, setSrc] = useState(defaultSrc);
  const [isFull, setIsFull] = useState(false);

  function handleClick(): void {
    if (isFull) {
      // 切回 sm(不存在则保持原图)
      setSrc(defaultSrc);
      setIsFull(false);
    } else {
      setSrc(url);
      setIsFull(true);
    }
  }

  return (
    <img
      className="sl-us-file-thumb"
      src={src}
      data-src={defaultSrc}    // 缩略图 URL(懒加载初始目标)
      data-full={url}          // 原图 URL(点击切换目标)
      data-state={isFull ? 'full' : 'thumb'}
      alt={alt}
      loading="lazy"
      onClick={handleClick}
      title={isFull ? '点击切回缩略图' : '点击查看原图'}
    />
  );
}

export default function Files(props: FilesProps) {
  const { group, files, loading, error, errorAction, saving, page, pageSize, selectedTag, onPageChange, onTagChange, onUpload, onAccessLevelChange, onDuplicate, onDelete, onReload } = props;
  const canWrite = hasMinRole(group.myRole, 'writer');
  const canDelete = hasMinRole(group.myRole, 'admin');

  // tag facet 后端未提供,从列表内 items 收集 + 去重 + 排序(频次降序,名称升序)。
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files?.items ?? []) {
      for (const t of f.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [files?.items]);

  const totalPages = files ? Math.max(1, Math.ceil(files.total / pageSize)) : 1;

  // 文件 tab 错误消息:code:50「permission denied」按动作翻译成中文可读;
  // 其他错误回落到原始 message。
  const errorMessage: string | null = error
    ? (errorAction
        ? fileErrorMessage(error, errorAction, group)
        : error instanceof Error ? error.message : String(error))
    : null;

  return (
    <div>
      {/* Toolbar: tag 过滤 + 刷新 + 上传 */}
      <div className="sl-us-toolbar">
        <select
          className="sl-us-input sl-us-input--compact"
          value={selectedTag ?? ''}
          onChange={(e) => onTagChange(e.target.value || null)}
          aria-label="按 tag 过滤"
        >
          <option value="">所有 tag</option>
          {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
        </select>
        <span className="sl-us-toolbar__spacer" />
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading || saving}>
          ↻ 刷新
        </button>
        {canWrite && (
          <button className="sl-us-btn sl-us-btn--primary" onClick={onUpload} disabled={saving}>
            + 上传文件
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="sl-us-error">{errorMessage}</div>
      )}

      {(!files || files.items.length === 0) && !loading ? (
        <div className="sl-us-empty">
          <div className="sl-us-empty__title">还没有文件</div>
          <div className="sl-us-empty__desc">
            {canWrite ? '点击右上角「+ 上传文件」开始上传公开图床' : '当前组内无文件'}
          </div>
        </div>
      ) : (
        <div className="sl-us-table-wrap">
          <table className="sl-us-table">
            <thead>
              <tr>
                <th style={{ width: '64px' }}>预览</th>
                <th style={{ width: '20%' }}>文件名</th>
                <th>类型</th>
                <th style={{ width: '10%' }}>大小</th>
                <th style={{ width: '18%' }}>Tags</th>
                <th style={{ width: '10%' }}>过期</th>
                <th style={{ width: '120px' }}>访问</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {files?.items.map((item) => (
                <tr key={item.fileId}>
                  <td>
                    {item.isPreviewable ? (
                      <ThumbImg
                        url={item.url}
                        thumbnails={item.thumbnails}
                        alt={item.displayName}
                      />
                    ) : (
                      <span className="sl-us-file-icon" aria-hidden="true">
                        {fileKindIcon(item.fileKind)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="sl-us-table__cell-key sl-us-table__cell-mono" title={item.fileId}>
                      {item.displayName}
                    </span>
                  </td>
                  <td className="sl-us-table__cell-faint">
                    {item.contentType || '—'}
                  </td>
                  <td className="sl-us-cell-size">
                    {formatSize(item.size)}
                  </td>
                  <td>
                    {item.tags.length === 0
                      ? <span className="sl-us-muted">—</span>
                      : item.tags.map((t) => (
                          <span key={t} className="sl-us-chip sl-us-chip--tag">{t}</span>
                        ))
                    }
                  </td>
                  <td className="sl-us-table__cell-faint sl-us-table__cell-mono">
                    {formatTs(item.expireAt)}
                  </td>
                  <td>
                    <select
                      className="sl-us-input sl-us-input--compact"
                      value={item.accessLevel}
                      onChange={(e) => onAccessLevelChange(item, e.target.value as FileAccessLevel)}
                      disabled={saving || !canWrite}
                      aria-label={`修改文件 ${item.displayName} 的访问级别`}
                    >
                      <option value="public">public</option>
                      <option value="protected">protected</option>
                      <option value="private">private</option>
                    </select>
                  </td>
                  <td>
                    <div className="sl-us-table__row-actions">
                      {canWrite && (
                        <button
                          className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
                          disabled={saving}
                          onClick={() => onDuplicate(item)}
                          title="复制到其他工作空间"
                          aria-label="复制"
                        >
                          ⎘
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="sl-us-btn sl-us-btn--danger-ghost sl-us-btn--icon-sm"
                          disabled={saving}
                          onClick={() => onDelete(item)}
                          title="删除"
                          aria-label="删除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {files && files.total > 0 && (
            <div className="sl-us-table-foot">
              <span>共 {files.total} 条</span>
              <span className="sl-us-table-foot__spacer" />
              <button className="sl-us-btn sl-us-btn--sm" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
                ← 上一页
              </button>
              <span className="sl-us-table-foot__pages">{page} / {totalPages}</span>
              <button className="sl-us-btn sl-us-btn--sm" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>
                下一页 →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
