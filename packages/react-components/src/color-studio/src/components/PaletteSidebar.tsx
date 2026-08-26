// packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx
//
// 调色板列表 + CRUD + 选 active + 上下移 + 分组渲染(平铺/分组切换)+
// 组编辑(现有组菜单 + 新建)。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { ColorChip } from './ColorChip';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';
import { makeId } from '../utils/id';
import { parseUserInput } from '../engine/colorMath';
import { groupByEntries, listGroupNames } from '../utils/grouping';
import { promoteToToken } from '../engine/tokenLink';
import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

function nowTs() { return Date.now(); }

export function PaletteSidebar() {
  const { doc, setDoc } = useColorStudio();
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [groupMenuFor, setGroupMenuFor] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const activePalette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const activeEntries = useMemo(() => {
    if (!activePalette) return [] as ColorEntry[];
    return activePalette.colorIds
      .map((cid) => doc.colorEntries.find((c) => c.id === cid))
      .filter((c): c is ColorEntry => !!c);
  }, [activePalette, doc.colorEntries]);
  const groupNames = useMemo(() => listGroupNames(doc.colorEntries), [doc.colorEntries]);
  const grouped = useMemo(() => groupByEntries(activeEntries), [activeEntries]);

  const addPalette = () => {
    if (!newPaletteName.trim()) return;
    const id = makeId();
    setDoc((d) => ({
      ...d,
      palettes: [
        ...d.palettes,
        { id, name: newPaletteName.trim(), colorIds: [], harmony: null, sortBy: 'manual', createdAt: nowTs(), updatedAt: nowTs() },
      ],
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
    setNewPaletteName('');
  };

  const setActive = (id: string) => {
    setDoc((d) => ({ ...d, activePaletteId: id, meta: { ...d.meta, updatedAt: nowTs() } }));
  };

  const addColorToActive = () => {
    const hex = parseUserInput(newColorHex);
    if (!hex) return;
    const id = makeId();
    const ts = nowTs();
    setDoc((d) => ({
      ...d,
      colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
      palettes: d.palettes.map((p) =>
        p.id === d.activePaletteId ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts } : p,
      ),
      meta: { ...d.meta, updatedAt: ts },
    }));
    setNewColorHex('');
  };

  const removeColor = (entryId: string) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.filter((c) => c.id !== entryId),
      palettes: d.palettes.map((p) => ({ ...p, colorIds: p.colorIds.filter((id) => id !== entryId), updatedAt: nowTs() })),
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
  };

  const toggleLock = (entryId: string) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entryId ? { ...c, locked: !c.locked, updatedAt: nowTs() } : c,
      ),
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
  };

  const moveColor = (entryId: string, dir: -1 | 1) => {
    setDoc((d) => ({
      ...d,
      palettes: d.palettes.map((p) => {
        if (p.id !== d.activePaletteId) return p;
        const idx = p.colorIds.indexOf(entryId);
        if (idx < 0) return p;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= p.colorIds.length) return p;
        const next = [...p.colorIds];
        const tmp = next[idx] as string;
        const swap = next[newIdx] as string;
        next[idx] = swap;
        next[newIdx] = tmp;
        return { ...p, colorIds: next, updatedAt: nowTs() };
      }),
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
  };

  const setGroup = (entryId: string, group: string | undefined) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entryId ? { ...c, group, updatedAt: nowTs() } : c,
      ),
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
    setGroupMenuFor(null);
    setNewGroupName('');
  };

  /** 提升为全局色:打开命名输入(复用 groupmenu 的 newGroupName 状态流) */
  const promoteToGlobal = (entryId: string) => {
    setDoc((d) => promoteToToken(d, entryId, '').doc);
    setGroupMenuFor(null);
  };

  const toggleCollapsed = (g: string | undefined) => {
    const key = g ?? '__ungrouped__';
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupBy = () => {
    setDoc((d) => ({
      ...d,
      viewState: { ...d.viewState, groupBy: d.viewState.groupBy === 'group' ? 'none' : 'group' },
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
  };

  const renderEntries = (entries: ColorEntry[], withReorder: boolean) => (
    entries.map((e, i) => (
      <li key={e.id} className="sl-cs-palettes__color">
        <ColorChip
          entry={e}
          onRemove={removeColor}
          onToggleLock={toggleLock}
          onSetGroup={() => setGroupMenuFor(groupMenuFor === e.id ? null : e.id)}
        />
        {groupMenuFor === e.id && (
          <div className="sl-cs-palettes__groupmenu" role="menu">
            {groupNames.map((g) => (
              <button key={g} type="button" role="menuitem" onClick={() => setGroup(e.id, g)}>
                <Icon name="group" size={11} /> {g}
              </button>
            ))}
            {e.group && (
              <button type="button" role="menuitem" onClick={() => setGroup(e.id, undefined)}>
                <Icon name="close" size={11} /> 移出分组
              </button>
            )}
            {!e.tokenId && (
              <button type="button" role="menuitem" onClick={() => promoteToGlobal(e.id)} title="创建/复用全局色并链接本条目">
                <Icon name="sync" size={11} /> 提升为全局色
              </button>
            )}
            {e.tokenId && (
              <span className="sl-cs-palettes__tokenhint" title="已链接全局色,改全局色即联动">
                <Icon name="sync" size={11} /> 已链接全局色
              </span>
            )}
            <div className="sl-cs-palettes__groupmenu-new">
              <input
                className="sl-cs-input"
                placeholder="新组名"
                value={newGroupName}
                onChange={(ev) => setNewGroupName(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && newGroupName.trim()) setGroup(e.id, newGroupName.trim());
                }}
              />
            </div>
          </div>
        )}
        {withReorder && (
          <>
            <button
              type="button"
              className="sl-cs-chip__act"
              onClick={() => moveColor(e.id, -1)}
              disabled={i === 0}
              aria-label="上移"
              title="上移"
            ><Icon name="chevronUp" size={12} /></button>
            <button
              type="button"
              className="sl-cs-chip__act"
              onClick={() => moveColor(e.id, 1)}
              disabled={i === (activePalette?.colorIds.length ?? 1) - 1}
              aria-label="下移"
              title="下移"
            ><Icon name="chevronDown" size={12} /></button>
          </>
        )}
      </li>
    ))
  );

  return (
    <div className="sl-cs-palettes">
      <h3>调色板</h3>
      <ul className="sl-cs-palettes__list">
        {doc.palettes.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`sl-cs-palettes__name ${p.id === doc.activePaletteId ? 'is-active' : ''}`}
              onClick={() => setActive(p.id)}
            >{p.name}</button>
          </li>
        ))}
      </ul>
      <div className="sl-cs-palettes__add">
        <input
          className="sl-cs-input"
          placeholder="新板名称"
          value={newPaletteName}
          onChange={(e) => setNewPaletteName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPalette(); }}
        />
        <Btn variant="secondary" size="sm" iconOnly icon="plus" onClick={addPalette} aria-label="新增调色板" />
      </div>

      <div className="sl-cs-palettes__viewtoggle">
        <h4>当前板色</h4>
        <Btn
          variant={doc.viewState.groupBy === 'group' ? 'primary' : 'secondary'}
          size="sm"
          icon="group"
          onClick={toggleGroupBy}
          title="平铺 / 按组折叠"
        >
          {doc.viewState.groupBy === 'group' ? '分组视图' : '平铺视图'}
        </Btn>
      </div>

      {doc.viewState.groupBy === 'group' ? (
        grouped.map((g) => {
          const key = g.name ?? '__ungrouped__';
          const isCollapsed = collapsed.has(key);
          return (
            <div key={key} className="sl-cs-palettes__group">
              <button
                type="button"
                className="sl-cs-palettes__grouphead"
                onClick={() => toggleCollapsed(g.name)}
                aria-expanded={!isCollapsed}
              >
                <Icon name={isCollapsed ? 'chevronUp' : 'chevronDown'} size={12} />
                <Icon name="group" size={11} />
                <span>{g.name ?? '未分组'}</span>
                <span className="sl-cs-palettes__count">{g.entries.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="sl-cs-palettes__colors">
                  {renderEntries(g.entries, false)}
                </ul>
              )}
            </div>
          );
        })
      ) : (
        <ul className="sl-cs-palettes__colors">
          {renderEntries(activeEntries, true)}
        </ul>
      )}

      <div className="sl-cs-palettes__add-color">
        <input
          className="sl-cs-input"
          placeholder="#FF5733 或 red"
          value={newColorHex}
          onChange={(e) => setNewColorHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addColorToActive(); }}
        />
        <Btn variant="primary" size="sm" icon="plus" onClick={addColorToActive}>添加</Btn>
      </div>
    </div>
  );
}
