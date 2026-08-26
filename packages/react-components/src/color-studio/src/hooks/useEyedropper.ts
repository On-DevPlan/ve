// packages/react-components/src/color-studio/src/hooks/useEyedropper.ts
//
// 浏览器原生 EyeDropper API 包装。失败/不支持返 null。

import { useCallback, useMemo } from 'react';
import { toHex } from '../engine/colorMath';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInterface {
  open: () => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInterface;
  }
}

export function useEyedropper() {
  const isSupported = useMemo(
    () => typeof window !== 'undefined' && typeof window.EyeDropper === 'function',
    [],
  );

  const open = useCallback(async (): Promise<Hex | null> => {
    if (typeof window === 'undefined' || typeof window.EyeDropper !== 'function') return null;
    try {
      const ed = new window.EyeDropper();
      const result = await ed.open();
      return toHex(result.sRGBHex as Hex);
    } catch {
      // 用户取消或失败 → 不抛
      return null;
    }
  }, []);

  return { isSupported, open };
}
