# china-map-coloring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React `china-map-coloring` component in the ve showcase that renders a canvas China map from the repo's existing ECharts-encoded GeoJSON and lets users color provinces from an 8-color palette, replicating the Miaoda app per `docs/superpowers/specs/2026-08-07-china-map-coloring-design.md`.

**Architecture:** A self-contained React component at `packages/react-components/src/china-map-coloring/` (auto-discovered by the showcase loader). Pure map logic lives in `src/lib/*` (decode / projection / geojson / hitTest / render) with vitest coverage; React UI (canvas shell, color picker, debug panel) wraps them. Data is the existing `/map/json/china.json` (ECharts `@@`-encoded GeoJSON, decoded at runtime).

**Tech Stack:** React 19, TypeScript (strict), Canvas 2D (`Path2D` / `isPointInPath`), vitest. No new dependencies.

## Global Constraints

- Branch: `feat/china-map-coloring` (already created; design doc committed). Do NOT commit to `main`.
- Component root: `packages/react-components/src/china-map-coloring/`
- Test file (single, grows across Tasks 1–3): `packages/react-components/__tests__/china-map-coloring.test.ts`
- Zero new dependencies (React 19, TS, vitest already in the package).
- Canvas logical size fixed **1200×900** (`canvas.width/height`), CSS scales it.
- `DEFAULT_MAP_CONFIG` bounds **73.5/135/18/53.5**, offset `(0,0)`, scale `(1,1)` — do not change (map would deform).
- Render order = **B**: color fill under province text (only intentional visual difference from prototype).
- `PALETTE` must contain exactly these 8 colors: `#FFB6C1 #90EE90 #FFA500 #87CEEB #DDA0DD #FFD700 #FF6B6B #40E0D0`.
- CSS classes prefixed `sl-cmc-`; shell UI uses `var(--sl-*, fallback)` tokens; canvas colors are fixed hex.
- Strict TS (`noUnusedLocals`/`noUnusedParameters`); `pnpm lint` must pass (incl. `style-library/valid-component-config`).
- Conventional Commits; one atomic commit per task.

---

### Task 1: Map core — types, palette, decoder, projection

Pure math foundations with no canvas/DOM dependency. Establishes the types and the two pure functions later tasks rely on.

**Files:**
- Create: `packages/react-components/src/china-map-coloring/src/types.ts`
- Create: `packages/react-components/src/china-map-coloring/src/lib/constants.ts`
- Create: `packages/react-components/src/china-map-coloring/src/lib/decode.ts`
- Create: `packages/react-components/src/china-map-coloring/src/lib/projection.ts`
- Test: `packages/react-components/__tests__/china-map-coloring.test.ts`

**Interfaces:**
- Produces:
  - `interface MapConfig { bounds: {minLng;maxLng;minLat;maxLat}; offset: {x;y}; scale: {x;y} }` (from `types.ts`)
  - `interface ProvincePath { name: string; displayName: string; center: {x;y}; centerLngLat: [number,number]; paths: Path2D[]; bounds: {minLng;maxLng;minLat;maxLat} }`
  - `interface GeoJsonFeatureCollection / GeoJsonFeature` (ECharts-encoded shape)
  - `interface PaletteColor { name: string; value: string }`
  - `PALETTE: readonly PaletteColor[]` (8 entries, order: 粉红/浅绿/橙/蓝/紫/黄/红/青)
  - `decodeRing(encoded: string, offset: [number, number]): [number, number][]`
  - `decodeCoordinates(coordinates: string[][], encodeOffsets: number[][][]): [number, number][][]`
  - `decodeGeometry(feature: GeoJsonFeature): [number, number][][]`
  - `DEFAULT_MAP_CONFIG: MapConfig`
  - `project(lng: number, lat: number, canvasW: number, canvasH: number, cfg?: MapConfig): { x: number; y: number }`

- [ ] **Step 1: Write the failing test file (decode + projection + palette)**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: FAIL — module not found (`../src/china-map-coloring/...`).

- [ ] **Step 3: Write the four source modules**

`src/types.ts`:
```ts
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
```

