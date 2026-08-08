// src/lib/render.ts —— 画布渲染管线（设计规范 §4.3，顺序 B：涂色垫在文字下）
import type { ProvincePath } from '../types';

export function renderMap(
  ctx: CanvasRenderingContext2D,
  provinces: ProvincePath[],
  colorByProvince: Record<string, string>,
  hoverName: string | null,
  debugMode: boolean,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // 1) 清屏 + 底色（浅灰蓝，整图背景）
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F0F4F8';
  ctx.fillRect(0, 0, W, H);

  // 2) 白色省面（先铺白底，避免间隙露底色）
  ctx.fillStyle = '#FFFFFF';
  for (const p of provinces) p.paths.forEach((ph) => ctx.fill(ph));

  // 3) 省界描边（浅灰蓝）
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  for (const p of provinces) p.paths.forEach((ph) => ctx.stroke(ph));

  // 4) 已涂色省份覆盖层（顺序 B：先于省名，可读性更好）
  for (const p of provinces) {
    const color = colorByProvince[p.name];
    if (!color) continue;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    p.paths.forEach((ph) => ctx.fill(ph));
    ctx.restore();
  }

  // 5) 省份名称（白描边 + 深灰文字；字号随名称长度递减）
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of provinces) {
    const fontSize = p.displayName.length <= 2 ? 18 : p.displayName.length === 3 ? 16 : 14;
    ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.strokeText(p.displayName, p.center.x, p.center.y);
    ctx.fillStyle = '#475569';
    ctx.fillText(p.displayName, p.center.x, p.center.y);
  }

  // 6) 调试模式：红色描边整图
  if (debugMode) {
    ctx.save();
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    for (const p of provinces) p.paths.forEach((ph) => ctx.stroke(ph));
    ctx.restore();
  }

  // 7) Hover：蓝色高亮 + 深蓝描边
  if (hoverName) {
    const p = provinces.find((q) => q.name === hoverName);
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#3B82F6';
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      p.paths.forEach((ph) => {
        ctx.fill(ph);
        ctx.stroke(ph);
      });
      ctx.restore();
    }
  }
}
