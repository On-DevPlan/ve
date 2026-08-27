// packages/react-components/src/color-studio/src/engine/harmony.ts
//
// 5 种和声规则派生:HSL 色相角加偏移,monochromatic 走明度档。

import { converter, modeRgb, type Color } from 'culori';
import {
  toHex,
  fromHex,
  interpolateColor,
} from './colorMath';
import {
  HARMONY_ANGLE_TABLE,
  HARMONY_OUTPUT_LENGTH,
  MONOCHROMATIC_TIERS,
} from '../utils/constants';
import type { Hex, HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const toHslConverter = converter('hsl');

function hueShift(hex: Hex, deltaDeg: number): Hex {
  const hsl = toHslConverter(hex);
  const cur = hsl.h ?? 0;
  const next = ((cur + deltaDeg) % 360 + 360) % 360;
  return toHex({ mode: 'hsl', h: next, s: hsl.s ?? 0, l: hsl.l ?? 0 } as Color);
}

function darkenTo(hex: Hex, targetL: number): Hex {
  // 与黑插值到目标 l。
  const currentL = fromHex(hex).hsl.l ?? 0;
  if (currentL === 0) return toHex({ mode: 'rgb', r: 0, g: 0, b: 0 } as Color);
  if (targetL === 0) return toHex({ mode: 'rgb', r: 0, g: 0, b: 0 } as Color);
  // 与黑色线性插值:hex * (targetL/currentL) 但 OKLCH 感知均匀插值更准
  return interpolateColor(hex, '#000000', 1 - targetL / currentL);
}

function lightenTo(hex: Hex, targetL: number): Hex {
  const currentL = fromHex(hex).hsl.l ?? 0;
  if (currentL >= 1) return toHex({ mode: 'rgb', r: 1, g: 1, b: 1 } as Color);
  return interpolateColor(hex, '#FFFFFF', (targetL - currentL) / (1 - currentL));
}

/** Monochromatic:5 档明度梯度。同色相,通过插值到固定的明度点。 */
function monochromaticTiers(anchor: Hex): Hex[] {
  // 目标明度档:20%, 40%, 60%, 80%, 100% 给 anchor 提升 / 降档
  const baseL = fromHex(anchor).hsl.l ?? 0;
  const targets = [0.1, 0.35, 0.6, 0.85, 0.95];
  return targets.map((target) => {
    if (Math.abs(target - baseL) < 0.01) return anchor;
    return target > baseL ? lightenTo(anchor, target) : darkenTo(anchor, target);
  });
}

export function deriveHarmony(anchor: Hex, type: HarmonyType): Hex[] {
  if (type === 'monochromatic') {
    return monochromaticTiers(anchor).slice(0, MONOCHROMATIC_TIERS);
  }
  const offsets = HARMONY_ANGLE_TABLE[type];
  const expected = HARMONY_OUTPUT_LENGTH[type];
  const result = [anchor, ...offsets.map((deg) => hueShift(anchor, deg))];
  // 安全:无论 offsets 数量如何,总以 HARMONY_OUTPUT_LENGTH 为准
  return result.slice(0, expected);
}

/**
 * 和声标记的角度(色盘上小点画在哪)。
 * 相对 anchor 色相角偏移,归一化到 [0, 360)。
 * 修正:此前 HarmonyOverlay 用绝对角度画点(互补永远 180°),
 * 不随 anchor 色相变化,导致选不同颜色时小点位置不跟随、预览错位。
 * monochromatic 无标记角度(画同心圆,见 harmonyMarkerRadiusFactor)。
 */
export function harmonyMarkerAngles(anchorHue: number, type: HarmonyType): number[] {
  if (type === 'monochromatic') return [];
  const offsets = HARMONY_ANGLE_TABLE[type];
  if (!offsets) return [];
  return offsets.map((deg) => (((anchorHue + deg) % 360) + 360) % 360);
}

/**
 * 和声标记的径向位置系数(相对色盘半径,0..1)。
 * 非单色规则:派生色饱和度 = anchor 饱和度(hueShift 保持 s),
 * 因此小点应画在与 anchor 相同深度处 —— 近圆心锚点 → 近圆心派生点。
 * 单色规则:返回 4 档同心圆系数(明度梯度示意,与 anchor 饱和度无关)。
 */
export function harmonyMarkerRadiusFactor(
  type: HarmonyType,
  anchorSaturation: number,
): number[] {
  if (type === 'monochromatic') return [0.2, 0.4, 0.6, 0.8];
  const sat = Number.isFinite(anchorSaturation) ? Math.max(0, Math.min(1, anchorSaturation)) : 0;
  return [sat];
}

// re-export modeRgb to keep tree-shaking warning quiet
void modeRgb;
