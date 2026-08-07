import { describe, it, expect } from 'vitest';
import chinaJson from '../../../apps/showcase/public/map/json/china.json';
import { PALETTE } from '../src/china-map-coloring/src/lib/constants';
import { decodeRing, decodeGeometry } from '../src/china-map-coloring/src/lib/decode';
import { project, DEFAULT_MAP_CONFIG } from '../src/china-map-coloring/src/lib/projection';
import { buildProvinces, toShortName } from '../src/china-map-coloring/src/lib/geojson';
import { hitTest } from '../src/china-map-coloring/src/lib/hitTest';
import type { ProvincePath } from '../src/china-map-coloring/src/types';
import { renderMap } from '../src/china-map-coloring/src/lib/render';

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

// Path2D 在 node 环境不存在；buildProvinces 仅在调用时构造，测试在此处注入桩即可。
class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
}
globalThis.Path2D = FakePath2D as unknown as typeof Path2D;

describe('toShortName', () => {
  it('shortens full administrative names', () => {
    expect(toShortName('新疆维吾尔自治区')).toBe('新疆');
    expect(toShortName('内蒙古自治区')).toBe('内蒙古');
    expect(toShortName('广东省')).toBe('广东');
    expect(toShortName('香港特别行政区')).toBe('香港');
    expect(toShortName('北京市')).toBe('北京市');
  });
});

describe('buildProvinces', () => {
  const provinces = buildProvinces(chinaJson as never, 1200, 900);

  it('builds one ProvincePath per feature (34)', () => {
    expect(provinces.length).toBe(34);
  });

  it('gives every province a closed Path2D and finite center', () => {
    for (const p of provinces) {
      expect(p.paths.length).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(p.center.x)).toBe(true);
      expect(Number.isFinite(p.center.y)).toBe(true);
      expect(p.paths[0]).toBeInstanceOf(FakePath2D);
    }
  });

  it('keeps the existing (already-short) names as displayName', () => {
    const taiwan = provinces.find((p) => p.name === '台湾');
    expect(taiwan?.displayName).toBe('台湾');
  });
});

describe('hitTest', () => {
  const mk = (name: string): ProvincePath => ({
    name,
    displayName: name,
    center: { x: 0, y: 0 },
    centerLngLat: [0, 0],
    paths: [new FakePath2D() as unknown as Path2D],
    bounds: { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 },
  });

  const baseRect = { left: 0, top: 0, width: 600, height: 450 };

  it('converts viewport coords to canvas-local before hit-testing (subtracts rect offset)', () => {
    const provinces = [mk('广东'), mk('广西')];
    const calls: [number, number][] = [];
    const ctx = {
      canvas: {
        width: 1200,
        height: 900,
        getBoundingClientRect: () => ({ left: 40, top: 20, width: 600, height: 450 }),
      },
      isPointInPath: (_p: Path2D, x: number, y: number) => {
        calls.push([x, y]);
        return true;
      },
    } as unknown as CanvasRenderingContext2D;
    expect(hitTest(provinces, ctx, 100, 100)).toBe('广西');
    // (100-40) * (1200/600) = 120；(100-20) * (900/450) = 160
    expect(calls[0]).toEqual([120, 160]);
  });

  it('picks the later province when two overlap (reverse-order priority)', () => {
    const provinces = [mk('广东'), mk('广西')];
    const ctx = {
      canvas: { width: 1200, height: 900, getBoundingClientRect: () => baseRect },
      isPointInPath: () => true, // 两个省都命中
    } as unknown as CanvasRenderingContext2D;
    expect(hitTest(provinces, ctx, 100, 100)).toBe('广西');
  });

  it('returns null when nothing is hit', () => {
    const provinces = [mk('广东')];
    const ctx = {
      canvas: { width: 1200, height: 900, getBoundingClientRect: () => baseRect },
      isPointInPath: () => false,
    } as unknown as CanvasRenderingContext2D;
    expect(hitTest(provinces, ctx, 100, 100)).toBeNull();
  });
});

function createRecordingCtx() {
  const calls: { op: string; fillStyle?: string; strokeStyle?: string }[] = [];
  const ctx = {
    canvas: { width: 1200, height: 900 },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    textAlign: '',
    textBaseline: '',
    font: '',
    clearRect(): void {},
    fillRect(): void {},
    save(): void {},
    restore(): void {},
    fill(): void { calls.push({ op: 'fill', fillStyle: ctx.fillStyle }); },
    stroke(): void { calls.push({ op: 'stroke', strokeStyle: ctx.strokeStyle }); },
    fillText(): void { calls.push({ op: 'fillText' }); },
    strokeText(): void { calls.push({ op: 'strokeText' }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('renderMap', () => {
  it('fills a colored province under the province text (order B)', () => {
    const provinces = buildProvinces(chinaJson as never, 1200, 900);
    const color = '#FF6B6B';
    const { ctx, calls } = createRecordingCtx();
    renderMap(ctx, provinces, { 广东: color }, null, false);

    const colorFillIdx = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === color);
    const textIdx = calls.findIndex((c) => c.op === 'strokeText');
    expect(colorFillIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThan(colorFillIdx); // 涂色先于省名文字
  });

  it('draws white base fill before any stroke (no gap between provinces)', () => {
    const provinces = buildProvinces(chinaJson as never, 1200, 900);
    const { ctx, calls } = createRecordingCtx();
    renderMap(ctx, provinces, {}, null, false);
    const firstFill = calls.findIndex((c) => c.op === 'fill' && c.fillStyle === '#FFFFFF');
    const firstStroke = calls.findIndex((c) => c.op === 'stroke');
    expect(firstFill).toBeGreaterThanOrEqual(0);
    expect(firstStroke).toBeGreaterThan(firstFill);
  });
});
