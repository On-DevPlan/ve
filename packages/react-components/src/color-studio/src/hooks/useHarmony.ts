// packages/react-components/src/color-studio/src/hooks/useHarmony.ts
//
// 当前 active palette 的和声派生色输出。

import { useMemo } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { deriveHarmony } from '../engine/harmony';
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
