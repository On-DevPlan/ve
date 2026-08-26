// packages/react-components/src/color-studio/src/hooks/useHarmony.ts
//
// 当前 active palette 的和声派生色输出 + autoFill 副作用。

import { useEffect, useMemo, useRef } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { deriveHarmony } from '../engine/harmony';
import { applyAutoFill } from '../engine/autoFill';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export function useHarmony(): { derived: Hex[]; sourceHex: Hex | null } {
  const { doc } = useColorStudio();
  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    if (!palette?.harmony) return { derived: [], sourceHex: null };
    const anchor = doc.colorEntries.find((c) => c.id === palette.harmony!.anchorColorId);
    if (!anchor) return { derived: [], sourceHex: null };
    return { derived: deriveHarmony(anchor.hex, palette.harmony.type), sourceHex: anchor.hex };
  }, [doc]);
}

/**
 * autoFill 副作用:active palette 的 anchor hex 变化时,把派生色写回。
 * 挂在 Shell 级别调用;applyAutoFill 只改派生条目,不会再触发 anchor 变化,
 * 因此不会自循环。
 */
export function useAutoFillEffect(): void {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.harmony?.anchorColorId;
  const autoFill = palette?.harmony?.autoFill ?? false;
  const anchorHex = useMemo(
    () => doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? null,
    [doc.colorEntries, anchorId],
  );
  const lastAnchorHexRef = useRef<string | null>(anchorHex);

  useEffect(() => {
    if (!autoFill || !anchorId || !anchorHex) {
      lastAnchorHexRef.current = anchorHex;
      return;
    }
    if (lastAnchorHexRef.current === anchorHex) return;
    lastAnchorHexRef.current = anchorHex;
    setDoc((d) => applyAutoFill(d, d.activePaletteId));
  }, [anchorHex, anchorId, autoFill, setDoc]);
}
