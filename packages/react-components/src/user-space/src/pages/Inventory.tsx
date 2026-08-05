// pages/Inventory.tsx —— 组内 KV 库存只读快照
//
// 不在本组件做 KV 编辑 —— 那是 shortcut-library 之类组件的职责。
// 这里只展示:总量 / 前 N 个 key / 截断的 value / tag;点击跳转(可选)。
//
// 数据来源:store.inventory(groupId) → list({groupId, limit}) + 各 key 单独 get
// 单 key 失败(best-effort)会在 UI 上显示 "(无权限)"。

import { useEffect, useState } from 'react';
import type { GroupKvInventory, GroupSummary } from '@api/components/user-space';

interface Props {
  group: GroupSummary;
  inventory: GroupKvInventory | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}

export default function Inventory({ group, inventory, loading, error, onReload }: Props) {
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setReloadKey((k) => k + 1);
  }, [group.id]);

  return (
    <section className="sl-us-view sl-us-inventory">
      <div className="sl-us-view__head">
        <h3 className="sl-us-view__title">KV 库存</h3>
        <button
          className="sl-us-btn"
          onClick={() => {
            void onReload();
            setReloadKey((k) => k + 1);
          }}
          disabled={loading}
        >
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      <div className="sl-us-card">
        <div className="sl-us-card__row">
          <label className="sl-us-label">组内 KV 总数</label>
          <span className="sl-us-value">{inventory ? inventory.total : '—'}</span>
        </div>
        <div className="sl-us-card__row">
          <label className="sl-us-label">本次展示</label>
          <span className="sl-us-value">
            {inventory ? inventory.keys.length : '—'} 条
          </span>
        </div>
      </div>

      <table className="sl-us-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value 预览</th>
            <th>长度</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {inventory && inventory.keys.length === 0 && (
            <tr>
              <td colSpan={4} className="sl-us-table__empty">
                该组暂无 KV
              </td>
            </tr>
          )}
          {inventory?.keys.map((k) => (
            <tr key={k.key}>
              <td><code className="sl-us-code">{k.key}</code></td>
              <td className="sl-us-inv-value">{k.valuePreview || '—'}</td>
              <td>{k.valueLength}</td>
              <td>
                {k.tags.length === 0 ? (
                  <span className="sl-us-muted">—</span>
                ) : (
                  k.tags.map((t) => (
                    <span key={t} className="sl-us-badge sl-us-badge--tag">{t}</span>
                  ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sl-us-view__hint" aria-hidden="true">
        reload #{reloadKey}
      </div>
    </section>
  );
}
