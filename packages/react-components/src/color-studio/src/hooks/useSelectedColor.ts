// packages/react-components/src/color-studio/src/hooks/useSelectedColor.ts
//
// 选中色卡模型(v1.3.0):色盘 / 详情面板 / 滤镜烘焙 全部跟随这里。
// selectedColorId 为 null 时回退到活动板首色(anchor),保证永远有有效目标。

import { useCallback, useMemo } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export function useSelectedColor(): {
  /** 当前选中的条目(永不为 null,除非文档为空) */
  entry: ColorEntry | null;
  /** 显式选中的 id(viewState.selectedColorId) */
  selectedId: string | null;
  /** 实际生效的 id(显式选中,或回退 anchor) */
  effectiveId: string | null;
  isSelected: (id: string) => boolean;
  select: (id: string | null) => void;
} {
  const { doc, setDoc } = useColorStudio();

  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    const anchorId = palette?.colorIds[0] ?? null;
    const explicit = doc.viewState.selectedColorId;
    // 显式选中的条目必须真实存在(可能被删除),否则回退 anchor
    const explicitEntry = explicit
      ? doc.colorEntries.find((c) => c.id === explicit) ?? null
      : null;
    const effective = explicitEntry
      ? explicitEntry.id
      : anchorId;
    const entry = effective
      ? doc.colorEntries.find((c) => c.id === effective) ?? null
      : null;
    return {
      entry,
      selectedId: explicit,
      effectiveId: effective,
      isSelected: (id: string) => id === effective,
      select: (id: string | null) => {
        setDoc((d) => ({
          ...d,
          viewState: { ...d.viewState, selectedColorId: id },
          meta: { ...d.meta, updatedAt: Date.now() },
        }));
      },
    };
  }, [doc, setDoc]);
}

/** 稳定的 select 回调(避免 useMemo 内函数每次重建导致下游 effect 抖动)。 */
export function useSelectColorCallback(): (id: string | null) => void {
  const { setDoc } = useColorStudio();
  return useCallback((id: string | null) => {
    setDoc((d) => ({
      ...d,
      viewState: { ...d.viewState, selectedColorId: id },
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  }, [setDoc]);
}
