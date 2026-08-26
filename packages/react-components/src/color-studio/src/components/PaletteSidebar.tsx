// packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx
//
// 调色板列表 + CRUD + 选 active + 上下移 + 色卡点击选中(色盘跟随)。
// v1.3.0:分组概念移除(调色板是唯一分组模型);色卡菜单保留
// 提升为全局色 / 锁定 / 删除。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { ColorChip } from './ColorChip';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';
import { makeId } from '../utils/id';
import { parseUserInput } from '../engine/colorMath';
import { promoteToToken } from '../engine/tokenLink';
import { useSelectedColor } from '../hooks/useSelectedColor';
import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

function nowTs() { return Date.now(); }

export function PaletteSidebar() {
  const { doc, setDoc } = useColorStudio();
  const { effectiveId, select } = useSelectedColor();
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');
  const [groupMenuFor, setGroupMenuFor] = useState<string | null>(null);

  const activePalette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const activeEntries = useMemo(() => {
    if (!activePalette) return [] as ColorEntry[];
    return activePalette.colorIds
      .map((cid) => doc.colorEntries.find((c) => c.id === cid))
      .filter((c): c is ColorEntry => !!c);
  }, [activePalette, doc.colorEntries]);

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
    setDoc((d) => ({
      ...d,
      activePaletteId: id,
      // 切板后选中态失效,回退新板首色
      viewState: { ...d.viewState, selectedColorId: null },
      meta: { ...d.meta, updatedAt: nowTs() },
    }));
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
      // 新加的颜色直接选中(色盘跟随)
      viewState: { ...d.viewState, selectedColorId: id },
      meta: { ...d.meta, updatedAt: ts },
    }));
    setNewColorHex('');
  };

  const removeColor = (entryId: string) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.filter((c) => c.id !== entryId),
      palettes: d.palettes.map((p) => ({ ...p, colorIds: p.colorIds.filter((id) => id !== entryId), updatedAt: nowTs() })),
      viewState: d.viewState.selectedColorId === entryId
        ? { ...d.viewState, selectedColorId: null }
        : d.viewState,
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

  /** 提升为全局色 */
  const promoteToGlobal = (entryId: string) => {
    setDoc((d) => promoteToToken(d, entryId, '').doc);
    setGroupMenuFor(null);
  };

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

      <h4>当前板色</h4>
      <ul className="sl-cs-palettes__colors">
        {activeEntries.map((e, i) => (
          <li key={e.id} className="sl-cs-palettes__color">
            <ColorChip
              entry={e}
              active={e.id === effectiveId}
              onClick={select}
              onRemove={removeColor}
              onToggleLock={toggleLock}
              onSetGroup={() => setGroupMenuFor(groupMenuFor === e.id ? null : e.id)}
            />
            {groupMenuFor === e.id && (
              <div className="sl-cs-palettes__groupmenu" role="menu">
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
              </div>
            )}
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
              disabled={i === activeEntries.length - 1}
              aria-label="下移"
              title="下移"
            ><Icon name="chevronDown" size={12} /></button>
          </li>
        ))}
      </ul>

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
