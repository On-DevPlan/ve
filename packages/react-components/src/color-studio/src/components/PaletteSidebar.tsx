// packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx
//
// 调色板列表 + CRUD + 选 active + 上下移按钮替代 dnd-kit。

import { useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { ColorChip } from './ColorChip';
import { makeId } from '../utils/id';
import { parseUserInput } from '../engine/colorMath';

function nowTs() { return Date.now(); }

export function PaletteSidebar() {
  const { doc, setDoc } = useColorStudio();
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

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
          placeholder="新板名称"
          value={newPaletteName}
          onChange={(e) => setNewPaletteName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPalette(); }}
        />
        <button type="button" onClick={addPalette}>+</button>
      </div>
      <h4>当前板色</h4>
      <ul className="sl-cs-palettes__colors">
        {(() => {
          const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
          if (!p) return null;
          return p.colorIds.map((cid, i) => {
            const e = doc.colorEntries.find((x) => x.id === cid);
            if (!e) return null;
            return (
              <li key={cid} className="sl-cs-palettes__color">
                <ColorChip
                  entry={e}
                  onRemove={removeColor}
                  onToggleLock={toggleLock}
                />
                <button type="button" onClick={() => moveColor(cid, -1)} disabled={i === 0}>↑</button>
                <button
                  type="button"
                  onClick={() => moveColor(cid, 1)}
                  disabled={i === p.colorIds.length - 1}
                >↓</button>
              </li>
            );
          });
        })()}
      </ul>
      <div className="sl-cs-palettes__add-color">
        <input
          placeholder="#FF5733 或 red"
          value={newColorHex}
          onChange={(e) => setNewColorHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addColorToActive(); }}
        />
        <button type="button" onClick={addColorToActive}>添加</button>
      </div>
    </div>
  );
}
