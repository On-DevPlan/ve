// ShortcutTable.tsx —— 当前选中分组的快捷键表格
//
// 适用场景:shortcut-library 主区里、已选中某个 group 时渲染该分组下的快捷键列表;
// 配套表格顶部右上角 "+ 新增" 按钮触发行内录入,行 hover 触发键盘预览区高亮。
// 不适用:未选中分组(此时父组件 index.tsx 渲染 sl-sl-empty-state);分组数据来自
// props.group,本组件不直接拿 store,所有变更通过 onAdd/onUpdate/onDelete 上抛。
//
// 显示条件与约定:
//   - 表格仅在 group.shortcuts 非空 或 adding=true 时展开;空列表显示"还没有快捷键"
//   - 行内仅当 editingId/adding 命中时,把该行替换为 CapturePopover(整行 colSpan=4)
//   - combo 冲突(同组内 comboKey 完全相同)在该行 + combo 列显示"冲突"红标 + 行底色
//   - condition 列:快捷键的 condition 字段纯备注,只在存在时显示文字,否则"—"
//   - 行 hover:mouseenter 把 combo codes 推到父组件(键盘预览高亮)+ 上报 rect
//     (供右侧 description tooltip 定位);mouseleave 全部清掉
//   - 删除二次确认:第一下 × 变 ?,再点同一行的 ? 才真删;切分组/失焦自动取消

import { useEffect, useMemo, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from '../types';
import CapturePopover from './CapturePopover';
import { ComboDisplay } from '../components/KeyChip';
import { comboKey, comboLabel } from '../hooks/useShortcuts';

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
  // 删除二次确认:第一下 × 变 ?,再点同一行的 ? 才真删;切分组/失焦自动取消。
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 触发条件:切换分组(group.id 变化)→ 清掉 confirmDeleteId,避免"?"跨分组残留。
  useEffect(() => {
    setConfirmDeleteId(null);
  }, [group.id]);

  // 冲突判定:同一 group 内,combo 完全相同(comboKey 一致)→ 算冲突。
  // 不区分修饰键大小写、不区分修饰键左右(comboKey 已经规范化),
  // 也不跨 group 比(每个 group 各自一份快捷键,允许 Ctrl+R 同时存在于
  // VSCode 和 Chrome 两组里)。
  const conflictMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of group.shortcuts) m.set(comboKey(s.combo), (m.get(comboKey(s.combo)) ?? 0) + 1);
    const conflicts = new Set<string>();
    for (const [k, c] of m) if (c > 1) conflicts.add(k);
    return conflicts;
  }, [group.shortcuts]);

  // 筛选条件:query 非空时,description / condition / comboLabel 三者之一大小写不敏感
  // 包含子串即命中;空 query 不过滤(显示全部)。
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
        // 触发条件:组里一条都没有且不在添加中 → 显示引导空状态。
        <div className="sl-sl-table__empty">
          还没有快捷键,点击右上角&ldquo;新增快捷键&rdquo;开始。
        </div>
      ) : (
        <div className="sl-sl-table__viewport">
          <table className="sl-sl-table__grid">
            <thead>
              <tr>
                <th className="sl-sl-table__col-combo">组合键</th>
                <th className="sl-sl-table__col-cond">条件</th>
                <th className="sl-sl-table__col-desc">说明</th>
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
                    // 行 hover 行为:mouseenter 把该行的 combo codes 推到父组件(键盘预览高亮),
                    // 同时上 rect(供 description tooltip 定位);mouseleave 全部清掉。
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
                    <td className="sl-sl-table__col-cond">
                      {s.condition || <span className="sl-sl-empty">—</span>}
                    </td>
                    <td className="sl-sl-table__col-desc">
                      {s.description || <span className="sl-sl-empty">未填写</span>}
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
                        className={`sl-sl-icon-btn sl-sl-icon-btn--danger${
                          confirmDeleteId === s.id ? ' is-confirming' : ''
                        }`}
                        title={confirmDeleteId === s.id ? '再点一次确认删除' : '删除'}
                        onClick={() => {
                          if (confirmDeleteId === s.id) {
                            onDeleteShortcut(s.id);
                            setConfirmDeleteId(null);
                          } else {
                            setConfirmDeleteId(s.id);
                          }
                        }}
                        onBlur={() => {
                          // 失焦取消待确认态,避免"?"卡住
                          if (confirmDeleteId === s.id) setConfirmDeleteId(null);
                        }}
                      >
                        {confirmDeleteId === s.id ? '?' : '×'}
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
            // 触发条件:组里有快捷键但全被 query 过滤掉 → 显示无匹配空状态。
            <div className="sl-sl-table__empty">没有匹配 &ldquo;{query}&rdquo; 的快捷键</div>
          )}
        </div>
      )}
    </section>
  );
}
