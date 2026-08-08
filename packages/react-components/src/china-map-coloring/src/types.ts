// src/types.ts —— china-map-coloring 共享类型

export interface MapConfig {
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number };
  offset: { x: number; y: number };
  scale: { x: number; y: number };
}

/** ve china.json 的最小 GeoJSON 形状（ECharts 压缩编码） */
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    id?: string;
    cp?: [number, number]; // 中心点 [lng, lat]
    name?: string;
    childNum?: number;
  };
  geometry: {
    type: 'MultiPolygon' | 'Polygon';
    // MultiPolygon: coordinates[p] = 环字符串数组; Polygon: coordinates = 环字符串数组
    coordinates: string[][] | string[];
    // encodeOffsets[p] = 每环 offset（实际数据 [p][0] 为 [x,y]）; Polygon 时为每环 offset
    encodeOffsets: number[][][];
  };
}

export interface ProvincePath {
  name: string;
  displayName: string;
  center: { x: number; y: number };
  centerLngLat: [number, number];
  paths: Path2D[];
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number };
}

export interface PaletteColor {
  name: string;
  value: string;
}
