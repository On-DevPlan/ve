// packages/react-components/src/color-studio/src/components/QuickAddBar.tsx
//
// 底部全局粘贴输入:hex / rgb / hsl / 颜色英文名;支持逗号/空格/换行分隔批量。

import { useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { parseUserInput } from '../engine/colorMath';
import { makeId } from '../utils/id';

export function QuickAddBar() {
  const { setDoc } = useColorStudio();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const hexes = tokens.map(parseUserInput).filter((h): h is string => !!h);
    if (hexes.length === 0) {
      setError(`无法识别: "${text}"`);
      return;
    }
    const ts = Date.now();
    setDoc((d) => {
      const newEntries = hexes.map((hex, i) => ({
        id: makeId(ts + i),
        hex,
        weight: 1,
        locked: false,
        note: '',
        tags: [],
        createdAt: ts,
        updatedAt: ts,
      }));
      return {
        ...d,
        colorEntries: [...d.colorEntries, ...newEntries],
        palettes: d.palettes.map((p) => p.id === d.activePaletteId
          ? { ...p, colorIds: [...p.colorIds, ...newEntries.map((e) => e.id)], updatedAt: ts }
          : p),
        pickHistory: [
          ...hexes.map((hex) => ({ hex, source: 'paste' as const, pickedAt: ts })),
          ...d.pickHistory,
        ].slice(0, 12),
        meta: { ...d.meta, updatedAt: ts },
      };
    });
    setText('');
    setError(null);
  };

  return (
    <div className="sl-cs-quickadd">
      <input
        placeholder="粘贴 #FF5733 / rgb(255,...) / red(空格分隔多色)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        aria-label="快速添加颜色"
      />
      <button type="button" onClick={submit}>添加</button>
      {error && <span className="sl-cs-quickadd__err">{error}</span>}
      <span className="sl-cs-quickadd__hint">A 添加 · C 复制 · P 取色 · X 清历史</span>
    </div>
  );
}
