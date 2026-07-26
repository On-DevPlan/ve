// __tests__/virtual-grid.test.ts —— 虚拟网格纯计算函数的单元测试。
//
// 被测对象:computeVirtualWindow —— 只做算术,不碰 DOM,可在 node 环境跑。
//
// 覆盖用例:
//   1) 列数由容器宽度 / (卡片宽 + gap) 推导,至少 1 列
//   2) 总高度 = 行数 * 行距,用于撑开滚动条
//   3) 可见区间 [startIndex, endIndex) 随 scrollTop 前移,并含 overscan 缓冲
//   4) offsetY = 起始行 * 行距,让可见卡片对齐真实滚动位置
//   5) 边界:空列表、滚动到底、总数不足一屏

import { describe, it, expect } from 'vitest';
import { computeVirtualWindow } from '../src/components/virtual-grid';

// 统一的基础输入:280px 卡 + 16px gap,卡高 150 + 16 gap = 167 行距
const base = {
  total: 1000,
  containerWidth: 912, // 3 列:(912 + 16) / (280 + 16) = 3.13 -> 3
  viewportHeight: 600,
  cardWidth: 280,
  cardHeight: 150,
  gap: 16,
  overscan: 1,
};

describe('computeVirtualWindow', () => {
  it('derives column count from container width', () => {
    const w = computeVirtualWindow({ ...base, scrollTop: 0 });
    expect(w.columns).toBe(3);
  });

  it('always keeps at least one column even for narrow containers', () => {
    const w = computeVirtualWindow({ ...base, containerWidth: 100, scrollTop: 0 });
    expect(w.columns).toBe(1);
  });

  it('computes total height to size the scroll spacer', () => {
    const w = computeVirtualWindow({ ...base, scrollTop: 0 });
    // 1000 项 / 3 列 = 334 行;行距 = 150 + 16 = 166;
    // 总高 = 334 * 166 - 16(末行无尾部 gap)
    const rows = Math.ceil(1000 / 3);
    expect(w.totalHeight).toBe(rows * (150 + 16) - 16);
  });

  it('starts at index 0 when not scrolled', () => {
    const w = computeVirtualWindow({ ...base, scrollTop: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.offsetY).toBe(0);
  });

  it('advances the visible window as scrollTop grows', () => {
    // 滚动 10 行 = 1660px;overscan 1 行 -> startRow = 10 - 1 = 9
    const w = computeVirtualWindow({ ...base, scrollTop: 1660 });
    const rowStride = 150 + 16;
    expect(w.startIndex).toBe(9 * 3); // 第 9 行首个索引
    expect(w.offsetY).toBe(9 * rowStride);
  });

  it('clamps endIndex to total item count', () => {
    const w = computeVirtualWindow({ ...base, scrollTop: 10_000_000 });
    expect(w.endIndex).toBeLessThanOrEqual(base.total);
    expect(w.startIndex).toBeLessThanOrEqual(w.endIndex);
  });

  it('handles empty list without producing negative ranges', () => {
    const w = computeVirtualWindow({ ...base, total: 0, scrollTop: 0 });
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(0);
    expect(w.totalHeight).toBe(0);
  });

  it('renders only a bounded slice, not the whole list', () => {
    const w = computeVirtualWindow({ ...base, scrollTop: 0 });
    // 视口 600 高,行距 166 -> ~4 行可见,加 overscan 两侧 ~6 行 = 18 卡,远小于 1000
    expect(w.endIndex - w.startIndex).toBeLessThan(30);
  });
});
