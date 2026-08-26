// packages/react-components/src/color-studio/src/engine/contrast.ts
//
// WCAG 2.x 对比度计算 + 等级映射。

import { converter } from 'culori';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const toRgbConverter = converter('rgb');

function srgbChannel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: Hex): number {
  const rgb = toRgbConverter(hex);
  // culori r/g/b 是 0-1 范围
  return 0.2126 * srgbChannel((rgb.r ?? 0) * 255) +
         0.7152 * srgbChannel((rgb.g ?? 0) * 255) +
         0.0722 * srgbChannel((rgb.b ?? 0) * 255);
}

export function contrastRatio(a: Hex, b: Hex): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lo = Math.max(la, lb);
  const hi = Math.min(la, lb);
  return (lo + 0.05) / (hi + 0.05);
}

export type WcagGrade = 'AAA' | 'AA' | 'AA-large' | 'Fail';

export function wcagGrade(ratio: number): WcagGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'Fail';
}
