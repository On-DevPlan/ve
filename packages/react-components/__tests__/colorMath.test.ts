import { describe, it, expect } from 'vitest';
import { toHex, fromHex, parseUserInput, interpolateColor } from '../src/color-studio/src/engine/colorMath';

describe('colorMath', () => {
  describe('toHex / fromHex', () => {
    it('round-trip preserves hex via HSL', () => {
      const hex = '#3B82F6';
      const r = fromHex(hex);
      expect(toHex(r.hsl)).toBe('#3B82F6');
    });

    it('round-trip preserves hex via OKLCH', () => {
      const hex = '#3B82F6';
      const r = fromHex(hex);
      expect(toHex(r.oklch)).toBe('#3B82F6');
    });

    it('fromHex returns all six color spaces', () => {
      const r = fromHex('#FF0000');
      expect(r).toHaveProperty('rgb');
      expect(r).toHaveProperty('hsl');
      expect(r).toHaveProperty('hsv');
      expect(r).toHaveProperty('lab');
      expect(r).toHaveProperty('lch');
      expect(r).toHaveProperty('oklch');
    });
  });

  describe('parseUserInput', () => {
    it('accepts 3-digit hex with #', () => {
      expect(parseUserInput('#abc')).toBe('#AABBCC');
    });
    it('accepts 6-digit hex with #', () => {
      expect(parseUserInput('#ABCDEF')).toBe('#ABCDEF');
    });
    it('accepts 6-digit hex lowercase', () => {
      expect(parseUserInput('#abcdef')).toBe('#ABCDEF');
    });
    it('accepts 6-digit hex without #', () => {
      expect(parseUserInput('FF5733')).toBe('#FF5733');
    });
    it('accepts 0x-prefixed hex', () => {
      expect(parseUserInput('0xFF5733')).toBe('#FF5733');
    });
    it('accepts red CSS color name', () => {
      expect(parseUserInput('red')).toBe('#FF0000');
    });
    it('accepts rebeccapurple CSS color name', () => {
      // rebeccapurple is #663399
      expect(parseUserInput('rebeccapurple')).toBe('#663399');
    });
    it('accepts hsl() string', () => {
      const out = parseUserInput('hsl(120, 100%, 50%)');
      expect(out).toMatch(/^#[0-9A-F]{6}$/);
    });
    it('returns null on garbage', () => {
      expect(parseUserInput('not-a-color')).toBeNull();
    });
    it('returns null on empty string', () => {
      expect(parseUserInput('')).toBeNull();
    });
    it('trims whitespace', () => {
      expect(parseUserInput('  #ABCDEF  ')).toBe('#ABCDEF');
    });
  });

  describe('interpolateColor', () => {
    it('t=0 returns first color', () => {
      expect(interpolateColor('#000000', '#FFFFFF', 0)).toBe('#000000');
    });
    it('t=1 returns second color', () => {
      expect(interpolateColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    });
    it('t=0.5 produces a valid mid hex', () => {
      const mid = interpolateColor('#000000', '#FFFFFF', 0.5);
      expect(mid).toMatch(/^#[0-9A-F]{6}$/);
    });
  });
});
