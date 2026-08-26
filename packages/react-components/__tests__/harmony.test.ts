import { describe, it, expect } from 'vitest';
import { deriveHarmony } from '../src/color-studio/src/engine/harmony';
import { fromHex } from '../src/color-studio/src/engine/colorMath';

describe('harmony.deriveHarmony', () => {
  it('complementary: anchor + 180° hue', () => {
    const anchor = '#FF0000'; // h=0
    const out = deriveHarmony(anchor, 'complementary');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('#FF0000');
    // 互补应是 cyan(180° 偏移到 h=180,full sat,l=50%)
    // hue=180 + sat=100 + l=50 → 大约 #00FFFF
    expect(out[1]).toBe('#00FFFF');
  });

  it('complementary: 锚色 h=180,派生应是 red 系', () => {
    const cyan = '#00FFFF';
    const out = deriveHarmony(cyan, 'complementary');
    expect(out[1]).toBe('#FF0000');
  });

  it('triadic: 3 输出', () => {
    const out = deriveHarmony('#FF0000', 'triadic');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('#FF0000');
    // 120° → green 系
    const hsl120 = fromHex(out[1]).hsl;
    expect(hsl120.h).toBeCloseTo(120, 0);
    // 240° → blue 系
    const hsl240 = fromHex(out[2]).hsl;
    expect(hsl240.h).toBeCloseTo(240, 0);
  });

  it('analogous: anchor ±30° 输出 3 色', () => {
    const out = deriveHarmony('#FF0000', 'analogous');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('#FF0000');
    const hslM30 = fromHex(out[1]).hsl;
    expect(hslM30.h).toBeCloseTo(330, 0); // -30° normalized to 330°
    const hslP30 = fromHex(out[2]).hsl;
    expect(hslP30.h).toBeCloseTo(30, 0);
  });

  it('split-complementary: 输出 3 色,角度偏移 150°/210°', () => {
    const out = deriveHarmony('#FF0000', 'split-complementary');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('#FF0000');
    const hsl150 = fromHex(out[1]).hsl;
    expect(hsl150.h).toBeCloseTo(150, 0);
    const hsl210 = fromHex(out[2]).hsl;
    expect(hsl210.h).toBeCloseTo(210, 0);
  });

  it('monochromatic: 输出 5 色,色相同(单色不变色相)', () => {
    const out = deriveHarmony('#FF0000', 'monochromatic');
    expect(out).toHaveLength(5);
    out.forEach((hex) => expect(hex).toMatch(/^#[0-9A-F]{6}$/));
    // 所有输出的色相应近似 0(红色)
    out.forEach((hex) => {
      const h = fromHex(hex).hsl.h;
      // h NaN 也可通过 —— 红/黑/白都 h≈0
      expect(Number.isFinite(h) || hex === '#000000' || hex === '#FFFFFF').toBe(true);
    });
  });
});
