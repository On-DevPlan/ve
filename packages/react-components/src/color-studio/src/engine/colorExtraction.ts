// packages/react-components/src/color-studio/src/engine/colorExtraction.ts
//
// 简单 K-means(在线 hard assignment + 多次迭代)在 OKLCH 空间聚类。
// 输出按群规模降序的 k 个 hex,image worker 友好(无 DOM 依赖)。

import { converter, formatHex } from 'culori';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const toOklch = converter('oklch');

interface Point { oklch: [number, number, number] }

function toHexOklch(l: number, c: number, h: number): Hex {
  const out = formatHex({ mode: 'oklch', l, c, h });
  if (!out) return '#000000';
  return out.toUpperCase() as Hex;
}

function dist(a: Point, b: Point): number {
  const dl = a.oklch[0] - b.oklch[0];
  const dc = a.oklch[1] - b.oklch[1];
  const dh = a.oklch[2] - b.oklch[2];
  return dl * dl + dc * dc + dh * dh;
}

export function extractDominantColors(image: ImageData, k: number): Hex[] {
  if (!image.data || image.data.length === 0 || k < 1) return [];
  const points: Point[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const a = image.data[i + 3];
    if (a < 200) continue;
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const ok = toOklch(rgb);
    if (!ok || ok.l === undefined || ok.c === undefined) continue;
    // h 在 c=0 时可能 undefined;统一用 0 默认。后续 toHexOklch 会自动处理灰色。
    points.push({ oklch: [ok.l, ok.c, ok.h ?? 0] });
  }
  if (points.length === 0) return [];

  const centroidCount = Math.min(k, points.length);
  const centroids: Point[] = [];
  // k-means++ lite init:第一个 centroid 选 points[0];之后每个 centroid 选
  // 「距离已选 centroids 最远」的那个点。让初始 centroid 均匀铺开,
  // 避免 cluster 大小不均时 uniform-sample 把多个 centroid 堆在主色上。
  centroids.push({ oklch: points[0].oklch });
  for (let i = 1; i < centroidCount; i++) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let pi = 0; pi < points.length; pi++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = dist(points[pi], c);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = pi; }
    }
    centroids.push({ oklch: points[bestIdx].oklch });
  }

  const ITER = 12;
  for (let it = 0; it < ITER; it++) {
    const sums = centroids.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (const p of points) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < centroids.length; ci++) {
        const d = dist(p, centroids[ci]);
        if (d < bestDist) { bestDist = d; bestIdx = ci; }
      }
      sums[bestIdx][0] += p.oklch[0];
      sums[bestIdx][1] += p.oklch[1];
      sums[bestIdx][2] += p.oklch[2];
      sums[bestIdx][3] += 1;
    }
    for (let i = 0; i < centroids.length; i++) {
      const count = sums[i][3];
      if (count > 0) {
        centroids[i] = {
          oklch: [
            sums[i][0] / count,
            sums[i][1] / count,
            sums[i][2] / count,
          ],
        };
      }
    }
  }

  // 数群规模
  const counts = new Array(centroids.length).fill(0);
  for (const p of points) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let ci = 0; ci < centroids.length; ci++) {
      const d = dist(p, centroids[ci]);
      if (d < bestDist) { bestDist = d; bestIdx = ci; }
    }
    counts[bestIdx]++;
  }

  // 按规模降序输出
  const order = centroids
    .map((c, i) => ({ c, count: counts[i] }))
    .sort((a, b) => b.count - a.count);

  const out = order.map((o) => toHexOklch(o.c.oklch[0], o.c.oklch[1], o.c.oklch[2]));
  return out;
}
