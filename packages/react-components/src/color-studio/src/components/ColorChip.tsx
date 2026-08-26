// packages/react-components/src/color-studio/src/components/ColorChip.tsx
//
// 单色小卡:色块 + hex + 锁定切换 + 删除按钮(由父层传 onRemove)。

import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface Props {
  entry: ColorEntry;
  onRemove?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onClick?: (id: string) => void;
  active?: boolean;
}

export function ColorChip({ entry, onRemove, onToggleLock, onClick, active }: Props) {
  return (
    <div className={`sl-cs-chip ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="sl-cs-chip__swatch"
        style={{ backgroundColor: entry.hex }}
        onClick={() => onClick?.(entry.id)}
        aria-label={`色 ${entry.hex}`}
      />
      <code className="sl-cs-chip__hex">{entry.hex}</code>
      <div className="sl-cs-chip__actions">
        {onToggleLock && (
          <button
            type="button"
            onClick={() => onToggleLock(entry.id)}
            aria-label={entry.locked ? '解锁' : '锁定'}
          >
            {entry.locked ? '🔒' : '🔓'}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            aria-label="删除"
          >×</button>
        )}
      </div>
    </div>
  );
}
