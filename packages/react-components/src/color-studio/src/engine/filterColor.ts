// packages/react-components/src/color-studio/src/engine/filterColor.ts
//
// 滤镜栈 → 实际色值:把非破坏性滤镜参数数学烘焙到 hex 上。
// 与 CSS filter 语义对齐(Filter Effects spec):
//   - brightness/contrast/saturate/grayscale/invert 在 sRGB 直接运算
//   - hue-rotate/sepia 走线性化 RGB 矩阵(spec 要求)

import { converter } from 'culori';
import type { ColorStudioDocument, FilterConfig, Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { toHex } from './colorMath';

const toRgb = converter('rgb');

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 0.41666) - 0.055;
}

type Rgb = [number, number, number];

/** 中性值(亮度 100 等)跳过,与 filterCss 的跳过逻辑一致。 */
function isNeutral(f: FilterConfig): boolean {
  switch (f.type) {
    case 'brightness':
    case 'contrast':
    case 'saturate':
      return f.value === 100;
    case 'hueRotate':
      return f.value % 360 === 0;
    case 'grayscale':
    case 'sepia':
    case 'invert':
      return f.value === 0;
  }
}

function applyOne(f: FilterConfig, rgb: Rgb): Rgb {
  const [r, g, b] = rgb;
  switch (f.type) {
    case 'brightness': {
      const k = f.value / 100;
      return [clamp01(r * k), clamp01(g * k), clamp01(b * k)];
    }
    case 'contrast': {
      const k = f.value / 100;
      return [clamp01((r - 0.5) * k + 0.5), clamp01((g - 0.5) * k + 0.5), clamp01((b - 0.5) * k + 0.5)];
    }
    case 'saturate': {
      const k = f.value / 100;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return [clamp01(l + (r - l) * k), clamp01(l + (g - l) * k), clamp01(l + (b - l) * k)];
    }
    case 'grayscale': {
      const k = 1 - f.value / 100;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return [clamp01(l + (r - l) * k), clamp01(l + (g - l) * k), clamp01(l + (b - l) * k)];
    }
    case 'invert': {
      const x = f.value / 100;
      return [clamp01(x * (1 - r) + (1 - x) * r), clamp01(x * (1 - g) + (1 - x) * g), clamp01(x * (1 - b) + (1 - x) * b)];
    }
    case 'hueRotate': {
      // spec:线性化 RGB 上的旋转矩阵
      const rad = ((f.value % 360) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
      const m = [
        0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
      ];
      return [
        clamp01(linearToSrgb(m[0]! * lr + m[1]! * lg + m[2]! * lb)),
        clamp01(linearToSrgb(m[3]! * lr + m[4]! * lg + m[5]! * lb)),
        clamp01(linearToSrgb(m[6]! * lr + m[7]! * lg + m[8]! * lb)),
      ];
    }
    case 'sepia': {
      const x = f.value / 100;
      const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
      const sr = 0.393 * lr + 0.769 * lg + 0.189 * lb;
      const sg = 0.349 * lr + 0.686 * lg + 0.168 * lb;
      const sb = 0.272 * lr + 0.534 * lg + 0.131 * lb;
      return [
        clamp01(linearToSrgb(lr + (sr - lr) * x)),
        clamp01(linearToSrgb(lg + (sg - lg) * x)),
        clamp01(linearToSrgb(lb + (sb - lb) * x)),
      ];
    }
  }
}

/** 按栈顺序把滤镜烘焙进 hex。空栈/全中性返回原 hex。 */
export function applyFilterStackToHex(hex: Hex, stack: FilterConfig[]): Hex {
  const active = stack.filter((f) => f.enabled && !isNeutral(f));
  if (active.length === 0) return hex.toUpperCase() as Hex;
  const rgb = toRgb(hex);
  let cur: Rgb = [rgb.r ?? 0, rgb.g ?? 0, rgb.b ?? 0];
  for (const f of active) {
    cur = applyOne(f, cur);
  }
  return toHex({ mode: 'rgb', r: cur[0], g: cur[1], b: cur[2] });
}

/** 便捷:取文档滤镜栈烘焙 anchor(或任意)hex。 */
export function bakeFilterOn(doc: ColorStudioDocument, hex: Hex): Hex {
  return applyFilterStackToHex(hex, doc.filterStack);
}
