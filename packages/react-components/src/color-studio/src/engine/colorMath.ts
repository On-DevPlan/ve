// packages/react-components/src/color-studio/src/engine/colorMath.ts
//
// culori 包装:唯一存储格式是 hex,其余格式在引擎层实时派生。

import {
  parse,
  formatHex,
  converter,
  interpolate,
  formatCss,
  type Color,
} from 'culori';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const toRgbConverter = converter('rgb');
const toHslConverter = converter('hsl');
const toHsvConverter = converter('hsv');
const toLabConverter = converter('lab');
const toLchConverter = converter('lch');
const toOklchConverter = converter('oklch');

export interface AllFormats {
  hex: Hex;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  hsv: { h: number; s: number; v: number };
  lab: { l: number; a: number; b: number };
  lch: { l: number; c: number; h: number };
  oklch: { l: number; c: number; h: number };
}

/** 任何 culori Color → 大写 hex。 */
export function toHex(color: Color): Hex {
  const out = formatHex(color);
  if (!out) throw new Error('toHex: cannot convert color to hex');
  return out.toUpperCase() as Hex;
}

/** hex → 六格式并列对象。 */
export function fromHex(hex: Hex): AllFormats {
  const rgb = toRgbConverter(hex);
  const hsl = toHslConverter(hex);
  const hsv = toHsvConverter(hex);
  const lab = toLabConverter(hex);
  const lch = toLchConverter(hex);
  const oklch = toOklchConverter(hex);
  return {
    hex: hex.toUpperCase() as Hex,
    rgb,
    hsl,
    hsv,
    lab,
    lch,
    oklch,
  };
}

/** 容错输入解析:支持 #RGB/#RRGGBB (大小写)、0xRRGGBB、CSS 颜色名、hsl()/rgb()。
 *  失败返 null。 */
export function parseUserInput(input: string): Hex | null {
  const s = input.trim();
  if (!s) return null;

  // 1) culori 直接 parse(CSS 名、hsl()、rgb()、oklch()、#hex 都支持)
  const direct = parse(s);
  if (direct) {
    const rgb = toRgbConverter(direct);
    if (
      rgb && !Number.isNaN(rgb.r) && !Number.isNaN(rgb.g) && !Number.isNaN(rgb.b)
    ) {
      // 过滤完全黑且无 hue 的边缘灰(culori 会给 null 但 parser 是宽松的)
      return toHex(direct);
    }
  }

  // 2) 'FF5733' → '#FF5733' / 'abc' → '#aabbcc'
  let candidate = s;
  if (/^[0-9a-f]{3}$/i.test(s)) candidate = `#${s}`;
  else if (/^[0-9a-f]{6}$/i.test(s)) candidate = `#${s}`;
  else if (/^0x[0-9a-f]{6}$/i.test(s)) candidate = `#${s.slice(2)}`;

  if (candidate !== s) {
    const parsed = parse(candidate);
    if (parsed) {
      const rgb = toRgbConverter(parsed);
      if (rgb && !Number.isNaN(rgb.r) && !Number.isNaN(rgb.g) && !Number.isNaN(rgb.b)) {
        return toHex(parsed);
      }
    }
  }

  return null;
}

/** 解析"添加新颜色"输入:空/无效 → 白色兜底(空板一键新建可编辑色卡)。 */
export function resolveNewColorHex(input: string): Hex {
  return parseUserInput(input) ?? '#FFFFFF';
}

/** OKLCH 感知均匀插值,输出 hex。 */
export function interpolateColor(a: Hex, b: Hex, t: number): Hex {
  const clampT = Math.max(0, Math.min(1, t));
  return toHex(interpolate([a, b], 'oklch')(clampT));
}

/** 给定 hex + 模式 → CSS 字符串(给 inline style 用)。 */
export function formatColorCss(hex: Hex, mode: 'rgb' | 'hsl' | 'oklch' = 'rgb'): string {
  return formatCss(mode, hex);
}

/** 可复制的格式类型(与 prefs.preferredCopyFormat 对齐)。 */
export type CopyableFormat = 'hex' | 'rgb' | 'hsl' | 'lab' | 'lch' | 'oklch';

/** hex → 指定格式的字符串。详情面板显示与复制按钮共用此出口,
 *  保证"所见即所复制"。 */
export function formatHexAs(hex: Hex, format: CopyableFormat): string {
  const f = fromHex(hex);
  switch (format) {
    case 'hex':
      return f.hex;
    case 'rgb':
      return `rgb(${Math.round(f.rgb.r * 255)}, ${Math.round(f.rgb.g * 255)}, ${Math.round(f.rgb.b * 255)})`;
    case 'hsl':
      return `hsl(${Math.round(f.hsl.h ?? 0)}, ${Math.round((f.hsl.s ?? 0) * 100)}%, ${Math.round((f.hsl.l ?? 0) * 100)}%)`;
    case 'lab':
      return `lab(${(f.lab.l ?? 0).toFixed(2)} ${(f.lab.a ?? 0).toFixed(2)} ${(f.lab.b ?? 0).toFixed(2)})`;
    case 'lch':
      return `lch(${(f.lch.l ?? 0).toFixed(2)} ${(f.lch.c ?? 0).toFixed(2)} ${(f.lch.h ?? 0).toFixed(2)})`;
    case 'oklch':
      return `oklch(${(f.oklch.l ?? 0).toFixed(3)} ${(f.oklch.c ?? 0).toFixed(3)} ${(f.oklch.h ?? 0).toFixed(2)})`;
  }
}
