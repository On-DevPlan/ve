import { describe, it, expect } from 'vitest';
import chinaJson from '../../../apps/showcase/public/map/json/china.json';
import { PALETTE } from '../src/china-map-coloring/src/lib/constants';
import { decodeRing, decodeGeometry } from '../src/china-map-coloring/src/lib/decode';
import { project, DEFAULT_MAP_CONFIG } from '../src/china-map-coloring/src/lib/projection';

describe('PALETTE', () => {
  it('matches the spec exactly, 8 colors in order', () => {
    expect(PALETTE.map((c) => c.value)).toEqual([
      '#FFB6C1', '#90EE90', '#FFA500', '#87CEEB',
      '#DDA0DD', '#FFD700', '#FF6B6B', '#40E0D0',
    ]);
  });
});

describe('decodeRing', () => {
  it('decodes a real ring from china.json to a valid [lng, lat] first point', () => {
    const taiwan = chinaJson.features[0];
    // shape: coordinates[p] = ring strings; encodeOffsets[p][0] = [x, y] (unit ×1000)
    const firstRing = taiwan.geometry.coordinates[0][0] as unknown as string;
    const offset = taiwan.geometry.encodeOffsets[0][0] as unknown as [number, number];
    const pts = decodeRing(firstRing, offset);
    expect(pts.length).toBeGreaterThan(0);
    // first decoded point == offset ÷ 1000
    expect(pts[0][0]).toBeCloseTo(offset[0] / 1000, 3);
    expect(pts[0][1]).toBeCloseTo(offset[1] / 1000, 3);
    expect(Math.abs(pts[0][0])).toBeLessThan(180);
    expect(Math.abs(pts[0][1])).toBeLessThan(90);
  });
});

describe('decodeGeometry', () => {
  it('decodes all polygons of Taiwan, one valid ring each', () => {
    const taiwan = chinaJson.features[0];
    const polys = decodeGeometry(taiwan as never);
    expect(polys.length).toBe(taiwan.geometry.coordinates.length);
    for (const ringSet of polys) {
      for (const [lng, lat] of ringSet) {
        expect(Math.abs(lng)).toBeLessThan(180);
        expect(Math.abs(lat)).toBeLessThan(90);
      }
    }
  });
});

describe('project', () => {
  it('maps the bounds min corner to (0,0) and max corner to (1200,900)', () => {
    const b = DEFAULT_MAP_CONFIG.bounds;
    expect(project(b.minLng, b.maxLat, 1200, 900)).toEqual({ x: 0, y: 0 });
    expect(project(b.maxLng, b.minLat, 1200, 900)).toEqual({ x: 1200, y: 900 });
  });
});
