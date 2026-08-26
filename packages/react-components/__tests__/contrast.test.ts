import { describe, it, expect } from 'vitest';
import { contrastRatio, wcagGrade } from '../src/color-studio/src/engine/contrast';

describe('contrast', () => {
  describe('contrastRatio', () => {
    it('white-on-black = 21', () => {
      expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    });
    it('black-on-black = 1', () => {
      expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 1);
    });
    it('white-on-white = 1', () => {
      expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
    });
    it('is symmetric', () => {
      const a = contrastRatio('#888888', '#FF0000');
      const b = contrastRatio('#FF0000', '#888888');
      expect(a).toBeCloseTo(b, 5);
    });
    it('color pair #3B82F6 (default blue) on white is between 3 and 5', () => {
      const r = contrastRatio('#3B82F6', '#FFFFFF');
      expect(r).toBeGreaterThan(3);
      expect(r).toBeLessThan(5);
    });
  });
  describe('wcagGrade', () => {
    it('21 → AAA', () => {
      expect(wcagGrade(21)).toBe('AAA');
    });
    it('7 → AAA', () => {
      expect(wcagGrade(7)).toBe('AAA');
    });
    it('4.5 → AA', () => {
      expect(wcagGrade(4.5)).toBe('AA');
    });
    it('3 → AA-large', () => {
      expect(wcagGrade(3)).toBe('AA-large');
    });
    it('2 → Fail', () => {
      expect(wcagGrade(2)).toBe('Fail');
    });
    it('boundary at exactly 4.5 rounds to AA', () => {
      expect(wcagGrade(4.499)).toBe('AA-large');
      expect(wcagGrade(4.5)).toBe('AA');
    });
  });
});
