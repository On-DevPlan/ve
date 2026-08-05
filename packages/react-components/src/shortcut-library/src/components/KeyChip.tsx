// KeyChip.tsx —— 单个按键芯片(用于在表格中显示快捷键)

import type { KeyStroke } from '../types';

interface Props {
  keyStroke: KeyStroke;
  size?: 'sm' | 'md';
}

export default function KeyChip({ keyStroke, size = 'md' }: Props) {
  return (
    <span className={`sl-sl-chip sl-sl-chip--${size} ${keyStroke.isModifier ? 'sl-sl-chip--mod' : 'sl-sl-chip--key'}`}>
      {keyStroke.label}
    </span>
  );
}

export function ComboDisplay({ combo }: { combo: KeyStroke[] }) {
  if (combo.length === 0) return <span className="sl-sl-empty">未设置</span>;
  return (
    <span className="sl-sl-combo">
      {combo.map((k, i) => (
        <span key={`${k.code}-${i}`} className="sl-sl-combo__cell">
          <KeyChip keyStroke={k} size="sm" />
          {i < combo.length - 1 && <span className="sl-sl-combo__plus">+</span>}
        </span>
      ))}
    </span>
  );
}
