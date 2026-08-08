// src/lib/projection.ts —— 经纬度 → 画布像素（设计规范 §4.1）
import type { MapConfig } from '../types';

export const DEFAULT_MAP_CONFIG: MapConfig = {
  bounds: { minLng: 73.5, maxLng: 135, minLat: 18, maxLat: 53.5 },
  offset: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
};

export function project(
  lng: number,
  lat: number,
  canvasW: number,
  canvasH: number,
  cfg: MapConfig = DEFAULT_MAP_CONFIG,
): { x: number; y: number } {
  const { bounds, offset, scale } = cfg;
  const wx = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
  const wy = 1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat); // y 轴翻转
  return {
    x: wx * canvasW * scale.x + offset.x,
    y: wy * canvasH * scale.y + offset.y,
  };
}
