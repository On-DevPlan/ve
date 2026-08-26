// packages/react-components/src/color-studio/src/utils/paletteActions.ts
//
// "加一个颜色进活动调色板" —— 全组件共享的唯一入口。
// 之前同样逻辑散在 PickerPanel / HistoryStrip / QuickAddBar / index /
// useKeyboardShortcuts 五处,现在收敛成纯函数。

import type {
  ColorStudioDocument,
  PickHistoryItem,
} from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { makeId } from './id';

export function addEntryToActivePalette(
  doc: ColorStudioDocument,
  hex: string,
  source: PickHistoryItem['source'],
  now: number = Date.now(),
): ColorStudioDocument {
  const id = makeId(now);
  return {
    ...doc,
    colorEntries: [
      ...doc.colorEntries,
      { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: now, updatedAt: now },
    ],
    palettes: doc.palettes.map((p) =>
      p.id === doc.activePaletteId
        ? { ...p, colorIds: [...p.colorIds, id], updatedAt: now }
        : p,
    ),
    pickHistory: [{ hex, source, pickedAt: now }, ...doc.pickHistory].slice(0, 12),
    meta: { ...doc.meta, updatedAt: now },
  };
}
