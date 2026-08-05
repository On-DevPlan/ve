// pages/Inventory.tsx —— KV 管理视图(列表 + 新建/详情/编辑/删除 + 分页/tag 过滤)
// 权限:myRole ∈ {owner,admin,writer} 显示写操作;reader 只读。删除走行内二次确认。

import { useMemo } from 'react';
import type { KvListResult, KvView, GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

export interface InventoryProps {
  group: GroupSummary;
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
  onReload: () => Promise<void>;
}

export default function Inventory(props: InventoryProps) {
  const { group, kv, loading, error, saving, page, pageSize, selectedTag, onPageChange, onTagChange, onCreate, onEdit, onDelete, onReload } = props;
  const canWrite = hasMinRole(group.myRole, 'writer');

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of kv?.items ?? []) for (const t of item.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [kv]);

  const totalPages = kv ? Math.max(1, Math.ceil(kv.total / pageSize)) : 1;

  return (
    <section className="sl-us-view sl-us-inventory">
      <div className="sl-us-view__head">
        <h3 className="sl-us-view__title">KV 管理</h3>
        <span className="sl-us-view__spacer" />
        <select
          className="sl-us-input sl-us-input--compact"
          value={selectedTag ?? ''}
          onChange={(e) => onTagChange(e.target.value || null)}
          aria-label="按 tag 过滤"
        >
          <option value="">全部 tag</option>
          {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {canWrite && (
          <button className="sl-us-btn sl-us-btn--primary" onClick={onCreate} disabled={saving}>
            + 新建 KV
          </button>
        )}
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading}>
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      <table className="sl-us-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Tags</th>
            <th>过期时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(!kv || kv.items.length === 0) && !loading && (
            <tr><td colSpan={5} className="sl-us-table__empty">该组暂无 KV</td></tr>
          )}
          {kv?.items.map((item) => (
            <KvRow
              key={item.key}
              item={item}
              canWrite={canWrite}
              saving={saving}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>

      <div className="sl-us-pager">
        <span className="sl-us-pager__info">共 {kv?.total ?? 0} 条</span>
        <button className="sl-us-btn" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>上一页</button>
        <span className="sl-us-pager__page">{page} / {totalPages}</span>
        <button className="sl-us-btn" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>下一页</button>
      </div>
    </section>
  );
}

function KvRow({ item, canWrite, saving, onEdit, onDelete }: {
  item: KvView; canWrite: boolean; saving: boolean;
  onEdit: (item: KvView) => void; onDelete: (item: KvView) => void;
}) {
  return (
    <tr>
      <td><code className="sl-us-code">{item.key}</code></td>
      <td className="sl-us-inv-value">{item.valuePreview || '—'}</td>
      <td>
        {item.tags.length === 0 ? <span className="sl-us-muted">—</span> : item.tags.map((t) => <span key={t} className="sl-us-badge sl-us-badge--tag">{t}</span>)}
      </td>
      <td>{item.expiresAt || '—'}</td>
      <td>
        <span className="sl-us-table__actions">
          <button className="sl-us-btn" onClick={() => onEdit(item)} title="查看/编辑详情">详情</button>
          {canWrite && (
            <>
              <button className="sl-us-btn" disabled={saving} onClick={() => onEdit(item)} title="编辑">编辑</button>
              <button
                className="sl-us-btn sl-us-btn--danger-ghost"
                disabled={saving}
                onClick={() => { if (window.confirm(`删除 KV「${item.key}」?`)) onDelete(item); }}
              >
                删除
              </button>
            </>
          )}
        </span>
      </td>
    </tr>
  );
}
