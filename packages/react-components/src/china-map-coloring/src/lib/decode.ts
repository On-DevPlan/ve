// src/lib/decode.ts —— ECharts `@@` 压缩编码解码（ve china.json 数据专属）
import type { GeoJsonFeature } from '../types';

/** 解码单环。offset 为该环起始点 [x, y]（单位 ×1000）。返回经纬度数组（÷1000）。 */
export function decodeRing(encoded: string, offset: [number, number]): [number, number][] {
  let px = offset[0];
  let py = offset[1];
  const out: [number, number][] = [];
  for (let i = 0; i < encoded.length; i += 2) {
    let x = encoded.charCodeAt(i) - 64;
    let y = encoded.charCodeAt(i + 1) - 64;
    x = (x >> 1) ^ -(x & 1);
    y = (y >> 1) ^ -(y & 1);
    x += px;
    y += py;
    px = x;
    py = y;
    out.push([x / 1000, y / 1000]);
  }
  return out;
}

/** 把 encodeOffsets 中某环的原始条目规整为 [x, y]；兼容 [[x,y]] 与 [x,y] 两种形态。 */
function toOffset(raw: number[] | number[][] | undefined): [number, number] {
  if (!raw) return [0, 0];
  const pair = Array.isArray(raw[0]) ? (raw[0] as number[]) : (raw as number[]);
  return [pair[0] ?? 0, pair[1] ?? 0];
}

/**
 * 解码一个 MultiPolygon 的全部多边形，展平为「环」数组：一环 → 一个 [lng,lat] 点数组。
 * encodeOffsets 与 coordinates 逐多边形对齐：coordinates[p][r] ↔ encodeOffsets[p][r]。
 */
export function decodeCoordinates(
  coordinates: string[][],
  encodeOffsets: number[][][],
): [number, number][][] {
  return coordinates.flatMap((rings, p) =>
    rings.map((ring, r) => decodeRing(ring, toOffset(encodeOffsets[p]?.[r] ?? encodeOffsets[p]?.[0]))),
  );
}

/** 解码一个 feature 的 geometry（MultiPolygon / Polygon 均处理），返回「环」数组。 */
export function decodeGeometry(feature: GeoJsonFeature): [number, number][][] {
  const g = feature.geometry;
  if (g.type === 'Polygon') {
    const rings = g.coordinates as string[];
    const offsets = g.encodeOffsets as unknown as (number[] | number[][])[];
    return rings.map((ring, r) => decodeRing(ring, toOffset(offsets[r])));
  }
  return decodeCoordinates(g.coordinates as string[][], g.encodeOffsets);
}
