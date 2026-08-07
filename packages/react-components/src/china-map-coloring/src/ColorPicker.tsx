// src/ColorPicker.tsx —— 8 色块调色板（设计规范 §6.2）
import { PALETTE } from './lib/constants';

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (value: string) => void;
}

export default function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const current = PALETTE.find((c) => c.value === selectedColor) ?? PALETTE[0];
  return (
    <div className="sl-cmc-picker">
      <div className="sl-cmc-swatches" role="radiogroup" aria-label="选择颜色">
        {PALETTE.map((c) => {
          const active = c.value === selectedColor;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              className={'sl-cmc-swatch' + (active ? ' is-active' : '')}
              style={{ background: c.value }}
              onClick={() => onSelect(c.value)}
            >
              {active ? <span className="sl-cmc-check">✓</span> : null}
            </button>
          );
        })}
      </div>
      <p className="sl-cmc-selected-text">当前选择：{current.name}</p>
    </div>
  );
}
