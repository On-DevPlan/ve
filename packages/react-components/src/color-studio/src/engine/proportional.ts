// packages/react-components/src/color-studio/src/engine/proportional.ts
//
// 比例呈现纯逻辑:weight → 归一化百分比(条形/环形/面积三种渲染共用)。

import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export interface ProportionalSlice {
  entry: ColorEntry;
  /** 0..100,保留 2 位小数 */
  pct: number;
}

/** weight 归一化。全 0 时均匀分配。 */
export function normalizeWeights(entries: ColorEntry[]): ProportionalSlice[] {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) {
    const even = entries.length > 0 ? 100 / entries.length : 0;
    return entries.map((e) => ({ entry: e, pct: Math.round(even * 100) / 100 }));
  }
  return entries.map((e) => ({
    entry: e,
    pct: Math.round((Math.max(0, e.weight) / total) * 10000) / 100,
  }));
}

/** 环形图 SVG path(单扇区)。cx/cy 圆心,r 半径,startPct/endPct 0..100。 */
export function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startPct: number,
  endPct: number,
): string {
  const a0 = (startPct / 100) * 2 * Math.PI - Math.PI / 2;
  const a1 = (endPct / 100) * 2 * Math.PI - Math.PI / 2;
  const large = endPct - startPct > 50 ? 1 : 0;
  const x0 = cx + rOuter * Math.cos(a0);
  const y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1);
  const y1 = cy + rOuter * Math.sin(a1);
  const x2 = cx + rInner * Math.cos(a1);
  const y2 = cy + rInner * Math.sin(a1);
  const x3 = cx + rInner * Math.cos(a0);
  const y3 = cy + rInner * Math.sin(a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3}`,
    'Z',
  ].join(' ');
}
