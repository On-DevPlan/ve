// pages/Inventory.tsx —— KV 管理视图(列表 + 新建/详情/编辑/删除 + 分页/tag 过滤)
//
// 权限:myRole ∈ {owner,admin,writer} 显示写操作;reader 只读。删除走行内 hover 确认。
// 行 actions 默认隐藏,hover 整行才显示(避免视觉噪音)。

import { useMemo } from 'react';
import type { KvListResult, KvView } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

export interface InventoryProps {
  group: import('@api/components/user-space').GroupSummary;
  kv: KvListResult | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  page: number;
  pageSize: number;
  selectedTag: string | null;
  onPageChange: (page: number) => void;
  onTagChange: (tag: string | null) => void;
  onCreate: () => void;
  onEdit: (item: KvView) => void;
  onDelete: (item: KvView) => void;
  /** 复制到其他工作空间(父级开 DuplicateKvModal);仅 canWrite 显示按钮。 */
  onDuplicate: (item: KvView) => void;
  onReload: () => Promise<void>;
}

function formatReplacedAt(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Inventory(props: InventoryProps) {
  const { group, kv, loading, error, saving, page, pageSize, selectedTag, onPageChange, onTagChange, onCreate, onEdit, onDelete, onDuplicate, onReload } = props;
  const canWrite = hasMinRole(group.myRole, 'writer');

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of kv?.items ?? []) for (const t of item.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [kv]);

  const totalPages = kv ? Math.max(1, Math.ceil(kv.total / pageSize)) : 1;

  return (
    <div>
      {/* Toolbar: tag 过滤 + 搜索 + 新建 + 刷新 */}
      <div className="sl-us-toolbar">
        <select
          className="sl-us-input sl-us-input--compact"
          value={selectedTag ?? ''}
          onChange={(e) => onTagChange(e.target.value || null)}
          aria-label="按 tag 过滤"
        >
          <option value="">所有 tag</option>
          {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="sl-us-toolbar__spacer" />
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading || saving}>
          ↻ 刷新
        </button>
        {canWrite && (
          <button className="sl-us-btn sl-us-btn--primary" onClick={onCreate} disabled={saving}>
            + 新建 KV
          </button>
        )}
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      {(!kv || kv.items.length === 0) && !loading ? (
        <div className="sl-us-empty">
          <div className="sl-us-empty__title">还没有 KV</div>
          <div className="sl-us-empty__desc">
            {canWrite ? '点击右上角「+ 新建 KV」开始管理该组数据' : '当前组内无 KV'}
          </div>
        </div>
      ) : (
        <div className="sl-us-table-wrap">
          <table className="sl-us-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Key</th>
                <th>Value</th>
                <th style={{ width: '18%' }}>Tags</th>
                <th style={{ width: '12%' }}>过期</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {kv?.items.map((item) => (
                <tr key={item.key}>
                  <td>
                    <span className="sl-us-table__cell-key sl-us-table__cell-mono">{item.key}</span>
                  </td>
                  <td>
                    <span className="sl-us-table__cell-value" title={item.value}>
                      {item.valuePreview || '—'}
                    </span>
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
                    {item.expiresAt ? formatReplacedAt(item.expiresAt) : '—'}
                  </td>
                  <td>
                    <div className="sl-us-table__row-actions">
                      <button
                        className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
                        onClick={() => onEdit(item)}
                        title="查看 / 编辑"
                        aria-label="查看"
                      >
                        ✎
                      </button>
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
                      {canWrite && (
                        <button
                          className="sl-us-btn sl-us-btn--danger-ghost sl-us-btn--icon-sm"
                          disabled={saving}
                          onClick={() => {
                            if (window.confirm(`删除 KV「${item.key}」?`)) onDelete(item);
                          }}
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
          {kv && kv.total > 0 && (
            <div className="sl-us-table-foot">
              <span>共 {kv.total} 条</span>
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
