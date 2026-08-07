// src/lib/hitTest.ts —— 点击/悬停命中检测（设计规范 §4.4）
import type { ProvincePath } from '../types';

export function hitTest(
  provinces: ProvincePath[],
  ctx: CanvasRenderingContext2D,
  clientX: number,
  clientY: number,
): string | null {
  const rect = ctx.canvas.getBoundingClientRect();
  // clientX/clientY 是视口坐标,先减去画布偏移得到画布内坐标,再按比例换算到逻辑坐标。
  const x = (clientX - rect.left) * (ctx.canvas.width / rect.width);
  const y = (clientY - rect.top) * (ctx.canvas.height / rect.height);
  // 倒序遍历：后绘制的省份优先（岛屿、重叠边界）
  for (let i = provinces.length - 1; i >= 0; i--) {
    const p = provinces[i];
    for (const path of p.paths) {
      if (ctx.isPointInPath(path, x, y)) return p.name;
    }
  }
  return null;
}