`src/lib/constants.ts`:
```ts
// src/lib/constants.ts —— 调色板（设计规范 §4.5 逐色一致）
import type { PaletteColor } from '../types';

export const PALETTE: readonly PaletteColor[] = [
  { name: '粉红色', value: '#FFB6C1' },
  { name: '浅绿色', value: '#90EE90' },
  { name: '橙色',   value: '#FFA500' },
  { name: '蓝色',   value: '#87CEEB' },
  { name: '紫色',   value: '#DDA0DD' },
  { name: '黄色',   value: '#FFD700' },
  { name: '红色',   value: '#FF6B6B' },
  { name: '青色',   value: '#40E0D0' },
];
```

`src/lib/decode.ts`:
```ts
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

/**
 * 解码一个 MultiPolygon 的全部多边形。
 * encodeOffsets 与 coordinates 逐多边形对齐：coordinates[p][r] ↔ encodeOffsets[p][r]。
 */
export function decodeCoordinates(
  coordinates: string[][],
  encodeOffsets: number[][][],
): [number, number][][] {
  return coordinates.map((rings, p) =>
    rings.map((ring, r) => {
      const raw = encodeOffsets[p]?.[r] ?? encodeOffsets[p]?.[0] ?? [0, 0];
      const off: [number, number] = Array.isArray(raw[0])
        ? (raw[0] as [number, number])
        : (raw as [number, number]);
      return decodeRing(ring, off);
    }),
  );
}

/** 解码一个 feature 的 geometry（MultiPolygon / Polygon 均处理）。 */
export function decodeGeometry(feature: GeoJsonFeature): [number, number][][] {
  const g = feature.geometry;
  if (g.type === 'Polygon') {
    const rings = g.coordinates as string[];
    const offsets = g.encodeOffsets.map((o) => o[0] as [number, number]);
    return [rings.map((ring, r) => decodeRing(ring, offsets[r] ?? [0, 0]))];
  }
  return decodeCoordinates(g.coordinates as string[][], g.encodeOffsets);
}
```

