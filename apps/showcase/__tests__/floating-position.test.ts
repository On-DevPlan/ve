// floating-position.test.ts —— FloatingBack 位置纯逻辑单测。
//
// 覆盖:默认位置(右下角)、clamp(拖出视口拉回)、localStorage 存取与损坏兜底。
// 纯函数不碰真实 DOM 定位,storage 以参数注入,jsdom 下直接可用。

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clampPos,
  defaultPos,
  loadPos,
  savePos,
  FLOATING_BACK_POS_KEY,
  FLOATING_BACK_SIZE,
  FLOATING_BACK_MARGIN,
} from '../src/components/floating-position';

describe('floating-position', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = window.localStorage;
    storage.clear();
  });

  afterEach(() => {
    storage.clear();
  });

  describe('defaultPos', () => {
    it('右下角:视口尺寸 - 按钮 - 边距', () => {
      expect(defaultPos(1280, 800)).toEqual({
        x: 1280 - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
        y: 800 - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
      });
    });
  });

  describe('clampPos', () => {
    it('正常范围内的位置原样返回', () => {
      const pos = { x: 100, y: 200 };
      expect(clampPos(pos, 1280, 800)).toEqual(pos);
    });

    it('拖出右边/下边:拉回视口内(留边距)', () => {
      expect(clampPos({ x: 2000, y: 2000 }, 1280, 800)).toEqual({
        x: 1280 - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
        y: 800 - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
      });
    });

    it('拖出左边/上边:拉到最小边距', () => {
      expect(clampPos({ x: -50, y: -50 }, 1280, 800)).toEqual({
        x: FLOATING_BACK_MARGIN,
        y: FLOATING_BACK_MARGIN,
      });
    });

    it('视口比按钮还小:不产生负区间,钉在边距处', () => {
      expect(clampPos({ x: 500, y: 500 }, 40, 30)).toEqual({
        x: FLOATING_BACK_MARGIN,
        y: FLOATING_BACK_MARGIN,
      });
    });
  });

  describe('savePos / loadPos', () => {
    it('save 后 load 原样读回', () => {
      savePos(storage, { x: 12, y: 34 });
      expect(loadPos(storage)).toEqual({ x: 12, y: 34 });
      expect(storage.getItem(FLOATING_BACK_POS_KEY)).toBe(JSON.stringify({ x: 12, y: 34 }));
    });

    it('未存储时返回 null', () => {
      expect(loadPos(storage)).toBeNull();
    });

    it('JSON 损坏时返回 null(不抛错)', () => {
      storage.setItem(FLOATING_BACK_POS_KEY, '{not-json');
      expect(loadPos(storage)).toBeNull();
    });

    it('结构不对(缺字段/非数字)返回 null', () => {
      storage.setItem(FLOATING_BACK_POS_KEY, JSON.stringify({ x: 'a', y: 1 }));
      expect(loadPos(storage)).toBeNull();
      storage.setItem(FLOATING_BACK_POS_KEY, JSON.stringify({ x: 1 }));
      expect(loadPos(storage)).toBeNull();
    });

    it('storage 为 null 时静默跳过(load null / save 不抛)', () => {
      expect(loadPos(null)).toBeNull();
      expect(() => savePos(null, { x: 1, y: 2 })).not.toThrow();
    });

    it('storage 抛异常(隐私模式)时不外抛', () => {
      const throwing = {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      } as unknown as Storage;
      expect(loadPos(throwing)).toBeNull();
      expect(() => savePos(throwing, { x: 1, y: 2 })).not.toThrow();
    });
  });
});
