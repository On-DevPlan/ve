// packages/react-components/src/color-studio/src/engine/filterCss.ts
//
// 滤镜栈 → CSS filter 字符串(非破坏性:只派生,不改 hex)。

import type { FilterConfig } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 单个 filter → CSS 片段;中性值返回 null(brightness 100 等不产生输出)。 */
function filterToCss(f: FilterConfig): string | null {
  switch (f.type) {
    case 'brightness':
    case 'contrast':
    case 'saturate': {
      const v = clamp(f.value, 0, 300);
      if (v === 100) return null;
      return `${f.type}(${(v / 100).toFixed(2)})`;
    }
    case 'hueRotate': {
      const v = clamp(f.value, 0, 360);
      if (v === 0) return null;
      return `hue-rotate(${Math.round(v)}deg)`;
    }
    case 'grayscale':
    case 'sepia':
    case 'invert': {
      const v = clamp(f.value, 0, 100);
      if (v === 0) return null;
      return `${f.type}(${(v / 100).toFixed(2)})`;
    }
  }
}

/** 整个滤镜栈(只取 enabled)→ 一条 CSS filter 值;全空返回 'none'。 */
export function filterStackToCss(stack: FilterConfig[]): string {
  const parts = stack
    .filter((f) => f.enabled)
    .map(filterToCss)
    .filter((s): s is string => s !== null);
  return parts.length > 0 ? parts.join(' ') : 'none';
}