`src/lib/projection.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: PASS (all 4 describe blocks).

- [ ] **Step 5: Type-check the new code**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/china-map-coloring/src/types.ts packages/react-components/src/china-map-coloring/src/lib/constants.ts packages/react-components/src/china-map-coloring/src/lib/decode.ts packages/react-components/src/china-map-coloring/src/lib/projection.ts packages/react-components/__tests__/china-map-coloring.test.ts
git commit -m "feat(china-map-coloring): add decode, projection and palette core

ECharts @@-encoded GeoJSON decoder + linear projection + spec palette,
with vitest coverage against the real china.json data.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Province building (geojson) + hit test

`buildProvinces` turns decoded geometry into `ProvincePath[]` with one `Path2D` per polygon/ring. `hitTest` maps client coordinates to province names. Both need a `Path2D` stub in tests (node has none).

**Files:**
- Create: `packages/react-components/src/china-map-coloring/src/lib/geojson.ts`
- Create: `packages/react-components/src/china-map-coloring/src/lib/hitTest.ts`
- Test: `packages/react-components/__tests__/china-map-coloring.test.ts` (append)

**Interfaces:**
- Consumes: `GeoJsonFeatureCollection`, `MapConfig`, `ProvincePath`, `project`, `DEFAULT_MAP_CONFIG`, `decodeGeometry`
- Produces:
  - `toShortName(full: string): string`
  - `buildProvinces(fc: GeoJsonFeatureCollection, canvasW: number, canvasH: number, cfg?: MapConfig): ProvincePath[]`
  - `hitTest(provinces: ProvincePath[], ctx: CanvasRenderingContext2D, clientX: number, clientY: number): string | null`

- [ ] **Step 1: Append the failing test**

```ts
// ---- Task 2: geojson + hitTest ----
import { buildProvinces, toShortName } from '../src/china-map-coloring/src/lib/geojson';
import { hitTest } from '../src/china-map-coloring/src/lib/hitTest';
import type { ProvincePath } from '../src/china-map-coloring/src/types';

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
  const mk = (name: string, id: number): ProvincePath => ({
    name,
    displayName: name,
    center: { x: 0, y: 0 },
    centerLngLat: [0, 0],
    paths: [new FakePath2D() as unknown as Path2D],
    bounds: { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 },
  });

  it('picks the later province when two overlap (reverse-order priority)', () => {
    const provinces = [mk('广东', 0), mk('广西', 1)];
    const ctx = {
      canvas: { width: 1200, height: 900, getBoundingClientRect: () => ({ width: 600, height: 450 }) },
      isPointInPath: () => true, // 两个省都命中
    } as unknown as CanvasRenderingContext2D;
    expect(hitTest(provinces, ctx, 100, 100)).toBe('广西');
  });

  it('returns null when nothing is hit', () => {
    const provinces = [mk('广东', 0)];
    const ctx = {
      canvas: { width: 1200, height: 900, getBoundingClientRect: () => ({ width: 600, height: 450 }) },
      isPointInPath: () => false,
    } as unknown as CanvasRenderingContext2D;
    expect(hitTest(provinces, ctx, 100, 100)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: FAIL — module not found (`../src/china-map-coloring/src/lib/geojson`).

- [ ] **Step 3: Write the two source modules**

`src/lib/geojson.ts`:
```ts
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
      const polys = decodeGeometry(f);
      const paths: Path2D[] = [];
      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      for (const ringSet of polys) {
        const path = new Path2D();
        ringSet.forEach(([lng, lat], idx) => {
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
```

`src/lib/hitTest.ts`:
```ts
// src/lib/hitTest.ts —— 点击/悬停命中检测（设计规范 §4.4）
import type { ProvincePath } from '../types';

export function hitTest(
  provinces: ProvincePath[],
  ctx: CanvasRenderingContext2D,
  clientX: number,
  clientY: number,
): string | null {
  const rect = ctx.canvas.getBoundingClientRect();
  const x = clientX * (ctx.canvas.width / rect.width);
  const y = clientY * (ctx.canvas.height / rect.height);
  // 倒序遍历：后绘制的省份优先（岛屿、重叠边界）
  for (let i = provinces.length - 1; i >= 0; i--) {
    const p = provinces[i];
    for (const path of p.paths) {
      if (ctx.isPointInPath(path, x, y)) return p.name;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: PASS (all blocks incl. the Task 1 blocks).

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/china-map-coloring/src/lib/geojson.ts packages/react-components/src/china-map-coloring/src/lib/hitTest.ts packages/react-components/__tests__/china-map-coloring.test.ts
git commit -m "feat(china-map-coloring): build provinces and hit-test

buildProvinces decodes + projects every polygon into a Path2D per ring;
hitTest maps client coords via isPointInPath with reverse-order priority.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Render pipeline

`renderMap` draws the full map in the spec order, color layer under text (order B).

**Files:**
- Create: `packages/react-components/src/china-map-coloring/src/lib/render.ts`
- Test: `packages/react-components/__tests__/china-map-coloring.test.ts` (append)

**Interfaces:**
- Consumes: `ProvincePath`
- Produces:
  - `renderMap(ctx: CanvasRenderingContext2D, provinces: ProvincePath[], colorByProvince: Record<string, string>, hoverName: string | null, debugMode: boolean): void`
  - Side effects only; reads/writes ctx state. Call order: clear+base → white fill → border stroke → **color fill** → text → debug stroke → hover.

- [ ] **Step 1: Append the failing test**

```ts
// ---- Task 3: render ----
import { renderMap } from '../src/china-map-coloring/src/lib/render';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: FAIL — module not found (`../src/china-map-coloring/src/lib/render`).

- [ ] **Step 3: Write the source module**

`src/lib/render.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/china-map-coloring/src/lib/render.ts packages/react-components/__tests__/china-map-coloring.test.ts
git commit -m "feat(china-map-coloring): add render pipeline

Full draw order from spec (order B: color under text), debug stroke and
hover highlight; covered by a recording-ctx order test.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ChinaMap canvas component

React component that loads the GeoJSON, builds provinces, draws to canvas, and handles pointer events + hover bubble + skeleton. No unit test (ve convention: showcase components are manually verified); gated by `tsc` + lint + dev-server check.

**Files:**
- Create: `packages/react-components/src/china-map-coloring/src/ChinaMap.tsx`

**Interfaces:**
- Consumes: `buildProvinces`, `hitTest`, `renderMap`, `ProvincePath`
- Produces:
  - `interface ChinaMapProps { colorByProvince: Record<string, string>; onProvinceClick: (name: string) => void; debugMode: boolean }`
  - `export default function ChinaMap(props: ChinaMapProps): JSX.Element`
  - Internally: fetches `/map/json/china.json` (cache: force-cache), builds provinces once, re-renders on `provinces / colorByProvince / hoverName / debugMode`, handles `pointerdown/move/leave`, renders hover bubble, shows skeleton while loading.

- [ ] **Step 1: Write the component**

```tsx
// src/ChinaMap.tsx —— 画布组件：数据加载、构建、渲染、事件
import { useEffect, useRef, useState } from 'react';
import type { ProvincePath } from './types';
import { buildProvinces } from './lib/geojson';
import { hitTest } from './lib/hitTest';
import { renderMap } from './lib/render';

interface ChinaMapProps {
  colorByProvince: Record<string, string>;
  onProvinceClick: (name: string) => void;
  debugMode: boolean;
}

const CANVAS_W = 1200;
const CANVAS_H = 900;

export default function ChinaMap({ colorByProvince, onProvinceClick, debugMode }: ChinaMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [provinces, setProvinces] = useState<ProvincePath[] | null>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);

  // 一次性加载 + 构建（画布逻辑尺寸固定，resize 由 CSS 缩放处理，无需重绘）
  useEffect(() => {
    let cancelled = false;
    fetch('/map/json/china.json', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((fc) => {
        if (cancelled) return;
        setProvinces(buildProvinces(fc, CANVAS_W, CANVAS_H));
      })
      .catch((err) => console.error('[china-map-coloring] load china.json failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // 依赖变化时重绘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !provinces) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMap(ctx, provinces, colorByProvince, hoverName, debugMode);
  }, [provinces, colorByProvince, hoverName, debugMode]);

  const handlePointer = (clientX: number, clientY: number, click: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || !provinces) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const name = hitTest(provinces, ctx, clientX, clientY);
    if (click) {
      if (name) onProvinceClick(name);
    } else {
      setHoverName(name);
      canvas.style.cursor = name ? 'pointer' : 'default';
    }
  };

  return (
    <div className="sl-cmc-map">
      {!provinces ? <div className="sl-cmc-skeleton" aria-hidden="true" /> : null}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={provinces ? 'sl-cmc-canvas' : 'sl-cmc-canvas sl-cmc-canvas--hidden'}
        role="img"
        aria-label="中国地图"
        onPointerDown={(e) => handlePointer(e.clientX, e.clientY, true)}
        onPointerMove={(e) => handlePointer(e.clientX, e.clientY, false)}
        onPointerLeave={() => {
          setHoverName(null);
          if (canvasRef.current) canvasRef.current.style.cursor = 'default';
        }}
      />
      {hoverName ? <div className="sl-cmc-bubble">{hoverName}</div> : null}
    </div>
  );
}
```

> Pointer events unify mouse + touch (no double-fire on tap); `touch-action: none` in CSS keeps touch-drag from scrolling. Hover bubble is top-left of the map area (spec §6.1 `top-4 left-4`).

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/china-map-coloring/src/ChinaMap.tsx
git commit -m "feat(china-map-coloring): add ChinaMap canvas component

Loads china.json, builds provinces, draws via renderMap, handles pointer
events for coloring + hover, shows a loading skeleton.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Shell — picker, debug panel, styles, entry, config, README

Assembles the component: color picker + debug panel sub-components, `index.css`, `index.tsx` (layout + state), `component.config.ts` (showcase discovery), and `README.md`. This is the final integration task; verified end-to-end.

**Files:**
- Create: `packages/react-components/src/china-map-coloring/src/ColorPicker.tsx`
- Create: `packages/react-components/src/china-map-coloring/src/DebugPanel.tsx`
- Create: `packages/react-components/src/china-map-coloring/index.css`
- Create: `packages/react-components/src/china-map-coloring/index.tsx`
- Create: `packages/react-components/src/china-map-coloring/component.config.ts`
- Create: `packages/react-components/src/china-map-coloring/README.md`

**Interfaces:**
- Consumes: `ChinaMap`, `PALETTE`
- Produces:
  - `ColorPicker({ selectedColor: string, onSelect: (value: string) => void }): JSX.Element` — 8 swatches + "当前选择：{名称}"
  - `DebugPanel({ debugMode: boolean, onToggleDebug: () => void, onReset: () => void }): JSX.Element`
  - `export default function ChinaMapColoring(): JSX.Element` — layout + state (`colorByProvince`, `selectedColor`, `debugMode`, `reset`)
  - `component.config.ts` — id `china-map-coloring`, framework `react`, group 数据可视化 / category 地图

- [ ] **Step 1: Write ColorPicker.tsx**

```tsx
// src/ColorPicker.tsx —— 8 色块调色板（设计规范 §6.2）
import { PALETTE } from './lib/constants';

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (value: string) => void;
}

export default function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const current = PALETTE.find((c) => c.value === selectedColor) ?? PALETTE[0];
  return (
    <div className="sl-cmc-picker">
      <div className="sl-cmc-swatches" role="radiogroup" aria-label="选择颜色">
        {PALETTE.map((c) => {
          const active = c.value === selectedColor;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              className={'sl-cmc-swatch' + (active ? ' is-active' : '')}
              style={{ background: c.value }}
              onClick={() => onSelect(c.value)}
            >
              {active ? <span className="sl-cmc-check">✓</span> : null}
            </button>
          );
        })}
      </div>
      <p className="sl-cmc-selected-text">当前选择：{current.name}</p>
    </div>
  );
}
```

- [ ] **Step 2: Write DebugPanel.tsx**

```tsx
// src/DebugPanel.tsx —— 高级调试开关 + 复位（设计规范 §6.4）
interface DebugPanelProps {
  debugMode: boolean;
  onToggleDebug: () => void;
  onReset: () => void;
}

export default function DebugPanel({ debugMode, onToggleDebug, onReset }: DebugPanelProps) {
  return (
    <div className="sl-cmc-debug">
      <label className="sl-cmc-debug-toggle">
        <input type="checkbox" checked={debugMode} onChange={onToggleDebug} />
        <span>高级调试（显示省份边界）</span>
      </label>
      <button type="button" className="sl-cmc-reset" onClick={onReset}>
        复位
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write index.css**

```css
/* index.css —— china-map-coloring 样式
   类名 sl-cmc-*；壳 UI 走 var(--sl-*, fallback) token；画布内颜色为固定 hex */

.sl-cmc-root {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--sl-color-bg, #f8fafc);
  color: var(--sl-color-text, #1f2328);
  font-family: var(--sl-font-family, system-ui, "PingFang SC", sans-serif);
  font-size: 14px;
}

.sl-cmc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--sl-color-border, #e2e8f0);
}
.sl-cmc-header-icon { color: var(--sl-color-primary, #ec4899); flex: none; }
.sl-cmc-title { margin: 0; font-size: 22px; font-weight: 700; }
.sl-cmc-subtitle { margin: 2px 0 0; font-size: 13px; color: var(--sl-color-text-secondary, #64748b); }

.sl-cmc-main {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  padding: 20px;
  max-width: 1600px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}
@media (max-width: 900px) {
  .sl-cmc-main { grid-template-columns: 1fr; }
}

.sl-cmc-map-card {
  background: var(--sl-color-surface, #ffffff);
  border: 1px solid var(--sl-color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: var(--sl-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
  padding: 20px;
}
.sl-cmc-map-title { font-weight: 600; margin: 0 0 12px; }
.sl-cmc-map-body { position: relative; display: flex; justify-content: center; }

.sl-cmc-map { position: relative; width: 100%; }
.sl-cmc-canvas {
  max-width: 100%;
  height: auto;
  display: block;
  touch-action: none;
}
.sl-cmc-canvas--hidden { visibility: hidden; }

.sl-cmc-skeleton {
  position: absolute;
  inset: 0;
  background: var(--sl-color-surface-alt, #f1f5f9);
  border-radius: 8px;
  animation: sl-cmc-pulse 1.6s ease-in-out infinite;
}
@keyframes sl-cmc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.sl-cmc-bubble {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  border: 1px solid var(--sl-color-border, #e2e8f0);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  z-index: 2;
}

.sl-cmc-side { display: flex; flex-direction: column; gap: 16px; }
.sl-cmc-panel {
  background: var(--sl-color-surface, #ffffff);
  border: 1px solid var(--sl-color-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
}
.sl-cmc-panel-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }

.sl-cmc-swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.sl-cmc-swatch {
  position: relative;
  aspect-ratio: 1;
  border: 2px solid var(--sl-color-border, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sl-cmc-swatch:hover { transform: scale(1.06); }
.sl-cmc-swatch:focus-visible { outline: 2px solid var(--sl-color-primary, #ec4899); outline-offset: 2px; }
.sl-cmc-swatch.is-active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
}
.sl-cmc-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.sl-cmc-selected-text { margin: 12px 0 0; font-size: 13px; color: var(--sl-color-text-secondary, #64748b); }

.sl-cmc-steps { margin: 0; padding-left: 18px; line-height: 1.8; color: var(--sl-color-text-secondary, #64748b); }

.sl-cmc-debug { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sl-cmc-debug-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sl-cmc-reset {
  padding: 8px 14px;
  border: 1px solid var(--sl-color-border, #e2e8f0);
  border-radius: 8px;
  background: var(--sl-color-surface-alt, #f1f5f9);
  color: var(--sl-color-text, #1f2328);
  cursor: pointer;
  font: inherit;
}
.sl-cmc-reset:hover { background: #fee2e2; color: #dc2626; }

.sl-cmc-footer {
  padding: 12px 20px;
  font-size: 12px;
  color: var(--sl-color-text-secondary, #64748b);
  border-top: 1px solid var(--sl-color-border, #e2e8f0);
  text-align: center;
}
```

- [ ] **Step 4: Write index.tsx**

```tsx
// index.tsx —— 中国地图涂色：入口（布局 + 状态）
import { useState } from 'react';
import './index.css';
import ChinaMap from './src/ChinaMap';
import ColorPicker from './src/ColorPicker';
import DebugPanel from './src/DebugPanel';
import { PALETTE } from './src/lib/constants';

export default function ChinaMapColoring() {
  const [colorByProvince, setColorByProvince] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0].value);
  const [debugMode, setDebugMode] = useState(false);

  const handleProvinceClick = (name: string) => {
    setColorByProvince((prev) => ({ ...prev, [name]: selectedColor }));
  };

  const handleReset = () => setColorByProvince({});

  return (
    <div className="sl-cmc-root">
      <header className="sl-cmc-header">
        <svg className="sl-cmc-header-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
          />
        </svg>
        <div>
          <h1 className="sl-cmc-title">中国地图涂色</h1>
          <p className="sl-cmc-subtitle">选择颜色，点击省份为地图上色</p>
        </div>
      </header>
      <main className="sl-cmc-main">
        <section className="sl-cmc-map-card">
          <div className="sl-cmc-map-title">中国地图</div>
          <div className="sl-cmc-map-body">
            <ChinaMap
              colorByProvince={colorByProvince}
              debugMode={debugMode}
              onProvinceClick={handleProvinceClick}
            />
          </div>
        </section>
        <aside className="sl-cmc-side">
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">选择颜色</h2>
            <ColorPicker selectedColor={selectedColor} onSelect={setSelectedColor} />
          </section>
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">怎么玩</h2>
            <ol className="sl-cmc-steps">
              <li>选择一种颜色</li>
              <li>点击地图上的省份涂色</li>
              <li>重复操作，给整个地图上色</li>
            </ol>
          </section>
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">高级</h2>
            <DebugPanel
              debugMode={debugMode}
              onToggleDebug={() => setDebugMode((v) => !v)}
              onReset={handleReset}
            />
          </section>
        </aside>
      </main>
      <footer className="sl-cmc-footer">Canvas + GeoJSON · china-map-coloring</footer>
    </div>
  );
}
```

- [ ] **Step 5: Write component.config.ts**

```ts
// component.config.ts —— china-map-coloring 组件元数据
// 遵循 packages/component-contract 的 ComponentConfig 规范;id 必须与目录名一致。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'china-map-coloring',
  name: 'ChinaMapColoring',
  title: '中国地图涂色',
  description: '点击省份为地图上色:8 色调色板、hover 高亮、高级调试,canvas 手绘 GeoJSON。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '地图',
  tags: ['canvas', 'map', 'china', 'coloring', 'geojson', 'interactive'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/china-map-coloring', title: '中国地图涂色' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
```

- [ ] **Step 6: Write README.md**

```markdown
# ChinaMapColoring — 中国地图涂色

基于 Canvas 2D + GeoJSON 的省份涂色组件。点击省份用当前选中颜色上色，支持 hover 高亮、8 色调色板、高级调试（边界描边）与复位。

## 数据

复用 showcase 已有的 `/map/json/china.json`（ECharts `@@` 压缩编码，34 个省级 feature），组件内 `decode.ts` 解码后投影渲染。边界数据为演示用途，商用请按国家审图标准确认数据合规。

## 实现要点

- 画布逻辑 1200×900，CSS 等比缩放；渲染管线顺序见 `src/lib/render.ts`。
- **有意差异**：涂色层垫在省名之下（可读性更好），与原型（涂色盖住省名）不同。
- 命中检测 `ctx.isPointInPath` + 倒序遍历（岛屿/重叠优先高纬）。
- 触摸/鼠标统一走 Pointer Events；画布 `touch-action: none` 防滚动干扰。

## 测试

`packages/react-components/__tests__/china-map-coloring.test.ts`：解码/投影/短名/构建/命中/渲染顺序（纯函数，注入 Path2D 桩）。
```

- [ ] **Step 7: Type-check + lint**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: no errors.

Run: `pnpm exec eslint packages/react-components/src/china-map-coloring/ packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: 0 errors / 0 warnings (must include `style-library/valid-component-config` passing on the config).

- [ ] **Step 8: Run the full test suite**

Run: `pnpm exec vitest run packages/react-components/__tests__/china-map-coloring.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify showcase discovery (dev server)**

Run (background): `pnpm --filter @style-library/showcase dev`
Then: `curl -s http://localhost:5173/__component-manifest.json | grep china-map-coloring`
Expected: an entry with `"id":"china-map-coloring"`.

Manually open `http://localhost:5173/components/china-map-coloring` and verify: map renders, clicking a province fills it with the selected color, hover highlights + shows a bubble, debug toggle draws red borders, reset clears all colors. Also test the `.sl-cmc-*` classes are styled inside the ShadowRoot.

- [ ] **Step 10: Production build**

Run: `pnpm --filter @style-library/showcase build`
Expected: build succeeds; `ls apps/showcase/dist/assets/ | grep china-map-coloring` shows a `rc-china-map-coloring-*.js` chunk.

- [ ] **Step 11: Commit**

```bash
git add packages/react-components/src/china-map-coloring/
git commit -m "feat(china-map-coloring): assemble component shell

Color picker, debug panel, styles, entry with layout + state, component
config and README. Verified via tsc, eslint, vitest, dev-server discovery
and production build.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage**: §4.1/4.2/4.3/4.4/4.5 → Tasks 1–3; §6.1 → Task 4; §6.2/6.3/6.4/§7/§8 → Task 5; §10 acceptance → Task 5 steps 9–10; data/license note → README (Task 5 step 6).
- **Order B** (color under text) enforced in Task 3 test.
- **Decode shape**: verified empirically — `encodeOffsets[p][0]` is the `[x,y]` pair for polygon `p` (per-polygon alignment), all 34 features have `cp`, names already short.
- **Path2D stub** set at test-module scope (before `it` blocks run); `buildProvinces`/`hitTest`/`render` only touch `Path2D`/ctx at call time, so the stub suffices without jsdom.
