// ShortcutTable.tsx —— 当前选中分组的快捷键表格
// 内嵌 CapturePopover 用于"录入组合键";同组内 combo 重复时高亮
// 「条件」列展示 condition 字段(纯备注),仅当存在时显示

import { useMemo, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from './types';
import CapturePopover from './CapturePopover';
import { ComboDisplay } from './KeyChip';
import { comboKey, comboLabel } from './useShortcuts';

interface Props {
  group: Group;
  query: string;
  onAddShortcut: (combo: KeyStroke[], description: string, condition?: string) => void;
  onUpdateShortcut: (shortcutId: string, patch: Partial<Pick<Shortcut, 'combo' | 'description' | 'condition'>>) => void;
  onDeleteShortcut: (shortcutId: string) => void;
  onCapture: (codes: Set<string>) => void;
  onHover?: (codes: Set<string> | null) => void;
  // 行 hover 时单独触发,数据为当前 shortcut 的 DOMRect(用于 tooltip 定位)
  onShortcutHover?: (shortcut: Shortcut | null, rect: DOMRect | null) => void;
}

export default function ShortcutTable({
  group,
  query,
  onAddShortcut,
  onUpdateShortcut,
  onDeleteShortcut,
  onCapture,
  onHover,
  onShortcutHover,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDesc, setDraftDesc] = useState('');
  const [draftCondition, setDraftCondition] = useState('');

  // 计算同组内冲突的 combo
  const conflictMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of group.shortcuts) m.set(comboKey(s.combo), (m.get(comboKey(s.combo)) ?? 0) + 1);
    const conflicts = new Set<string>();
    for (const [k, c] of m) if (c > 1) conflicts.add(k);
    return conflicts;
  }, [group.shortcuts]);

  // 过滤
  const q = query.trim().toLowerCase();
  const filtered = group.shortcuts.filter((s) => {
    if (!q) return true;
    if (s.description.toLowerCase().includes(q)) return true;
    if (s.condition?.toLowerCase().includes(q)) return true;
    if (comboLabel(s.combo).toLowerCase().includes(q)) return true;
    return false;
  });

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraftDesc('');
    setDraftCondition('');
  }

  function commitAdd(combo: KeyStroke[], condition: string) {
    onAddShortcut(combo, draftDesc, condition);
    onCapture(new Set(combo.map((k) => k.code)));
    setAdding(false);
    setDraftDesc('');
    setDraftCondition('');
  }

  function commitEdit(id: string, combo: KeyStroke[], condition: string) {
    onUpdateShortcut(id, { combo, condition });
    onCapture(new Set(combo.map((k) => k.code)));
    setEditingId(null);
  }

  return (
    <section className="sl-sl-table">
      <header className="sl-sl-table__head">
        <div>
          <h2 className="sl-sl-table__title">{group.name}</h2>
          <span className="sl-sl-table__sub">{group.shortcuts.length} 条快捷键</span>
        </div>
        <button
          className="sl-sl-btn sl-sl-btn--primary"
          onClick={startAdd}
          disabled={adding}
        >
          + 新增快捷键
        </button>
      </header>

      {group.shortcuts.length === 0 && !adding ? (
        <div className="sl-sl-table__empty">
          还没有快捷键,点击右上角&ldquo;新增快捷键&rdquo;开始。
        </div>
      ) : (
        <div className="sl-sl-table__viewport">
          <table className="sl-sl-table__grid">
            <thead>
              <tr>
                <th className="sl-sl-table__col-combo">组合键</th>
                <th className="sl-sl-table__col-desc">说明</th>
                <th className="sl-sl-table__col-cond">条件</th>
                <th className="sl-sl-table__col-act">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isEditing = editingId === s.id;
                const isConflict = conflictMap.has(comboKey(s.combo)) && !isEditing;
                if (isEditing) {
                  return (
                    <tr key={s.id} className="sl-sl-row sl-sl-row--editing">
                      <td colSpan={4}>
                        <CapturePopover
                          initial={s.combo}
                          initialCondition={s.condition ?? ''}
                          onConfirm={(c, cond) => commitEdit(s.id, c, cond)}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={s.id}
                    className={`sl-sl-row ${isConflict ? 'sl-sl-row--conflict' : ''}`}
                    title={isConflict ? '同组内已有相同组合' : undefined}
                    onMouseEnter={(e) => {
                      onHover?.(new Set(s.combo.map(k => k.code)));
                      if (onShortcutHover) {
                        onShortcutHover(s, (e.currentTarget as HTMLElement).getBoundingClientRect());
                      }
                    }}
                    onMouseLeave={() => {
                      onHover?.(null);
                      onShortcutHover?.(null, null);
                    }}
                  >
                    <td className="sl-sl-table__col-combo">
                      <ComboDisplay combo={s.combo} />
                      {isConflict && (
                        <span className="sl-sl-table__conflict-tag">冲突</span>
                      )}
                    </td>
                    <td className="sl-sl-table__col-desc">
                      {s.description || <span className="sl-sl-empty">未填写</span>}
                    </td>
                    <td className="sl-sl-table__col-cond">
                      {s.condition || <span className="sl-sl-empty">—</span>}
                    </td>
                    <td className="sl-sl-table__col-act">
                      <button
                        className="sl-sl-icon-btn"
                        onClick={() => {
                          setAdding(false);
                          setEditingId(s.id);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="sl-sl-icon-btn sl-sl-icon-btn--danger"
                        onClick={() => {
                          if (confirm(`删除 &ldquo;${comboLabel(s.combo)}&rdquo; ?`)) onDeleteShortcut(s.id);
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}

              {adding && (
                <tr className="sl-sl-row sl-sl-row--adding">
                  <td colSpan={4}>
                    <div className="sl-sl-add-row">
                      <input
                        className="sl-sl-input sl-sl-input--desc"
                        placeholder="说明,例如 打开目录"
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                        autoFocus
                      />
                      <input
                        className="sl-sl-input sl-sl-input--cond"
                        placeholder="条件(可选),例如 选中数字时"
                        value={draftCondition}
                        onChange={(e) => setDraftCondition(e.target.value)}
                      />
                      <CapturePopover
                        initialCondition={draftCondition}
                        onConfirm={commitAdd}
                        onCancel={() => {
                          setAdding(false);
                          setDraftDesc('');
                          setDraftCondition('');
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length === 0 && group.shortcuts.length > 0 && (
            <div className="sl-sl-table__empty">没有匹配 &ldquo;{query}&rdquo; 的快捷键</div>
          )}
        </div>
      )}
    </section>
  );
}
