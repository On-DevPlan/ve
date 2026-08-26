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

// re-export modeRgb to keep tree-shaking warning quiet
void modeRgb;
