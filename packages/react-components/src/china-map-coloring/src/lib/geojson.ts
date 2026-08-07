// src/lib/geojson.ts —— GeoJSON → ProvincePath[]（设计规范 §4.2，适配 ve 编码数据）
import type { GeoJsonFeatureCollection, MapConfig, ProvincePath } from '../types';
import { project, DEFAULT_MAP_CONFIG } from './projection';
import { decodeGeometry } from './decode';

const SHORT_NAME_MAP: Record<string, string> = {
  新疆维吾尔自治区: '新疆',
  宁夏回族自治区: '宁夏',
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
};

export function toShortName(full: string): string {
  if (SHORT_NAME_MAP[full]) return SHORT_NAME_MAP[full];
  if (full.endsWith('省')) return full.slice(0, -1);
  if (full.endsWith('特别行政区')) return full.replace('特别行政区', '');
  return full;
}

export function buildProvinces(
  fc: GeoJsonFeatureCollection,
  canvasW: number,
  canvasH: number,
  cfg: MapConfig = DEFAULT_MAP_CONFIG,
): ProvincePath[] {
  return fc.features
    .filter((f) => f.properties?.name)
    .map((f) => {
      const name = f.properties.name as string;
      const rings = decodeGeometry(f); // 展平后的「环」数组
      const paths: Path2D[] = [];
      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      // 每环独立一个 Path2D（含岛屿；环首尾由 closePath 闭合）
      for (const ring of rings) {
        const path = new Path2D();
        ring.forEach(([lng, lat], idx) => {
          const { x, y } = project(lng, lat, canvasW, canvasH, cfg);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          if (idx === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
        paths.push(path);
      }

      const cp: [number, number] = f.properties.cp ?? [minLng, minLat];
      const c = project(cp[0], cp[1], canvasW, canvasH, cfg);
      return {
        name,
        displayName: toShortName(name),
        center: c,
        centerLngLat: [cp[0], cp[1]],
        paths,
        bounds: { minLng, maxLng, minLat, maxLat },
      };
    });
}
