// packages/react-components/src/color-studio/src/components/ColorDetailPanel.tsx
//
// 当前 anchor 色:大色块 + 单一"格式选择器 + 复制"组合。
// 显示格式 = 复制格式(所见即所复制),存 prefs.preferredCopyFormat 云同步。
// 附 WCAG 对黑/对白等级。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { useSelectedColor } from '../hooks/useSelectedColor';
import { formatHexAs, parseUserInput, type CopyableFormat } from '../engine/colorMath';
import { contrastRatio, wcagGrade } from '../engine/contrast';
import { writeClipboard } from '../utils/clipboard';
import { Btn } from './ui/Btn';
import { COPY_FORMATS } from '../hooks/useShortcutPrefs';

const FORMAT_LABELS: Record<CopyableFormat, string> = {
  hex: 'HEX',
  rgb: 'RGB',
  hsl: 'HSL',
  lab: 'LAB',
  lch: 'LCH',
  oklch: 'OKLCH',
};

interface Props {
  preferredFormat: CopyableFormat;
  onPreferredFormatChange: (f: CopyableFormat) => void;
}

export function ColorDetailPanel({ preferredFormat, onPreferredFormatChange }: Props) {
  const { setDoc } = useColorStudio();
  const { entry } = useSelectedColor();
  const hex = entry?.hex ?? '#000000';
  const value = useMemo(() => formatHexAs(hex, preferredFormat), [hex, preferredFormat]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

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

  const copy = async () => {
    await writeClipboard(value).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onBlack = wcagGrade(contrastRatio(hex, '#000000'));
  const onWhite = wcagGrade(contrastRatio(hex, '#FFFFFF'));

  return (
    <div className="sl-cs-detail">
      <div className="sl-cs-detail__swatch" style={{ backgroundColor: hex }}>
        <span className="sl-cs-detail__hexbig">{hex}</span>
      </div>
      <div className="sl-cs-detail__copyrow">
        <div className="sl-cs-detail__format" role="radiogroup" aria-label="颜色格式">
          {COPY_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={preferredFormat === f}
              className={`sl-cs-detail__fmtbtn ${preferredFormat === f ? 'is-active' : ''}`}
              onClick={() => onPreferredFormatChange(f)}
              title={`以 ${FORMAT_LABELS[f]} 显示与复制`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        {editing ? (
          <input
            autoFocus
            className="sl-cs-input sl-cs-detail__edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { commit(draft); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commit(draft); setEditing(false); }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <code
            className="sl-cs-detail__value"
            onClick={() => { setDraft(value); setEditing(true); }}
            title="点击输入任意格式改色"
          >
            {value}
          </code>
        )}
        <Btn variant="primary" icon="copy" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </Btn>
      </div>
      <div className="sl-cs-detail__a11y">
        <span>对黑: {onBlack}</span>
        <span>对白: {onWhite}</span>
      </div>
    </div>
  );
}
