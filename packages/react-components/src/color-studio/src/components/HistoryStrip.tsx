// packages/react-components/src/color-studio/src/components/HistoryStrip.tsx
//
// 最近 12 个取过/加过的色,横向排列,点击重新加入活动板。

import { useColorStudio } from '../state/useColorStudio';
import { addEntryToActivePalette } from '../utils/paletteActions';

export function HistoryStrip() {
  const { doc, setDoc } = useColorStudio();
  const recent = doc.pickHistory.slice(0, 12);

  const reAdd = (hex: string) => {
    setDoc((d) => addEntryToActivePalette(d, hex, 'shortcut'));
  };

  return (
    <div className="sl-cs-history">
      <h4>最近</h4>
      <div className="sl-cs-history__strip">
        {recent.length === 0 && <span className="sl-cs-history__empty">(空)</span>}
        {recent.map((h, i) => (
          <button
            key={`${h.pickedAt}-${i}`}
            type="button"
            className="sl-cs-history__chip"
            style={{ backgroundColor: h.hex }}
            onClick={() => reAdd(h.hex)}
            aria-label={`历史色 ${h.hex}`}
            title={`${h.hex} (${h.source})`}
          />
        ))}
      </div>
    </div>
  );
}
