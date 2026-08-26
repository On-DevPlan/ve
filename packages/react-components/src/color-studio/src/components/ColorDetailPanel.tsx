// packages/react-components/src/color-studio/src/components/ColorDetailPanel.tsx
//
// 当前 anchor 色 6 格式并列,每格式可编辑实时联动。
// 显示 WCAG contrast 对黑/对白 + copy 按钮。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { fromHex, parseUserInput } from '../engine/colorMath';
import { contrastRatio, wcagGrade } from '../engine/contrast';
import { writeClipboard } from '../utils/clipboard';

export function ColorDetailPanel() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.colorIds[0];
  const entry = doc.colorEntries.find((c) => c.id === anchorId);
  const hex = entry?.hex ?? '#000000';
  const fmts = useMemo(() => fromHex(hex), [hex]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = (candidate: string) => {
    const parsed = parseUserInput(candidate);
    if (!parsed || !entry) return;
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entry.id ? { ...c, hex: parsed, updatedAt: Date.now() } : c,
      ),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const fields = [
    { key: 'hex',   label: 'HEX',    value: hex },
    { key: 'rgb',   label: 'RGB',    value: `rgb(${Math.round(fmts.rgb.r * 255)}, ${Math.round(fmts.rgb.g * 255)}, ${Math.round(fmts.rgb.b * 255)})` },
    { key: 'hsl',   label: 'HSL',    value: `hsl(${Math.round(fmts.hsl.h ?? 0)}, ${Math.round((fmts.hsl.s ?? 0) * 100)}%, ${Math.round((fmts.hsl.l ?? 0) * 100)}%)` },
    { key: 'lab',   label: 'LAB',    value: `lab(${(fmts.lab.l ?? 0).toFixed(2)} ${(fmts.lab.a ?? 0).toFixed(2)} ${(fmts.lab.b ?? 0).toFixed(2)})` },
    { key: 'lch',   label: 'LCH',    value: `lch(${(fmts.lch.l ?? 0).toFixed(2)} ${(fmts.lch.c ?? 0).toFixed(2)} ${(fmts.lch.h ?? 0).toFixed(2)})` },
    { key: 'oklch', label: 'OKLCH',  value: `oklch(${(fmts.oklch.l ?? 0).toFixed(3)} ${(fmts.oklch.c ?? 0).toFixed(3)} ${(fmts.oklch.h ?? 0).toFixed(2)})` },
  ];

  const onBlack = wcagGrade(contrastRatio(hex, '#000000'));
  const onWhite = wcagGrade(contrastRatio(hex, '#FFFFFF'));

  return (
    <div className="sl-cs-detail">
      <div className="sl-cs-detail__swatch" style={{ backgroundColor: hex }} />
      <div className="sl-cs-detail__fields">
        {fields.map((f) => (
          <div key={f.key} className="sl-cs-detail__field">
            <span className="sl-cs-detail__label">{f.label}</span>
            {editingKey === f.key ? (
              <input
                autoFocus
                defaultValue={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => { commit(draft); setEditingKey(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commit(draft); setEditingKey(null); }
                  if (e.key === 'Escape') setEditingKey(null);
                }}
              />
            ) : (
              <code
                className="sl-cs-detail__value"
                onClick={() => { setDraft(f.value); setEditingKey(f.key); }}
              >
                {f.value}
              </code>
            )}
            <button
              type="button"
              onClick={() => writeClipboard(f.value).catch(() => undefined)}
              className="sl-cs-detail__copy"
            >
              复制
            </button>
          </div>
        ))}
      </div>
      <div className="sl-cs-detail__a11y">
        <span>对黑: {onBlack}</span>
        <span>对白: {onWhite}</span>
      </div>
    </div>
  );
}
