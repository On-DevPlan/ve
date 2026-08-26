// packages/react-components/src/color-studio/src/components/ColorChip.tsx
//
// 单色小卡:色块 + hex + 锁定切换 + 删除按钮(由父层传 onRemove)。
// derivedFrom 条目右上角小圆点,标记派生自和声规则。

import { Icon } from './ui/Icon';
import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface Props {
  entry: ColorEntry;
  onRemove?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onSetGroup?: (id: string) => void;
  onClick?: (id: string) => void;
  active?: boolean;
}

export function ColorChip({ entry, onRemove, onToggleLock, onSetGroup, onClick, active }: Props) {
  return (
    <div className={`sl-cs-chip ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="sl-cs-chip__swatch"
        style={{ backgroundColor: entry.hex }}
        onClick={() => onClick?.(entry.id)}
        aria-label={`色 ${entry.hex}`}
        title={entry.derivedFrom ? `${entry.hex}(派生自和声规则)` : entry.hex}
      >
        {entry.derivedFrom && <span className="sl-cs-chip__derived" aria-hidden="true" />}
      </button>
      <code className="sl-cs-chip__hex">{entry.hex}</code>
      {entry.group && <span className="sl-cs-chip__group" title={`分组:${entry.group}`}>{entry.group}</span>}
      <div className="sl-cs-chip__actions">
        {onSetGroup && (
          <button
            type="button"
            className="sl-cs-chip__act"
            onClick={() => onSetGroup(entry.id)}
            aria-label="设置分组"
            title="设置分组"
          >
            <Icon name="group" size={12} />
          </button>
        )}
        {onToggleLock && (
          <button
            type="button"
            className="sl-cs-chip__act"
            onClick={() => onToggleLock(entry.id)}
            aria-label={entry.locked ? '解锁' : '锁定'}
            title={entry.locked ? '解锁' : '锁定'}
          >
            <Icon name={entry.locked ? 'lock' : 'lockOpen'} size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className="sl-cs-chip__act"
            onClick={() => onRemove(entry.id)}
            aria-label="删除"
            title="删除"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
