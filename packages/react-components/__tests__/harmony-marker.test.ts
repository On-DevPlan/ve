import { describe, it, expect } from 'vitest';
import {
  harmonyMarkerAngles,
  harmonyMarkerRadiusFactor,
} from '../src/color-studio/src/engine/harmony';

describe('harmony.harmonyMarkerAngles', () => {
  // 小点的几何角度必须相对 anchor 的色相角偏移(而非绝对角度),
  // 否则选不同颜色时小点位置不跟随,预览错位。
  it('complementary: 相对 anchor 色相偏移 180°', () => {
    // anchor 色相 0°(红)
    expect(harmonyMarkerAngles(0, 'complementary')).toEqual([180]);
    // anchor 色相 30° → 派生角 210°
    expect(harmonyMarkerAngles(30, 'complementary')).toEqual([210]);
  });

  it('triadic: 相对 anchor +120°/+240°,anchor 色相参与计算', () => {
    expect(harmonyMarkerAngles(0, 'triadic')).toEqual([120, 240]);
    expect(harmonyMarkerAngles(30, 'triadic')).toEqual([150, 270]);
  });

  it('analogous: 相对 anchor −30°/+30°', () => {
    expect(harmonyMarkerAngles(0, 'analogous')).toEqual([330, 30]);
    // 30 − 30 = 0(取模后 0°,等价 360° 方向)
    expect(harmonyMarkerAngles(30, 'analogous')).toEqual([0, 60]);
  });

  it('split-complementary: 相对 anchor +150°/+210°', () => {
    expect(harmonyMarkerAngles(0, 'split-complementary')).toEqual([150, 210]);
    expect(harmonyMarkerAngles(30, 'split-complementary')).toEqual([180, 240]);
  });

  it('monochromatic: 无标记角度(单色用同心圆,无小点)', () => {
    expect(harmonyMarkerAngles(0, 'monochromatic')).toEqual([]);
  });

  it('未知规则: 返回空数组(安全兜底)', () => {
    expect(harmonyMarkerAngles(90, 'whatever' as never)).toEqual([]);
  });
});

describe('harmony.harmonyMarkerRadiusFactor', () => {
  it('非单色: 径向位置 = anchor 饱和度(近圆心 → 近圆心)', () => {
    // 低饱和 anchor(s=0.2)→ 小点画在半径 0.2 处
    expect(harmonyMarkerRadiusFactor('complementary', 0.2)).toEqual([0.2]);
    // 高饱和 anchor(s=1)→ 边缘
    expect(harmonyMarkerRadiusFactor('complementary', 1)).toEqual([1]);
  });

  it('非单色: 多种规则共用 anchor 饱和度', () => {
    expect(harmonyMarkerRadiusFactor('triadic', 0.5)).toEqual([0.5]);
    expect(harmonyMarkerRadiusFactor('analogous', 0.5)).toEqual([0.5]);
    expect(harmonyMarkerRadiusFactor('split-complementary', 0.5)).toEqual([0.5]);
  });

  it('单色: 返回同心圆半径系数 4 档(与 anchor 饱和度无关)', () => {
    expect(harmonyMarkerRadiusFactor('monochromatic', 0.2)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(harmonyMarkerRadiusFactor('monochromatic', 1)).toEqual([0.2, 0.4, 0.6, 0.8]);
  });
});
