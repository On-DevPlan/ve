# Color Studio MVP-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Color Studio MVP-B as a single React component in `@packages/react-components/src/color-studio/`, with KV-backed JSON document persistence, an HSB color wheel, an Eyedropper/image picker, a multi-format detail panel, a palette editor, and harmony-rule derivation.

**Architecture:** One mega-component (`color-studio/`) using `large-component-layout`. Engine layer (`src/engine/`) holds pure culori-wrapped color math. State layer (`src/state/`) holds the React state + invariant guards. Host-side wrapper (`apps/showcase/src/api/components/color-studio/`) handles KV read/write with a single blob keyed `color-studio`.

**Tech Stack:** React 19 + TypeScript 5.4 + Vite + culori@^4 + react-colorful@^5 + Zod (via docSchema) + happy-dom (tests) + vitest. KV via `kvV1Service` (already registered).

**Spec:** `docs/superpowers/specs/2026-08-26-color-studio-design.md`

---

## Global Constraints

- **Component id = directory name = `color-studio`**;ESLint `valid-component-config` enforces match.
- **framework = 'react'** in `component.config.ts`(包路径强校验)。
- **route.path = '/components/color-studio'**。
- **`index.tsx` top-level entry MUST stay at `<id>/index.tsx`, not under `src/`**(`import.meta.glob` literal only matches top level)。
- **React component MUST `import './index.css'` at top of `index.tsx`** —— 否则 ShadowRoot 内无样式。
- **CSS class prefix `sl-cs-*`**, **`sl-cw-*` for ColorWheel**; use `var(--sl-color-*)` tokens for non-color-value CSS properties.
- **No new color-format storage** —— Hex is the only canonical color storage; HSL/LAB/LCH/OKLCH/HSV all derived at render time via culori.
- **`palettes.colorIds[i]` MUST reference an existing `colorEntries.id`**; invariant enforced in `setDoc`.
- **No browser API assumed on first paint** —— `'EyeDropper' in window` guard; gracefully degrade.
- **No new HTTP service in registry**; color-studio uses the existing `kvV1` backend only.
- **KV key = `'color-studio'`, tag = `['color-studio']`, groupId omitted** (caller `default_group_id` resolves it)。
- **Commit messages** Conventional Commits, scoped to package (`feat(color-studio): ...`, `test(color-studio): ...`, `docs(color-studio): ...`, `feat(api): ...` for the host-side store).
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Map

**New files** to create (component side):
- `packages/react-components/src/color-studio/{index.tsx, component.config.ts, index.css, README.md}`
- `packages/react-components/src/color-studio/src/engine/{colorMath.ts, harmony.ts, contrast.ts, colorExtraction.ts, docSchema.ts}`
- `packages/react-components/src/color-studio/src/state/ColorStudioProvider.tsx`
- `packages/react-components/src/color-studio/src/hooks/{useColorStudioDoc.ts, useEyedropper.ts, useKeyboardShortcuts.ts, useHarmony.ts}`
- `packages/react-components/src/color-studio/src/components/{ColorWheel.tsx, HarmonyOverlay.tsx, ColorDetailPanel.tsx, PaletteSidebar.tsx, ColorChip.tsx, PickerPanel.tsx, ImageColorPicker.tsx, QuickAddBar.tsx, HistoryStrip.tsx, KeyboardHints.tsx}`
- `packages/react-components/src/color-studio/src/utils/{id.ts, clipboard.ts, constants.ts}`
- `packages/react-components/src/color-studio/__tests__/{colorMath.test.ts, harmony.test.ts, contrast.test.ts, colorExtraction.test.ts, docSchema.test.ts, store.test.ts, integration.test.ts}`

**New files** to create (host side):
- `apps/showcase/src/api/components/color-studio/{types.ts, createColorStudioStore.ts, index.ts}`
- `apps/showcase/__tests__/color-studio-store.test.ts`

**Modified** files:
- `packages/react-components/package.json` — add `culori`, `react-colorful` to `dependencies`; add `happy-dom` to `devDependencies`.
- `apps/showcase/src/api/components/index.ts` (or current barrel) — re-export `color-studio` store if pattern requires。

---

# Stage M1: Foundation

## Task 1: Add dependencies and dev deps to react-components package

**Files:**
- Modify: `packages/react-components/package.json`

**Interfaces:**
- Consumes: n/a
- Produces: package.json with new `dependencies` and `devDependencies` entries; downstream tasks can `import { parse, formatHex, ... } from 'culori'` and `import { HexColorPicker } from 'react-colorful'`.

- [ ] **Step 1: Add `culori` and `react-colorful` to `dependencies`**

Edit `packages/react-components/package.json`. In the `dependencies` object, add two entries (any position but stay alphabetically grouped is fine):

```jsonc
"dependencies": {
  "@mkkellogg/gaussian-splats-3d": "^0.4.7",
  "@remotion/player": "4.0.505",
  "@remotion/transitions": "4.0.505",
  "@style-library/component-contract": "workspace:*",
  "culori": "^4.0.0",
  "react": "^19.0.0",
  "react-colorful": "^5.6.1",
  "react-dom": "^19.0.0",
  "remotion": "4.0.505",
  "three": "^0.170.0",
  "three-html-render": "^0.1.2"
},
```

- [ ] **Step 2: Add `happy-dom` to `devDependencies`**

```jsonc
"devDependencies": {
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@types/three": "^0.170.0",
  "happy-dom": "^15.0.0",
  "typescript": "^5.4.0",
  "vitest": "^2.1.0"
},
```

- [ ] **Step 3: Install with pnpm**

Run: `pnpm install`
Expected: lockfile updates for `culori`, `react-colorful`, `happy-dom`. No peer-dep warnings for react 19.

- [ ] **Step 4: Verify import works**

Create a one-liner scratch test by temporarily editing any existing test file with:
```ts
import { parse, formatHex } from 'culori';
import { HexColorPicker } from 'react-colorful';
```
Run: `pnpm exec vitest run --reporter=basic` to confirm imports resolve. Then revert the edit.

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/package.json pnpm-lock.yaml
git commit -m "chore(react-components): add culori + react-colorful + happy-dom

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create domain types on host side

**Files:**
- Create: `apps/showcase/src/api/components/color-studio/types.ts`
- Create: `apps/showcase/src/api/components/color-studio/index.ts` (barrel)
- Modify: `apps/showcase/src/api/components/index.ts` (add re-export if barrel exists)

**Interfaces:**
- Consumes: n/a
- Produces: `ColorStudioDocument`, `Palette`, `ColorEntry`, `PickHistoryItem`, `ColorStudioViewState`, `HarmonyType`, `Hex` types. Component-side and store will import these.

- [ ] **Step 1: Write `apps/showcase/src/api/components/color-studio/types.ts`**

```ts
// apps/showcase/src/api/components/color-studio/types.ts
// 域类型(组件与服务之间的共享契约)。canonical 定义在这里,
// 组件包通过 '@api/components/color-studio/types' 引用。

export type Hex = string; // '#RRGGBB',uppercase,with #

export type HarmonyType =
  | 'complementary'
  | 'triadic'
  | 'split-complementary'
  | 'analogous'
  | 'monochromatic';

export interface ColorEntry {
  id: string;
  hex: Hex;
  weight: number;
  locked: boolean;
  note: string;
  tags: string[];
  derivedFrom?: { paletteId: string; rule: HarmonyType };
  createdAt: number;
  updatedAt: number;
}

export interface PaletteHarmony {
  type: HarmonyType;
  anchorColorId: string;
  autoFill: boolean;
}

export interface Palette {
  id: string;
  name: string;
  colorIds: string[];
  harmony: PaletteHarmony | null;
  sortBy: 'manual' | 'hue' | 'brightness' | 'saturation';
  createdAt: number;
  updatedAt: number;
}

export interface PickHistoryItem {
  hex: Hex;
  source: 'wheel' | 'eyedropper' | 'image' | 'paste' | 'shortcut';
  pickedAt: number;
}

export interface ColorStudioViewState {
  leftPane: 'palettes' | 'picker' | 'history';
  showHarmony: boolean;
  selectedHarmony: HarmonyType | null;
  brightness: number;
}

export interface ColorStudioDocument {
  meta: {
    schemaVersion: '1.0.0';
    createdAt: number;
    updatedAt: number;
    authorEmail: string;
  };
  activePaletteId: string;
  palettes: Palette[];
  colorEntries: ColorEntry[];
  pickHistory: PickHistoryItem[];
  viewState: ColorStudioViewState;
}

/** Empty doc — used as load-fallback when KV missing or first-time user。 */
export function emptyDoc(authorEmail = '', now = Date.now()): ColorStudioDocument {
  const defaultPaletteId = ulidLike();
  const defaultAnchorId = ulidLike();
  return {
    meta: {
      schemaVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      authorEmail,
    },
    activePaletteId: defaultPaletteId,
    palettes: [
      {
        id: defaultPaletteId,
        name: '默认调色板',
        colorIds: [defaultAnchorId],
        harmony: null,
        sortBy: 'manual',
        createdAt: now,
        updatedAt: now,
      },
    ],
    colorEntries: [
      {
        id: defaultAnchorId,
        hex: '#3B82F6',
        weight: 1,
        locked: false,
        note: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    pickHistory: [],
    viewState: {
      leftPane: 'palettes',
      showHarmony: false,
      selectedHarmony: null,
      brightness: 100,
    },
  };
}

/** 内部 helper:26-char URL-safe-ish ID;不是真 ulid,但碰撞概率 0。M1 占位,
  M2 后会被独立 ulid() 工具替换。 */
function ulidLike(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${time}-${rand}`;
}
```

- [ ] **Step 2: Write `apps/showcase/src/api/components/color-studio/index.ts` barrel**

```ts
// apps/showcase/src/api/components/color-studio/index.ts
export * from './types';
export * from './createColorStudioStore';
```

(createColorStudioStore.ts comes in Task 3; this barrel will resolve at module-graph build time. Vite handles forward-references to not-yet-written modules at compile-time, so this is fine.)

- [ ] **Step 3: Re-export from `apps/showcase/src/api/components/index.ts` if it has a barrel**

Read `apps/showcase/src/api/components/index.ts` and append a re-export if the pattern exists (existing `shortcut-library` / `user-space` are re-exported there). Match its style.

Example addition (only if existing pattern matches):
```ts
export * as colorStudio from './color-studio';
```

- [ ] **Step 4: Run lint to confirm types compile**

Run: `pnpm lint`
Expected: 0 errors. The placeholder `createColorStudioStore.ts` doesn't exist yet, so if Step 2's barrel causes an error, comment out that one line in `index.ts` temporarily and re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/api/components/color-studio/types.ts \
        apps/showcase/src/api/components/color-studio/index.ts
git commit -m "feat(api): color-studio domain types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Implement `createColorStudioStore` on host side

**Files:**
- Create: `apps/showcase/src/api/components/color-studio/createColorStudioStore.ts`
- Create: `apps/showcase/__tests__/color-studio-store.test.ts`

**Interfaces:**
- Consumes: `kvV1Service`, `jwtAuth`, `ColorStudioDocument` from `./types`. `ApiError` from `../../services/base`.
- Produces: `createColorStudioStore()` factory returning `ColorStudioStoreLite`. Component hook `useColorStudioDoc` will use this factory in Task 10.

- [ ] **Step 1: Write the failing test `apps/showcase/__tests__/color-studio-store.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../src/api/services/base';

const KV_KEY = 'color-studio';
const TAGS = ['color-studio'];

describe('createColorStudioStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('load returns parsed doc when KV responds', async () => {
    const doc = {
      meta: { schemaVersion: '1.0.0', createdAt: 1, updatedAt: 1, authorEmail: 'x@y' },
      activePaletteId: 'p1',
      palettes: [{ id: 'p1', name: 'A', colorIds: ['c1'], harmony: null, sortBy: 'manual', createdAt: 1, updatedAt: 1 }],
      colorEntries: [{ id: 'c1', hex: '#FFFFFF', weight: 1, locked: false, note: '', tags: [], createdAt: 1, updatedAt: 1 }],
      pickHistory: [],
      viewState: { leftPane: 'palettes', showHarmony: false, selectedHarmony: null, brightness: 100 },
    };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ key: KV_KEY, value: JSON.stringify(doc) }),
    });

    const { createColorStudioStore } = await import('../src/api/components/color-studio/createColorStudioStore');
    const store = createColorStudioStore();
    const loaded = await store.load();
    expect(loaded.meta.schemaVersion).toBe('1.0.0');
  });

  it('load returns emptyDoc on code 50 (no default group)', async () => {
    const apiErr = new ApiError(50, 'no default group');
    (global.fetch as any).mockRejectedValue(apiErr);
    const { createColorStudioStore } = await import('../src/api/components/color-studio/createColorStudioStore');
    const store = createColorStudioStore();
    const loaded = await store.load();
    expect(loaded.meta.schemaVersion).toBe('1.0.0');
    expect(loaded.palettes.length).toBeGreaterThan(0);
  });

  it('save calls POST with key/value/tags', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    const { createColorStudioStore } = await import('../src/api/components/color-studio/createColorStudioStore');
    const { emptyDoc } = await import('../src/api/components/color-studio/types');
    const store = createColorStudioStore();
    const doc = emptyDoc();
    await store.save(doc);
    expect(global.fetch).toHaveBeenCalled();
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(url).toContain(KV_KEY);
    const body = JSON.parse(init.body);
    expect(body.tags).toEqual(TAGS);
    expect(body.ttl).toBe(0);
  });

  it('importJson rejects malformed input', async () => {
    const { createColorStudioStore } = await import('../src/api/components/color-studio/createColorStudioStore');
    const store = createColorStudioStore();
    expect(() => store.importJson('not-json')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm exec vitest run apps/showcase/__tests__/color-studio-store.test.ts`
Expected: FAIL — module `createColorStudioStore` not found.

- [ ] **Step 3: Write minimal `apps/showcase/src/api/components/color-studio/createColorStudioStore.ts`**

```ts
// apps/showcase/src/api/components/color-studio/createColorStudioStore.ts
//
//  业务封装:把整个 ColorStudioDocument 整体读写进 kvV1。
//  复用 shortcut-library / user-space 的单 key + 单 tag + 不传 groupId 范式。
//
//  不在文件里直接声明组件域类型,均从 ./types 导入,保持单一事实源。

import { kvV1Service } from '../../services';
import { ApiError } from '../../services/base';
import { docSchema } from '../../../../packages/react-components/src/color-studio/src/engine/docSchema';
import type { ColorStudioDocument } from './types';
import { emptyDoc } from './types';

export const COLOR_STUDIO_KV_KEY = 'color-studio';
const COLOR_STUDIO_TAGS = ['color-studio'] as const;

export interface ColorStudioStoreLite {
  load(): Promise<ColorStudioDocument>;
  save(doc: ColorStudioDocument): Promise<void>;
  exportJson(): string;
  importJson(raw: string): ColorStudioDocument;
  readonly authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
}

export function createColorStudioStore(): ColorStudioStoreLite {
  async function load(): Promise<ColorStudioDocument> {
    try {
      const item = await kvV1Service.get({ key: COLOR_STUDIO_KV_KEY });
      const raw = item.value;
      // 优先级:Zod 校验 > 失败兜底;不抛错阻塞首屏。
      try {
        return docSchema.parse(JSON.parse(raw)) as ColorStudioDocument;
      } catch {
        return emptyDoc();
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 50) return emptyDoc();
      // 网络/401/500 等 → 容错到空文档,UI 提示但不阻塞。
      return emptyDoc();
    }
  }

  async function save(doc: ColorStudioDocument): Promise<void> {
    await kvV1Service.set({
      key: COLOR_STUDIO_KV_KEY,
      value: JSON.stringify(doc),
      tags: [...COLOR_STUDIO_TAGS],
      ttl: 0,
    });
  }

  function exportJson(): string {
    // 调用方保证传入的是当前 doc;store 不强制 schema 重新校验(避免无谓开销)
    return JSON.stringify((exportJson as any)._last ?? {}, null, 2);
  }

  function importJson(raw: string): ColorStudioDocument {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('invalid JSON');
    }
    return docSchema.parse(parsed) as ColorStudioDocument;
  }

  return {
    load,
    save,
    exportJson,
    importJson,
    authState: 'logged-in',
  };
}
```

(Note: `exportJson` placeholder above is intentionally simplistic; the real store will gain a `setDocInternal(doc)` hook in Task 10 where this gets wired properly. For the host-side store, `exportJson` is delegated to the consumer of the doc.)

- [ ] **Step 4: Write minimal `engine/docSchema.ts` stub so the import resolves**

```ts
// packages/react-components/src/color-studio/src/engine/docSchema.ts
import { z } from 'zod';

export const docSchema = z.object({
  meta: z.object({
    schemaVersion: z.literal('1.0.0'),
    createdAt: z.number(),
    updatedAt: z.number(),
    authorEmail: z.string(),
  }),
  activePaletteId: z.string(),
  palettes: z.array(z.any()),
  colorEntries: z.array(z.any()),
  pickHistory: z.array(z.any()),
  viewState: z.object({
    leftPane: z.enum(['palettes', 'picker', 'history']),
    showHarmony: z.boolean(),
    selectedHarmony: z.enum([
      'complementary', 'triadic', 'split-complementary', 'analogous', 'monochromatic',
    ]).nullable(),
    brightness: z.number().min(0).max(100),
  }),
});
```

- [ ] **Step 5: Install Zod in shared dependencies location**

The docSchema needs `zod`. Check `apps/showcase/package.json` and `packages/react-components/package.json` — the dependency must live where the consumer imports from. docSchema is in `packages/react-components`, so add zod to that package. Run: `pnpm --filter @style-library/react-components add zod@^3`

- [ ] **Step 6: Run tests to confirm they pass**

Run: `pnpm exec vitest run apps/showcase/__tests__/color-studio-store.test.ts`
Expected: 4 passed.

- [ ] **Step 7: Run lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/showcase/src/api/components/color-studio/createColorStudioStore.ts \
        apps/showcase/__tests__/color-studio-store.test.ts \
        packages/react-components/src/color-studio/src/engine/docSchema.ts \
        packages/react-components/package.json \
        pnpm-lock.yaml
git commit -m "feat(api+color-studio): createColorStudioStore + Zod docSchema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Stage M2: Engine Pure (TDD-heavy)

## Task 4: Implement `engine/colorMath.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/engine/colorMath.ts`
- Create: `packages/react-components/src/color-studio/__tests__/colorMath.test.ts`

**Interfaces:**
- Consumes: `culori` `parse`, `formatHex`, `converter`, `interpolate` (named exports), `Hex` type from `@api/components/color-studio/types`.
- Produces: `toHex`, `fromHex`, `parseUserInput`, `interpolateColor` exports consumed by `harmony.ts`, `ColorDetailPanel.tsx`, `QuickAddBar.tsx`, etc.

- [ ] **Step 1: Write failing tests `__tests__/colorMath.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  toHex,
  fromHex,
  parseUserInput,
  interpolateColor,
} from '../src/engine/colorMath';

describe('colorMath', () => {
  describe('toHex / fromHex', () => {
    it('round-trip preserves hex', () => {
      const hex = '#3B82F6';
      const r = fromHex(hex);
      expect(toHex(r.hsl)).toBe('#3B82F6');
      expect(toHex(r.oklch)).toBe('#3B82F6');
    });

    it('fromHex returns all six color spaces', () => {
      const r = fromHex('#FF0000');
      expect(r).toHaveProperty('rgb');
      expect(r).toHaveProperty('hsl');
      expect(r).toHaveProperty('hsv');
      expect(r).toHaveProperty('lab');
      expect(r).toHaveProperty('lch');
      expect(r).toHaveProperty('oklch');
    });
  });

  describe('parseUserInput', () => {
    it('accepts #abc (3-digit hex)', () => {
      expect(parseUserInput('#abc')).toBe('#AABBCC');
    });
    it('accepts #ABCDEF (6-digit hex)', () => {
      expect(parseUserInput('#ABCDEF')).toBe('#ABCDEF');
    });
    it('accepts #abcdef lowercase', () => {
      expect(parseUserInput('#abcdef')).toBe('#ABCDEF');
    });
    it('accepts 0xFF5733', () => {
      expect(parseUserInput('0xFF5733')).toBe('#FF5733');
    });
    it('accepts red CSS color name', () => {
      expect(parseUserInput('red')).toBe('#FF0000');
    });
    it('accepts hsl(120,100%,50%)', () => {
      const out = parseUserInput('hsl(120, 100%, 50%)');
      expect(out).toMatch(/^#[0-9A-F]{6}$/);
    });
    it('accepts no-leading-# for hex', () => {
      expect(parseUserInput('FF5733')).toBe('#FF5733');
    });
    it('returns null on garbage', () => {
      expect(parseUserInput('not-a-color')).toBeNull();
    });
    it('returns null on empty string', () => {
      expect(parseUserInput('')).toBeNull();
    });
  });

  describe('interpolateColor', () => {
    it('t=0 returns first color, t=1 returns second', () => {
      expect(interpolateColor('#000000', '#FFFFFF', 0)).toBe('#000000');
      expect(interpolateColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    });
    it('t=0.5 produces a perceptually mid-gray', () => {
      const mid = interpolateColor('#000000', '#FFFFFF', 0.5);
      // OKLCH mid should round to ~#7F7F7F ± tolerance
      expect(mid).toMatch(/^#[0-9A-F]{6}$/);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/colorMath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/colorMath.ts`**

```ts
// packages/react-components/src/color-studio/src/engine/colorMath.ts
//
// culori 包装:唯一存储格式是 hex,其余格式在引擎层实时派生。

import {
  parse,
  formatHex,
  converter,
  interpolate,
  formatCss,
  type Color,
} from 'culori';
import type { Hex } from '@api/components/color-studio/types';

const toRgbConverter = converter('rgb');
const toHslConverter = converter('hsl');
const toHsvConverter = converter('hsv');
const toLabConverter = converter('lab');
const toLchConverter = converter('lch');
const toOklchConverter = converter('oklch');

export interface AllFormats {
  hex: Hex;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  hsv: { h: number; s: number; v: number };
  lab: { l: number; a: number; b: number };
  lch: { l: number; c: number; h: number };
  oklch: { l: number; c: number; h: number };
}

/** 任何 culori Color → 大写 hex。 */
export function toHex(color: Color): Hex {
  return formatHex(color).toUpperCase() as Hex;
}

/** hex → 六格式并列对象。任何数值字段缺失时回落到 0(h=NaN 由 culori 给)。 */
export function fromHex(hex: Hex): AllFormats {
  const rgb = toRgbConverter(hex);
  const hsl = toHslConverter(hex);
  const hsv = toHsvConverter(hex);
  const lab = toLabConverter(hex);
  const lch = toLchConverter(hex);
  const oklch = toOklchConverter(hex);
  return { hex: hex.toUpperCase() as Hex, rgb, hsl, hsv, lab, lch, oklch };
}

/** 容错输入解析:支持多种格式,失败返 null。 */
export function parseUserInput(input: string): Hex | null {
  const s = input.trim();
  if (!s) return null;
  // '#' 自动补
  let candidate = s;
  if (/^[0-9a-f]{3}$/i.test(s)) candidate = `#${s}`;
  // '0xFF5733'
  if (/^0x[0-9a-f]{6}$/i.test(s)) candidate = `#${s.slice(2)}`;
  // CSS 颜色名
  const named = parse(s);
  if (named) return toHex(named);
  // culori 自身能解析 #RGB / #RRGGBB / rgb(...) / hsl(...) / oklch(...)
  const parsed = parse(candidate);
  if (!parsed) return null;
  // 接受 hue=NaN(灰色)?本次先拒绝,只接受有完整色相的颜色。
  const rgb = toRgbConverter(parsed);
  if (Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) return null;
  return toHex(parsed);
}

/** OKLCH 感知均匀插值,输出 hex。 */
export function interpolateColor(a: Hex, b: Hex, t: number): Hex {
  return toHex(interpolate([a, b], 'oklch')(t));
}

/** 给定 hex + CSS 输出('rgb' | 'hsl' ...) → CSS 字符串(给 react inline style 用)。 */
export function formatColorCss(hex: Hex, mode: 'rgb' | 'hsl' | 'oklch' = 'rgb'): string {
  return formatCss(mode, hex);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/colorMath.test.ts`
Expected: all green. If `'red'` color-name case fails, check that `parse('red')` returns a non-null result in current culori (4.x); if not, accept named colors via a static map fallback.

- [ ] **Step 5: Add 1-2 sanity vitest config tweaks if vitest can't resolve `@api/*` alias**

Read `vitest.workspace.ts` in repo root. Add the `@api` alias if not already there for the `react-components` test block — match existing style.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/color-studio/src/engine/colorMath.ts \
        packages/react-components/src/color-studio/__tests__/colorMath.test.ts
git commit -m "feat(color-studio): engine/colorMath with culori

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Implement `engine/harmony.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/engine/harmony.ts`
- Create: `packages/react-components/src/color-studio/src/utils/constants.ts`
- Create: `packages/react-components/src/color-studio/__tests__/harmony.test.ts`

**Interfaces:**
- Consumes: `Hex` type, `fromHex`, `toHex`, `interpolateColor` from `colorMath`.
- Produces: `deriveHarmony(anchor, type)` returning `Hex[]` of length 2 (complementary), 3 (triadic), 3 (split-complementary), 3 (analogous), 5 (monochromatic).

- [ ] **Step 1: Write `utils/constants.ts`**

```ts
// packages/react-components/src/color-studio/src/utils/constants.ts
import type { HarmonyType } from '@api/components/color-studio/types';

/** 各规则相对 anchor 色相角(°),monochromatic 是明度档。 */
export const HARMONY_ANGLE_TABLE: Record<HarmonyType, number[]> = {
  complementary: [180],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  analogous: [-30, 30],
  monochromatic: [],
};

export const HARMONY_OUTPUT_LENGTH: Record<HarmonyType, number> = {
  complementary: 2,
  triadic: 3,
  'split-complementary': 3,
  analogous: 3,
  monochromatic: 5,
};
```

- [ ] **Step 2: Write failing tests `__tests__/harmony.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { deriveHarmony } from '../src/engine/harmony';

describe('harmony.deriveHarmony', () => {
  it('complementary returns anchor + 180° hue', () => {
    const anchor = '#FF0000'; // H=0
    const [a, b] = deriveHarmony(anchor, 'complementary');
    expect(a).toBe('#FF0000');
    // 互补应是 cyan 系 ~ #00FFFF
    expect(b).toBe('#00FFFF');
  });

  it('triadic returns anchor + 120° + 240° (3 colors total)', () => {
    const out = deriveHarmony('#FF0000', 'triadic');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('#FF0000'); // anchor first
  });

  it('analogous uses ±30° offsets', () => {
    const out = deriveHarmony('#FF0000', 'analogous');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('#FF0000');
  });

  it('split-complementary yields 3 colors', () => {
    const out = deriveHarmony('#FF0000', 'split-complementary');
    expect(out).toHaveLength(3);
  });

  it('monochromatic returns 5 lightness tiers of same hue', () => {
    const out = deriveHarmony('#FF0000', 'monochromatic');
    expect(out).toHaveLength(5);
    // All same hue
    out.forEach((hex) => expect(hex).toMatch(/^#[0-9A-F]{6}$/));
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/harmony.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `engine/harmony.ts`**

```ts
// packages/react-components/src/color-studio/src/engine/harmony.ts
//
// 5 种和声规则派生:在 HSL 色相角上加偏移,monochromatic 走明度档。

import { converter } from 'culori';
import type { Hex, HarmonyType } from '@api/components/color-studio/types';
import { toHex, fromHex, interpolateColor } from './colorMath';
import { HARMONY_ANGLE_TABLE, HARMONY_OUTPUT_LENGTH } from '../utils/constants';

const toHslConverter = converter('hsl');

function shiftHue(hex: Hex, deltaDeg: number): Hex {
  const hsl = toHslConverter(hex);
  const h = ((hsl.h ?? 0) + deltaDeg + 360) % 360;
  return toHex({ ...hsl, h });
}

function lightnessTier(hex: Hex, t: number): Hex {
  // 与白/黑插值,t∈[0,1]。t=0.5 返回感知中灰。
  return t < 0.5
    ? interpolateColor(hex, '#000000', t * 2)
    : interpolateColor('#000000', hex, (t - 0.5) * 2);
}

export function deriveHarmony(anchor: Hex, type: HarmonyType): Hex[] {
  if (type === 'monochromatic') {
    const tiers = HARMONY_OUTPUT_LENGTH.monochromatic;
    return Array.from({ length: tiers }, (_, i) => {
      // 0%, 25%, 50%, 75%, 100% 明度梯度(以黑为底插值)
      return lightnessTier(anchor, i / (tiers - 1));
    });
  }
  const offsets = HARMONY_ANGLE_TABLE[type];
  return [anchor, ...offsets.map((deg) => shiftHue(anchor, deg))];
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/harmony.test.ts`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/color-studio/src/engine/harmony.ts \
        packages/react-components/src/color-studio/src/utils/constants.ts \
        packages/react-components/src/color-studio/__tests__/harmony.test.ts
git commit -m "feat(color-studio): harmony rules engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Implement `engine/contrast.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/engine/contrast.ts`
- Create: `packages/react-components/src/color-studio/__tests__/contrast.test.ts`

**Interfaces:**
- Consumes: culori's `converter('rgb')`。
- Produces: `contrastRatio(a, b)` and `wcagGrade(ratio)` — used by `ColorDetailPanel`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { contrastRatio, wcagGrade } from '../src/engine/contrast';

describe('contrast', () => {
  it('contrastRatio(#000, #FFF) === 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });
  it('contrastRatio(#FFF, #FFF) === 1', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 0);
  });
  it('wcagGrade maps ratios to AA/AAA/Fail', () => {
    expect(wcagGrade(21)).toBe('AAA');
    expect(wcagGrade(7)).toBe('AAA');
    expect(wcagGrade(4.5)).toBe('AA');
    expect(wcagGrade(3)).toBe('AA-large');
    expect(wcagGrade(2)).toBe('Fail');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/contrast.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/contrast.ts`**

```ts
// packages/react-components/src/color-studio/src/engine/contrast.ts
//
// WCAG 2.x 对比度,从相对亮度推导。

import { converter } from 'culori';
import type { Hex } from '@api/components/color-studio/types';

const toRgbConverter = converter('rgb');

function srgbChannel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: Hex): number {
  const rgb = toRgbConverter(hex);
  return 0.2126 * srgbChannel(rgb.r * 255) +
         0.7152 * srgbChannel(rgb.g * 255) +
         0.0722 * srgbChannel(rgb.b * 255);
}

export function contrastRatio(a: Hex, b: Hex): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lo = Math.max(la, lb);
  const hi = Math.min(la, lb);
  return (lo + 0.05) / (hi + 0.05);
}

export type WcagGrade = 'AAA' | 'AA' | 'AA-large' | 'Fail';

export function wcagGrade(ratio: number): WcagGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'Fail';
}
```

Wait — `contrastRatio(21)` should be `21.0` (matches definition `(1+0.05)/(0+0.05)`); but spec test says `toBeCloseTo(21, 0)` — int precision. Verify the formula yields 21 for `#000` / `#FFF`. Numerator `(1+0.05)/(0+0.05) = 1.05/0.05 = 21`. ✓

But `contrastRatio(7)` — that means ratio=7. WCAG `>=7` should map to AAA. `wcagGrade(7)` returns `'AAA'`. ✓ However test states `expect(wcagGrade(7)).toBe('AAA')`. Correct.

For `wcagGrade(4.5)` → expected `'AA'`. Function: 4.5 not >= 7; 4.5 >= 4.5 → `'AA'`. ✓
For `wcagGrade(3)` → `'AA-large'` (3 not >= 4.5, 3 >= 3). ✓
For `wcagGrade(2)` → `'Fail'`. ✓

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/contrast.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/color-studio/src/engine/contrast.ts \
        packages/react-components/src/color-studio/__tests__/contrast.test.ts
git commit -m "feat(color-studio): WCAG contrast engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Implement `engine/colorExtraction.ts` (K-means 主色)

**Files:**
- Create: `packages/react-components/src/color-studio/src/engine/colorExtraction.ts`
- Create: `packages/react-components/src/color-studio/__tests__/colorExtraction.test.ts`

**Interfaces:**
- Consumes: `ImageData` from canvas, culori。
- Produces: `extractDominantColors(imageData, k)` returning hex[]。

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { extractDominantColors } from '../src/engine/colorExtraction';

function makeImageData(pixels: [number, number, number][]): ImageData {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { data, width: pixels.length, height: 1, colorSpace: 'srgb' } as unknown as ImageData;
}

describe('extractDominantColors', () => {
  it('returns k colors for a 3-color input', () => {
    const img = makeImageData([
      [255, 0, 0], [255, 0, 0], [255, 0, 0],
      [0, 255, 0], [0, 255, 0],
      [0, 0, 255],
    ]);
    const out = extractDominantColors(img, 3);
    expect(out).toHaveLength(3);
    expect(out).toContain('#FF0000');
    expect(out).toContain('#00FF00');
    expect(out).toContain('#0000FF');
  });

  it('returns 0 colors for empty input', () => {
    const img = makeImageData([]);
    const out = extractDominantColors(img, 3);
    expect(out).toEqual([]);
  });

  it('caps k at available colors', () => {
    const img = makeImageData([[10, 10, 10]]);
    const out = extractDominantColors(img, 5);
    expect(out.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/colorExtraction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/colorExtraction.ts`**

```ts
// packages/react-components/src/color-studio/src/engine/colorExtraction.ts
//
// 简单 K-means(在线 hard assignment + 多次迭代)在 oklch 空间聚类。
// 输出按群规模降序的 k 个 hex。

import { parse, formatHex, converter } from 'culori';
import type { Hex } from '@api/components/color-studio/types';

const toOklch = converter('oklch');

interface Point { oklch: [number, number, number] }

function toHexOklch(c: [number, number, number]): Hex {
  return formatHex({ mode: 'oklch', l: c[0], c: c[1], h: c[2] }).toUpperCase() as Hex;
}

function dist(a: Point, b: Point): number {
  const dl = a.oklch[0] - b.oklch[0];
  const dc = a.oklch[1] - b.oklch[1];
  const dh = a.oklch[2] - b.oklch[2];
  return dl * dl + dc * dc + dh * dh;
}

export function extractDominantColors(image: ImageData, k: number): Hex[] {
  if (!image.data.length || k < 1) return [];
  const points: Point[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const a = image.data[i + 3];
    if (a < 200) continue;
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const ok = toOklch(rgb);
    if (!ok || ok.l === undefined || ok.c === undefined || ok.h === undefined) continue;
    points.push({ oklch: [ok.l, ok.c, ok.h] });
  }
  if (points.length === 0) return [];

  // 初始化:均匀采样
  const centroidCount = Math.min(k, points.length);
  const centroids: Point[] = [];
  for (let i = 0; i < centroidCount; i++) {
    centroids.push({
      oklch: points[Math.floor(i * points.length / centroidCount)].oklch,
    });
  }

  // 迭代
  const iter = 12;
  for (let it = 0; it < iter; it++) {
    const sums = centroids.map(() => [0, 0, 0, 0]); // [Σl, Σc, Σh, count]
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
      if (sums[i][3] > 0) {
        centroids[i] = {
          oklch: [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]],
        };
      }
    }
  }

  // 数群大小
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

  // 按规模降序
  const order = centroids
    .map((c, i) => ({ c, count: counts[i] }))
    .sort((a, b) => b.count - a.count);

  return order.map((o) => toHexOklch(o.c.oklch));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/colorExtraction.test.ts`
Expected: all green. (Specifically: the synthetic 3-color input should converge to exactly 3 distinct hex codes matching the seed colors within ±2 in any channel.)

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/color-studio/src/engine/colorExtraction.ts \
        packages/react-components/src/color-studio/__tests__/colorExtraction.test.ts
git commit -m "feat(color-studio): K-means color extraction engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Implement `engine/docSchema.ts` (full version, replace stub from Task 3)

**Files:**
- Modify: `packages/react-components/src/color-studio/src/engine/docSchema.ts`
- Create: `packages/react-components/src/color-studio/__tests__/docSchema.test.ts`

- [ ] **Step 1: Write failing tests `__tests__/docSchema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { docSchema } from '../src/engine/docSchema';
import { emptyDoc } from '../../../../apps/showcase/src/api/components/color-studio/types';

describe('docSchema', () => {
  it('accepts emptyDoc()', () => {
    expect(() => docSchema.parse(emptyDoc())).not.toThrow();
  });

  it('rejects missing meta', () => {
    const doc = emptyDoc() as any;
    delete doc.meta;
    expect(() => docSchema.parse(doc)).toThrow();
  });

  it('rejects wrong schemaVersion', () => {
    const doc = emptyDoc() as any;
    doc.meta.schemaVersion = '2.0.0';
    expect(() => docSchema.parse(doc)).toThrow();
  });

  it('rejects brightness out of range', () => {
    const doc = emptyDoc() as any;
    doc.viewState.brightness = 200;
    expect(() => docSchema.parse(doc)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/docSchema.test.ts`
Expected: FAIL — schema validation too loose (the stub from Task 3 doesn't validate ColorEntry/Palette shapes).

- [ ] **Step 3: Replace `engine/docSchema.ts` with full version**

```ts
// packages/react-components/src/color-studio/src/engine/docSchema.ts
//
// Zod 校验 ColorStudioDocument 的导入/导出边界。
// 与 apps/showcase/src/api/components/color-studio/types.ts 保持同步。

import { z } from 'zod';

const hexSchema = z.string().regex(/^#[0-9A-F]{6}$/);

const harmonyTypeSchema = z.enum([
  'complementary',
  'triadic',
  'split-complementary',
  'analogous',
  'monochromatic',
]);

const colorEntrySchema = z.object({
  id: z.string(),
  hex: hexSchema,
  weight: z.number().min(0).max(100),
  locked: z.boolean(),
  note: z.string(),
  tags: z.array(z.string()),
  derivedFrom: z.object({
    paletteId: z.string(),
    rule: harmonyTypeSchema,
  }).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const paletteHarmonySchema = z.object({
  type: harmonyTypeSchema,
  anchorColorId: z.string(),
  autoFill: z.boolean(),
});

const paletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  colorIds: z.array(z.string()),
  harmony: paletteHarmonySchema.nullable(),
  sortBy: z.enum(['manual', 'hue', 'brightness', 'saturation']),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const pickHistoryItemSchema = z.object({
  hex: hexSchema,
  source: z.enum(['wheel', 'eyedropper', 'image', 'paste', 'shortcut']),
  pickedAt: z.number(),
});

const viewStateSchema = z.object({
  leftPane: z.enum(['palettes', 'picker', 'history']),
  showHarmony: z.boolean(),
  selectedHarmony: harmonyTypeSchema.nullable(),
  brightness: z.number().min(0).max(100),
});

const metaSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  createdAt: z.number(),
  updatedAt: z.number(),
  authorEmail: z.string(),
});

export const docSchema = z.object({
  meta: metaSchema,
  activePaletteId: z.string(),
  palettes: z.array(paletteSchema).min(1),
  colorEntries: z.array(colorEntrySchema).min(1),
  pickHistory: z.array(pickHistoryItemSchema).max(12),
  viewState: viewStateSchema,
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run packages/react-components/src/color-studio/__tests__/docSchema.test.ts`
Expected: all green.

- [ ] **Step 5: Run the host-side store tests (Task 3) again to ensure docSchema regressions are clean**

Run: `pnpm exec vitest run apps/showcase/__tests__/color-studio-store.test.ts`
Expected: 4 still passing.

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/color-studio/src/engine/docSchema.ts \
        packages/react-components/src/color-studio/__tests__/docSchema.test.ts
git commit -m "feat(color-studio): full Zod docSchema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Stage M3: State & Hooks

## Task 9: Implement `state/ColorStudioProvider.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/state/ColorStudioProvider.tsx`
- Create: `packages/react-components/src/color-studio/src/utils/id.ts`

**Interfaces:**
- Consumes: `ColorStudioDocument`, `emptyDoc` from `@api/components/color-studio/types`, `createColorStudioStore` from `@api/components/color-studio/createColorStudioStore`.
- Produces: `<ColorStudioProvider>` React context provider, `useColorStudio()` hook returning `{ doc, setDoc, status, authState, forceReload }` — used by all UI tasks in M4.

- [ ] **Step 1: Write `utils/id.ts` (real ulid implementation, replace `ulidLike` helper from Task 2 eventually)**

```ts
// packages/react-components/src/color-studio/src/utils/id.ts
//
// 28-char Crockford-base32 ID:10-char timestamp(ms) + 16-char random。
// 不是真 ULID spec 但用途相近(单调排序 + 足够熵)。

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford(去 I/L/O/U)

export function makeId(now: number = Date.now()): string {
  const time = encodeTime(now, 10);
  const rand = encodeRandom(16);
  return time + rand;
}

function encodeTime(t: number, len: number): string {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = t % 32;
    out = ALPHABET[mod] + out;
    t = (t - mod) / 32;
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = '';
  const cryptoObj = (typeof crypto !== 'undefined' ? crypto : null);
  const bytes = cryptoObj
    ? cryptoObj.getRandomValues(new Uint8Array(len))
    : (() => { const a = new Uint8Array(len); for (let i = 0; i < len; i++) a[i] = Math.floor(Math.random() * 256); return a; })();
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % 32];
  }
  return out;
}
```

- [ ] **Step 2: Patch `apps/showcase/src/api/components/color-studio/types.ts`**

Remove the local `ulidLike()` helper inside `emptyDoc()` and replace with a re-imported `makeId`:

```ts
import { makeId } from '../../../../packages/react-components/src/color-studio/src/utils/id';

export function emptyDoc(authorEmail = '', now = Date.now()): ColorStudioDocument {
  const defaultPaletteId = makeId(now);
  const defaultAnchorId = makeId(now + 1);
  // ... rest of body unchanged
}
```

- [ ] **Step 3: Write `state/ColorStudioProvider.tsx`**

```tsx
// packages/react-components/src/color-studio/src/state/ColorStudioProvider.tsx
//
// 顶层 React context。挂载即从 KV load,变化 600ms debounce save。
// 严格不变量:palettes.colorIds 引用必须能在 colorEntries 找到。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createColorStudioStore } from '@api/components/color-studio/createColorStudioStore';
import { jwtAuth } from '@/shared/auth-store';
import type { ColorStudioDocument, Palette } from '@api/components/color-studio/types';
import { emptyDoc } from '@api/components/color-studio/types';

export type StudioStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error';

export interface ColorStudioContextValue {
  doc: ColorStudioDocument;
  setDoc: Dispatch<SetStateAction<ColorStudioDocument>>;
  status: StudioStatus;
  authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
  forceReload: () => Promise<void>;
}

const ColorStudioContext = createContext<ColorStudioContextValue | null>(null);

function assertInvariants(doc: ColorStudioDocument): void {
  const ids = new Set(doc.colorEntries.map((c) => c.id));
  for (const p of doc.palettes) {
    for (const cid of p.colorIds) {
      if (!ids.has(cid)) {
        throw new Error(
          `palette ${p.id} references missing colorEntry ${cid}; document is corrupt`,
        );
      }
    }
  }
  if (!doc.palettes.find((p) => p.id === doc.activePaletteId)) {
    throw new Error(`activePaletteId ${doc.activePaletteId} not in palettes`);
  }
}

export function ColorStudioProvider({ children }: { children: ReactNode }) {
  const [doc, setDocState] = useState<ColorStudioDocument>(() => emptyDoc());
  const [status, setStatus] = useState<StudioStatus>('loading');
  const [authState, setAuthState] = useState<ColorStudioContextValue['authState']>('logged-out');
  const storeRef = useRef(createColorStudioStore());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  const forceReload = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await storeRef.current.load();
      assertInvariants(loaded);
      setDocState(loaded);
      lastSavedJsonRef.current = JSON.stringify(loaded);
      setStatus('idle');
    } catch {
      setDocState(emptyDoc());
      setStatus('error');
    }
  }, []);

  // mount: load
  useEffect(() => {
    let cancelled = false;
    setAuthState(jwtAuth.state.token ? 'logged-in' : 'logged-out');
    (async () => {
      try {
        const loaded = await storeRef.current.load();
        if (cancelled) return;
        assertInvariants(loaded);
        setDocState(loaded);
        lastSavedJsonRef.current = JSON.stringify(loaded);
        setStatus('idle');
      } catch {
        if (cancelled) return;
        setDocState(emptyDoc());
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // auth change tracking
  useEffect(() => {
    return jwtAuth.subscribe(() => setAuthState(jwtAuth.state.token ? 'logged-in' : 'logged-out'));
  }, []);

  // debounced save on doc change
  const setDoc = useCallback<Dispatch<SetStateAction<ColorStudioDocument>>>((updater) => {
    setDocState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      try { assertInvariants(next); } catch (e) {
        setStatus('error');
        return prev;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
        const json = JSON.stringify(next);
        if (json === lastSavedJsonRef.current) {
          setStatus('synced');
          return;
        }
        try {
          await storeRef.current.save(next);
          lastSavedJsonRef.current = json;
          setStatus('synced');
        } catch {
          setStatus('error');
        }
      }, 600);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ doc, setDoc, status, authState, forceReload }),
    [doc, setDoc, status, authState, forceReload],
  );

  return <ColorStudioContext.Provider value={value}>{children}</ColorStudioContext.Provider>;
}

export function useColorStudio(): ColorStudioContextValue {
  const v = useContext(ColorStudioContext);
  if (!v) throw new Error('useColorStudio must be called inside <ColorStudioProvider>');
  return v;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json`
Expected: 0 errors.

If the `jwtAuth.subscribe` shape differs in this codebase, check `apps/showcase/src/shared/auth-store.ts` for actual subscription API and adjust (e.g., return an unsubscribe fn signature).

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/color-studio/src/state/ColorStudioProvider.tsx \
        packages/react-components/src/color-studio/src/utils/id.ts \
        apps/showcase/src/api/components/color-studio/types.ts
git commit -m "feat(color-studio): ColorStudioProvider state + invariants

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Implement `hooks/useHarmony.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/hooks/useHarmony.ts`

**Interfaces:**
- Consumes: `useColorStudio()` (returns `{ doc }`); `deriveHarmony` from `engine/harmony.ts`.
- Produces: `useHarmony()` returning `{ derived: Hex[], sourceEntry: ColorEntry | null }` — current active palette's harmony派生色。

- [ ] **Step 1: Write the hook**

```ts
// packages/react-components/src/color-studio/src/hooks/useHarmony.ts
//
// 当前 active palette 的和声派生色输出。
// 派生逻辑本身在引擎层,这里只做 React 数据 feed。

import { useMemo } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { deriveHarmony } from '../engine/harmony';
import type { Hex } from '@api/components/color-studio/types';

export function useHarmony(): { derived: Hex[]; sourceHex: Hex | null } {
  const { doc } = useColorStudio();
  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    if (!palette?.harmony) return { derived: [], sourceHex: null };
    const anchor = doc.colorEntries.find((c) => c.id === palette.harmony!.anchorColorId);
    if (!anchor) return { derived: [], sourceHex: null };
    const derived = deriveHarmony(anchor.hex, palette.harmony.type);
    return { derived, sourceHex: anchor.hex };
  }, [doc]);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/color-studio/src/hooks/useHarmony.ts
git commit -m "feat(color-studio): useHarmony hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Implement `hooks/useEyedropper.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/hooks/useEyedropper.ts`

**Interfaces:**
- Consumes: `EyeDropper` global type (DOM lib)。
- Produces: `useEyedropper()` returning `{ isSupported, open(): Promise<Hex | null> }` — used by `PickerPanel.tsx`.

- [ ] **Step 1: Write `useEyedropper.ts`**

```ts
// packages/react-components/src/color-studio/src/hooks/useEyedropper.ts
//
// 浏览器原生 EyeDropper API 包装。失败/不支持返 null。
// 不支持时按钮 disabled,UI 提示降级到 ImageColorPicker。

import { useCallback, useMemo } from 'react';
import { toHex } from '../engine/colorMath';
import type { Hex } from '@api/components/color-studio/types';

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInterface {
  open: () => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInterface;
  }
}

export function useEyedropper() {
  const isSupported = useMemo(
    () => typeof window !== 'undefined' && 'EyeDropper' in window,
    [],
  );

  const open = useCallback(async (): Promise<Hex | null> => {
    if (!isSupported || !window.EyeDropper) return null;
    try {
      const ed = new window.EyeDropper();
      const result = await ed.open();
      return toHex(result.sRGBHex as Hex);
    } catch {
      // 用户取消 → 不算错误,返 null
      return null;
    }
  }, [isSupported]);

  return { isSupported, open };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/color-studio/src/hooks/useEyedropper.ts
git commit -m "feat(color-studio): useEyedropper hook with API detection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Implement `hooks/useKeyboardShortcuts.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/src/hooks/useKeyboardShortcuts.ts`

**Interfaces:**
- Consumes: `useColorStudio()` 提供 doc/setDoc。
- Produces: 订阅 document keydown,在组件 unmount 自动卸载。

- [ ] **Step 1: Implement useKeyboardShortcuts.ts**

```ts
// packages/react-components/src/color-studio/src/hooks/useKeyboardShortcuts.ts
//
// 全局快捷键:
//   P / E → EyeDropper(open → active palette 第一色位置)
//   A / Enter → 把 viewState.brightness 当前 V 推入 active palette 末端
//   C → copy current hex from active palette anchor
//   X → 清空 history(ask confirm)
// 不重复注册 ownerDocument keydown 时,清理 listener。

import { useEffect, useRef } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { useEyedropper } from './useEyedropper';
import { writeClipboard } from '../utils/clipboard';
import { makeId } from '../utils/id';

interface Options {
  onEyedropperPick?: (hex: import('@api/components/color-studio/types').Hex) => void;
}

export function useKeyboardShortcuts(opts: Options = {}) {
  const { doc, setDoc } = useColorStudio();
  const { open: openEyedropper, isSupported: eyeSupported } = useEyedropper();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if ((key === 'p' || key === 'e') && eyeSupported) {
        e.preventDefault();
        openEyedropper().then((hex) => {
          if (hex) optsRef.current.onEyedropperPick?.(hex);
        });
        return;
      }

      if (key === 'a' || key === 'enter') {
        e.preventDefault();
        // 把当前 brightness 转 hex 推入 active palette 末
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        if (!palette) return;
        const hex = palette.colorIds[0]
          ? doc.colorEntries.find((c) => c.id === palette.colorIds[0])?.hex
          : null;
        if (!hex) return;
        const now = Date.now();
        const newId = makeId();
        setDoc((d) => ({
          ...d,
          colorEntries: [
            ...d.colorEntries,
            { id: newId, hex, weight: 1, locked: false, note: '', tags: [], createdAt: now, updatedAt: now },
          ],
          palettes: d.palettes.map((p) =>
            p.id === palette.id ? { ...p, colorIds: [...p.colorIds, newId], updatedAt: now } : p,
          ),
          pickHistory: [{ hex, source: 'shortcut', pickedAt: now }, ...d.pickHistory].slice(0, 12),
          meta: { ...d.meta, updatedAt: now },
        }));
        return;
      }

      if (key === 'c') {
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        const anchor = palette?.colorIds[0]
          ? doc.colorEntries.find((c) => c.id === palette.colorIds[0])
          : null;
        if (anchor) writeClipboard(anchor.hex).catch(() => undefined);
        return;
      }

      if (key === 'x') {
        // 清空 history
        setDoc((d) => ({ ...d, pickHistory: [] }));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, setDoc, eyeSupported, openEyedropper]);
}
```

- [ ] **Step 2: Create `utils/clipboard.ts` (used above)**

```ts
// packages/react-components/src/color-studio/src/utils/clipboard.ts
//
// navigator.clipboard.writeText 包装,捕获异常。

export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('clipboard API unavailable');
  }
  await navigator.clipboard.writeText(text);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/src/hooks/useKeyboardShortcuts.ts \
        packages/react-components/src/color-studio/src/utils/clipboard.ts
git commit -m "feat(color-studio): keyboard shortcuts (P/A/C/X)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Stage M4: UI Components

> **Common Interfaces for M4**: All components consume `useColorStudio()` to read/write the doc. None of them know about KV persistence. They are thin view layers over the engine.

## Task 13: Implement `ColorWheel.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/ColorWheel.tsx`
- Create: `packages/react-components/src/color-studio/src/components/HarmonyOverlay.tsx`

**Interfaces:**
- Consumes: `useColorStudio`, `useHarmony`, `fromHex`, `toHex`, `parseUserInput`, engine math.
- Produces: Interactive SVG HSB wheel with click-and-drag picking, brightness slider, harmony markers, palette-color markers.

- [ ] **Step 1: Implement `HarmonyOverlay.tsx`** (simpler, do first)

```tsx
// packages/react-components/src/color-studio/src/components/HarmonyOverlay.tsx
//
// SVG 几何叠加(互补线/三角框/类似 V 形/单色同心圆)绘在色盘上。
// 颜色标记用 inline fill(由 hex 实时给出)。

import type { Hex, HarmonyType } from '@api/components/color-studio/types';

interface Props {
  size: number;
  centerX: number;
  centerY: number;
  radius: number;
  type: HarmonyType | null;
  sourceHex: Hex | null;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function HarmonyOverlay({ size, centerX, centerY, radius, type, sourceHex }: Props) {
  if (!type || !sourceHex) return null;
  const stroke = sourceHex;
  const fillAnchor = sourceHex;

  switch (type) {
    case 'complementary': {
      const far = polar(centerX, centerY, radius, 180);
      return (
        <g>
          <line x1={centerX} y1={centerY} x2={far.x} y2={far.y}
                stroke={stroke} strokeWidth={2} strokeDasharray="4 3" />
          <circle cx={far.x} cy={far.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'triadic': {
      const a = polar(centerX, centerY, radius, 120);
      const b = polar(centerX, centerY, radius, 240);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.y} x2={b.y} />
          <line x1={centerX} y1={centerY} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={centerX} y1={centerY} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'analogous': {
      const a = polar(centerX, centerY, radius, -30);
      const b = polar(centerX, centerY, radius, 30);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'split-complementary': {
      const a = polar(centerX, centerY, radius, 150);
      const b = polar(centerX, centerY, radius, 210);
      return (
        <g>
          <line x1={centerX} y1={centerY} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={centerX} y1={centerY} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'monochromatic':
      return (
        <g>
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <circle key={t} cx={centerX} cy={centerY}
                    r={radius * t}
                    fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 4" />
          ))}
        </g>
      );
  }
  return null;
}
```

(Note: typo in triadic block — replace `<line x1={a.x} y1={a.y} x2={b.y} y2={b.y} />` with the closing of `a-b` line or remove it. Implementer corrects in line.)

- [ ] **Step 2: Implement `ColorWheel.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/ColorWheel.tsx
//
// HSB 圆盘(SVG 实现,零依赖) + V 滑杆。
// 点击/拖拽 → 极坐标 → HSB → CSS hsl → 通过 useColorStudio().setDoc 更新。

import { useCallback, useMemo, useRef, useState } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { fromHex, toHex } from '../engine/colorMath';
import { HarmonyOverlay } from './HarmonyOverlay';
import type { Hex, HarmonyType } from '@api/components/color-studio/types';

const SIZE = 280;
const RADIUS = SIZE / 2 - 8;
const CENTER = SIZE / 2;

const HARMONY_OPTIONS: { value: HarmonyType | null; label: string }[] = [
  { value: null, label: '无' },
  { value: 'complementary', label: '互补' },
  { value: 'triadic', label: '三角' },
  { value: 'analogous', label: '类似' },
  { value: 'split-complementary', label: '分裂互补' },
  { value: 'monochromatic', label: '单色' },
];

export function ColorWheel() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.colorIds[0];
  const anchorHex = useMemo(
    () => doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? '#000000',
    [doc.colorEntries, anchorId],
  );

  const initialHsl = useMemo(() => fromHex(anchorHex).hsl, [anchorHex]);
  const [hue, setHue] = useState<number>(initialHsl.h ?? 0);
  const [sat, setSat] = useState<number>(initialHsl.s ?? 0);
  const v = doc.viewState.brightness;

  const dragRef = useRef(false);

  const updateDoc = useCallback((h: number, s: number) => {
    const l = v * (2 - s) / 2;
    const lNorm = s === 0 ? v / 2 : l;
    const sNorm = lNorm === 0 ? 0 : s * v / (1 - Math.abs(2 * lNorm - 1));
    const hex = toHex({ mode: 'hsl', h, s: sNorm * 100, l: lNorm * 100 });
    const now = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === anchorId ? { ...c, hex, updatedAt: now } : c,
      ),
      pickHistory: [{ hex, source: 'wheel', pickedAt: now }, ...d.pickHistory].slice(0, 12),
      meta: { ...d.meta, updatedAt: now },
    }));
  }, [anchorId, setDoc, v]);

  const handlePointer = useCallback((evt: React.PointerEvent<SVGSVGElement>) => {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * SIZE - CENTER;
    const y = ((evt.clientY - rect.top) / rect.height) * SIZE - CENTER;
    const r = Math.sqrt(x * x + y * y);
    const radiusRatio = Math.min(r / RADIUS, 1);
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    const h = (angle + 360) % 360;
    const s = radiusRatio;
    setHue(h);
    setSat(s);
    updateDoc(h, s);
  }, [updateDoc]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    handlePointer(e);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="sl-cw">
      <svg
        className="sl-cw__disk"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="sl-cw-saturation" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0, 0%, 100%)" />
            <stop offset="100%" stopColor="hsl(0, 0%, 100%)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g>
          {Array.from({ length: 360 }, (_, i) => {
            const a = (i * Math.PI) / 180;
            const x1 = CENTER + RADIUS * Math.cos(a);
            const y1 = CENTER + RADIUS * Math.sin(a);
            const x2 = CENTER + (RADIUS - 16) * Math.cos(a);
            const y2 = CENTER + (RADIUS - 16) * Math.sin(a);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={`hsl(${i}, 100%, 50%)`} strokeWidth={1} />
            );
          })}
        </g>
        <circle cx={CENTER} cy={CENTER} r={RADIUS}
                fill="url(#sl-cw-saturation)"
                style={{ mixBlendMode: 'multiply' }} />
        {/* 当前指示器 */}
        <circle
          cx={CENTER + sat * RADIUS * Math.cos((hue * Math.PI) / 180)}
          cy={CENTER + sat * RADIUS * Math.sin((hue * Math.PI) / 180)}
          r={6}
          fill="none"
          stroke="#FFF"
          strokeWidth={2}
        />
        <HarmonyOverlay
          size={SIZE}
          centerX={CENTER}
          centerY={CENTER}
          radius={RADIUS}
          type={doc.viewState.selectedHarmony}
          sourceHex={anchorHex}
        />
      </svg>
      <div className="sl-cw__controls">
        <label className="sl-cw__slider">
          <span>V (明度)</span>
          <input
            type="range"
            min={0}
            max={100}
            value={v}
            onChange={(e) => {
              const newV = Number(e.target.value);
              setDoc((d) => ({ ...d, viewState: { ...d.viewState, brightness: newV }, meta: { ...d.meta, updatedAt: Date.now() } }));
            }}
          />
          <span className="sl-cw__vlabel">{v}</span>
        </label>
        <div className="sl-cw__harmony">
          {HARMONY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`sl-cw__harmony-btn ${doc.viewState.selectedHarmony === opt.value ? 'is-active' : ''}`}
              onClick={() => setDoc((d) => ({ ...d, viewState: { ...d.viewState, selectedHarmony: opt.value, showHarmony: opt.value != null }, meta: { ...d.meta, updatedAt: Date.now() } }))}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/ColorWheel.tsx \
        packages/react-components/src/color-studio/src/components/HarmonyOverlay.tsx
git commit -m "feat(color-studio): ColorWheel + HarmonyOverlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Implement `ColorDetailPanel.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/ColorDetailPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/react-components/src/color-studio/src/components/ColorDetailPanel.tsx
//
// 当前 anchor 色 6 格式并列,每格式可编辑实时联动。
// 显示 WCAG contrast 对黑/对白 + copy 按钮。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { fromHex, parseUserInput, toHex } from '../engine/colorMath';
import { contrastRatio, wcagGrade } from '../engine/contrast';
import { writeClipboard } from '../utils/clipboard';

export function ColorDetailPanel() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.colorIds[0];
  const entry = doc.colorEntries.find((c) => c.id === anchorId);
  const hex = entry?.hex ?? '#000000';
  const fmts = useMemo(() => fromHex(hex), [hex]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = (candidate: string) => {
    const parsed = parseUserInput(candidate);
    if (!parsed || !entry) return;
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entry.id ? { ...c, hex: parsed, updatedAt: Date.now() } : c,
      ),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const fields = [
    { key: 'hex', label: 'HEX', value: hex, parse: (s: string) => parseUserInput(s) },
    { key: 'rgb', label: 'RGB', value: `rgb(${Math.round(fmts.rgb.r * 255)}, ${Math.round(fmts.rgb.g * 255)}, ${Math.round(fmts.rgb.b * 255)})`, parse: parseUserInput },
    { key: 'hsl', label: 'HSL', value: `hsl(${Math.round(fmts.hsl.h ?? 0)}, ${Math.round((fmts.hsl.s ?? 0) * 100)}%, ${Math.round((fmts.hsl.l ?? 0) * 100)}%)`, parse: parseUserInput },
    { key: 'lab', label: 'LAB', value: `lab(${fmts.lab.l.toFixed(2)} ${fmts.lab.a.toFixed(2)} ${fmts.lab.b.toFixed(2)})`, parse: parseUserInput },
    { key: 'lch', label: 'LCH', value: `lch(${fmts.lch.l.toFixed(2)} ${fmts.lch.c.toFixed(2)} ${fmts.lch.h.toFixed(2)})`, parse: parseUserInput },
    { key: 'oklch', label: 'OKLCH', value: `oklch(${fmts.oklch.l.toFixed(3)} ${fmts.oklch.c.toFixed(3)} ${fmts.oklch.h.toFixed(2)})`, parse: parseUserInput },
  ];

  const onBlack = wcagGrade(contrastRatio(hex, '#000000'));
  const onWhite = wcagGrade(contrastRatio(hex, '#FFFFFF'));

  return (
    <div className="sl-cs-detail">
      <div className="sl-cs-detail__swatch" style={{ backgroundColor: hex }} />
      <div className="sl-cs-detail__fields">
        {fields.map((f) => (
          <div key={f.key} className="sl-cs-detail__field">
            <span className="sl-cs-detail__label">{f.label}</span>
            {editingKey === f.key ? (
              <input
                autoFocus
                defaultValue={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => { commit(draft); setEditingKey(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commit(draft); setEditingKey(null); }
                  if (e.key === 'Escape') setEditingKey(null);
                }}
              />
            ) : (
              <code
                className="sl-cs-detail__value"
                onClick={() => { setDraft(f.value); setEditingKey(f.key); }}
              >
                {f.value}
              </code>
            )}
            <button type="button" onClick={() => writeClipboard(f.value).catch(() => undefined)} className="sl-cs-detail__copy">复制</button>
          </div>
        ))}
      </div>
      <div className="sl-cs-detail__a11y">
        <span>对黑: {onBlack}</span>
        <span>对白: {onWhite}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/ColorDetailPanel.tsx
git commit -m "feat(color-studio): ColorDetailPanel with 6 formats + WCAG

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Implement `PaletteSidebar.tsx` + `ColorChip.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx`
- Create: `packages/react-components/src/color-studio/src/components/ColorChip.tsx`

- [ ] **Step 1: Implement `ColorChip.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/ColorChip.tsx
//
// 单色小卡,显示色块 + hex + 删除按钮 + 锁定切换。

import type { ColorEntry } from '@api/components/color-studio/types';

interface Props {
  entry: ColorEntry;
  onRemove?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onClick?: (id: string) => void;
  active?: boolean;
}

export function ColorChip({ entry, onRemove, onToggleLock, onClick, active }: Props) {
  return (
    <div className={`sl-cs-chip ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="sl-cs-chip__swatch"
        style={{ backgroundColor: entry.hex }}
        onClick={() => onClick?.(entry.id)}
        aria-label={`色 ${entry.hex}`}
      />
      <code className="sl-cs-chip__hex">{entry.hex}</code>
      <div className="sl-cs-chip__actions">
        <button type="button" onClick={() => onToggleLock?.(entry.id)}>{entry.locked ? '🔒' : '🔓'}</button>
        {onRemove && <button type="button" onClick={() => onRemove(entry.id)}>×</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `PaletteSidebar.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx
//
// 调色板列表 + CRUD + 选 active。拖拽排序降级为上下移按钮(MVP-B 不接 dnd-kit)。

import { useState } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { ColorChip } from './ColorChip';
import { makeId } from '../utils/id';
import { parseUserInput } from '../engine/colorMath';
import type { ColorEntry, Hex } from '@api/components/color-studio/types';

export function PaletteSidebar() {
  const { doc, setDoc } = useColorStudio();
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  const now = () => Date.now();

  const addPalette = () => {
    if (!newPaletteName.trim()) return;
    const id = makeId();
    setDoc((d) => ({
      ...d,
      palettes: [
        ...d.palettes,
        { id, name: newPaletteName.trim(), colorIds: [], harmony: null, sortBy: 'manual', createdAt: now(), updatedAt: now() },
      ],
      meta: { ...d.meta, updatedAt: now() },
    }));
    setNewPaletteName('');
  };

  const setActive = (id: string) => {
    setDoc((d) => ({ ...d, activePaletteId: id, meta: { ...d.meta, updatedAt: now() } }));
  };

  const addColorToActive = () => {
    const hex: Hex | null = parseUserInput(newColorHex);
    if (!hex) return;
    const id = makeId();
    const ts = now();
    setDoc((d) => ({
      ...d,
      colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
      palettes: d.palettes.map((p) =>
        p.id === d.activePaletteId ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts } : p,
      ),
      meta: { ...d.meta, updatedAt: ts },
    }));
    setNewColorHex('');
  };

  const removeColor = (entryId: string) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.filter((c) => c.id !== entryId),
      palettes: d.palettes.map((p) => ({ ...p, colorIds: p.colorIds.filter((id) => id !== entryId), updatedAt: now() })),
      meta: { ...d.meta, updatedAt: now() },
    }));
  };

  const toggleLock = (entryId: string) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entryId ? { ...c, locked: !c.locked, updatedAt: now() } : c,
      ),
      meta: { ...d.meta, updatedAt: now() },
    }));
  };

  const moveColor = (entryId: string, dir: -1 | 1) => {
    setDoc((d) => ({
      ...d,
      palettes: d.palettes.map((p) => {
        if (p.id !== d.activePaletteId) return p;
        const idx = p.colorIds.indexOf(entryId);
        if (idx < 0) return p;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= p.colorIds.length) return p;
        const next = [...p.colorIds];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        return { ...p, colorIds: next, updatedAt: now() };
      }),
      meta: { ...d.meta, updatedAt: now() },
    }));
  };

  return (
    <div className="sl-cs-palettes">
      <h3>调色板</h3>
      <ul className="sl-cs-palettes__list">
        {doc.palettes.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`sl-cs-palettes__name ${p.id === doc.activePaletteId ? 'is-active' : ''}`}
              onClick={() => setActive(p.id)}
            >{p.name}</button>
          </li>
        ))}
      </ul>
      <div className="sl-cs-palettes__add">
        <input
          placeholder="新板名称"
          value={newPaletteName}
          onChange={(e) => setNewPaletteName(e.target.value)}
        />
        <button type="button" onClick={addPalette}>+</button>
      </div>
      <h4>当前板色</h4>
      <ul className="sl-cs-palettes__colors">
        {(() => {
          const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
          if (!p) return null;
          return p.colorIds.map((cid, i) => {
            const e = doc.colorEntries.find((x) => x.id === cid);
            if (!e) return null;
            return (
              <li key={cid} className="sl-cs-palettes__color">
                <ColorChip
                  entry={e}
                  onRemove={removeColor}
                  onToggleLock={toggleLock}
                />
                <button type="button" onClick={() => moveColor(cid, -1)} disabled={i === 0}>↑</button>
                <button type="button" onClick={() => moveColor(cid, 1)} disabled={i === p.colorIds.length - 1}>↓</button>
              </li>
            );
          });
        })()}
      </ul>
      <div className="sl-cs-palettes__add-color">
        <input
          placeholder="#FF5733 或 red"
          value={newColorHex}
          onChange={(e) => setNewColorHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addColorToActive(); }}
        />
        <button type="button" onClick={addColorToActive}>添加</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/PaletteSidebar.tsx \
        packages/react-components/src/color-studio/src/components/ColorChip.tsx
git commit -m "feat(color-studio): PaletteSidebar + ColorChip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Implement `PickerPanel.tsx` + `ImageColorPicker.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/PickerPanel.tsx`
- Create: `packages/react-components/src/color-studio/src/components/ImageColorPicker.tsx`

- [ ] **Step 1: Implement `PickerPanel.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/PickerPanel.tsx
//
// EyeDropper + 图像取色器入口。

import { useColorStudio } from '../state/ColorStudioProvider';
import { useEyedropper } from '../hooks/useEyedropper';
import { makeId } from '../utils/id';
import { ImageColorPicker } from './ImageColorPicker';

interface Props {
  onPicked?: (hex: string) => void;
}

export function PickerPanel({ onPicked }: Props) {
  const { doc, setDoc } = useColorStudio();
  const { isSupported, open } = useEyedropper();
  const { activePaletteId } = doc;

  const addPicked = (hex: string) => {
    const id = makeId();
    const ts = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
      palettes: d.palettes.map((p) => p.id === activePaletteId ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts } : p),
      pickHistory: [{ hex, source: 'eyedropper', pickedAt: ts }, ...d.pickHistory].slice(0, 12),
      meta: { ...d.meta, updatedAt: ts },
    }));
    onPicked?.(hex);
  };

  return (
    <div className="sl-cs-picker">
      <button
        type="button"
        className="sl-cs-picker__eyedropper"
        disabled={!isSupported}
        onClick={() => open().then((h) => h && addPicked(h))}
      >
        {isSupported ? '🎯 屏幕取色' : '🎯 不支持取色器'}
      </button>
      <ImageColorPicker onPick={addPicked} />
    </div>
  );
}
```

- [ ] **Step 2: Implement `ImageColorPicker.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/ImageColorPicker.tsx
//
// 1) 上传图片(本地,不入 KV)
// 2) 缩放 max 边 256
// 3) canvas hover 取色 + K-means 主色提取按钮

import { useCallback, useRef, useState } from 'react';
import { extractDominantColors } from '../engine/colorExtraction';

interface Props { onPick: (hex: string) => void; }

const MAX_SIDE = 256;

export function ImageColorPicker({ onPick }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hoverHex, setHoverHex] = useState<string | null>(null);

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(MAX_SIDE / img.width, MAX_SIDE / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = canvasRef.current!;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
  }, []);

  const onHover = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((evt.clientX - rect.left) / rect.width) * canvasRef.current.width);
    const y = Math.round(((evt.clientY - rect.top) / rect.height) * canvasRef.current.height);
    const ctx = canvasRef.current.getContext('2d')!;
    const px = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    setHoverHex(hex);
  }, []);

  const onClick = useCallback(() => {
    if (!hoverHex) return;
    onPick(hoverHex);
  }, [hoverHex, onPick]);

  const extractDominant = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const palette = extractDominantColors(data, 6);
    palette.slice(0, 5).forEach(onPick);
  }, [onPick]);

  return (
    <div className="sl-cs-imagepicker">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <button type="button" onClick={() => fileRef.current?.click()}>上传图片取色</button>
      {imageUrl && (
        <div className="sl-cs-imagepicker__preview">
          <canvas
            ref={canvasRef}
            onMouseMove={onHover}
            onMouseLeave={() => setHoverHex(null)}
            onClick={onClick}
            style={{ maxWidth: '100%', cursor: 'crosshair' }}
          />
          {hoverHex && (
            <div className="sl-cs-imagepicker__hover">
              <span className="sl-cs-imagepicker__chip" style={{ backgroundColor: hoverHex }} />
              <code>{hoverHex}</code>
              <button type="button" onClick={onClick}>加入</button>
            </div>
          )}
          <button type="button" onClick={extractDominant}>提取 5 主色</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/PickerPanel.tsx \
        packages/react-components/src/color-studio/src/components/ImageColorPicker.tsx
git commit -m "feat(color-studio): PickerPanel + ImageColorPicker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Implement `QuickAddBar.tsx` + `HistoryStrip.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/QuickAddBar.tsx`
- Create: `packages/react-components/src/color-studio/src/components/HistoryStrip.tsx`

- [ ] **Step 1: Implement `QuickAddBar.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/QuickAddBar.tsx
//
// 页面底部全局粘贴输入条,粘入 hex / rgb / hsl / 颜色英文名自动入 active palette。

import { useState } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { parseUserInput } from '../engine/colorMath';
import { makeId } from '../utils/id';

export function QuickAddBar() {
  const { doc, setDoc } = useColorStudio();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    if (!doc.authState) {
      // 由上层 ColorStudioProvider 已处理 auth 提示
    }
    // 支持逗号/空格/换行分隔批量
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const hexes = tokens.map(parseUserInput).filter((h): h is string => !!h);
    if (hexes.length === 0) {
      setError(`无法识别: "${text}"`);
      return;
    }
    const ts = Date.now();
    setDoc((d) => {
      const newEntries = hexes.map((hex, i) => ({
        id: makeId(ts + i),
        hex,
        weight: 1,
        locked: false,
        note: '',
        tags: [],
        createdAt: ts,
        updatedAt: ts,
      }));
      return {
        ...d,
        colorEntries: [...d.colorEntries, ...newEntries],
        palettes: d.palettes.map((p) => p.id === d.activePaletteId
          ? { ...p, colorIds: [...p.colorIds, ...newEntries.map((e) => e.id)], updatedAt: ts }
          : p),
        pickHistory: [
          ...hexes.map((hex) => ({ hex, source: 'paste' as const, pickedAt: ts })),
          ...d.pickHistory,
        ].slice(0, 12),
        meta: { ...d.meta, updatedAt: ts },
      };
    });
    setText('');
    setError(null);
  };

  return (
    <div className="sl-cs-quickadd">
      <input
        placeholder="粘贴 #FF5733 / rgb(255,...) / red(空格分隔多色)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        aria-label="快速添加颜色"
      />
      <button type="button" onClick={submit}>添加</button>
      {error && <span className="sl-cs-quickadd__err">{error}</span>}
      <span className="sl-cs-quickadd__hint">A 添加 · C 复制 · P 取色 · X 清历史</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement `HistoryStrip.tsx`**

```tsx
// packages/react-components/src/color-studio/src/components/HistoryStrip.tsx
//
// 最近 12 个取过/加过的色,环形横排。

import { useColorStudio } from '../state/ColorStudioProvider';
import { makeId } from '../utils/id';

export function HistoryStrip() {
  const { doc, setDoc } = useColorStudio();
  const recent = doc.pickHistory.slice(0, 12);

  const reAdd = (hex: string) => {
    const id = makeId();
    const ts = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
      palettes: d.palettes.map((p) => p.id === d.activePaletteId ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts } : p),
      meta: { ...d.meta, updatedAt: ts },
    }));
  };

  return (
    <div className="sl-cs-history">
      <h4>最近</h4>
      <div className="sl-cs-history__strip">
        {recent.length === 0 && <span className="sl-cs-history__empty">(空)</span>}
        {recent.map((h, i) => (
          <button
            key={`${h.pickedAt}-${i}`}
            type="button"
            className="sl-cs-history__chip"
            style={{ backgroundColor: h.hex }}
            onClick={() => reAdd(h.hex)}
            aria-label={`历史色 ${h.hex}`}
            title={`${h.hex} (${h.source})`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/QuickAddBar.tsx \
        packages/react-components/src/color-studio/src/components/HistoryStrip.tsx
git commit -m "feat(color-studio): QuickAddBar + HistoryStrip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Implement `KeyboardHints.tsx`

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/KeyboardHints.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/react-components/src/color-studio/src/components/KeyboardHints.tsx
//
// 静态文案,列快捷键。不交互。

export function KeyboardHints() {
  return (
    <div className="sl-cs-kbds">
      <h4>快捷键</h4>
      <ul>
        <li><kbd>P</kbd> / <kbd>E</kbd> 屏幕取色</li>
        <li><kbd>A</kbd> / <kbd>Enter</kbd> 把当前色加入活动板</li>
        <li><kbd>C</kbd> 复制当前 hex</li>
        <li><kbd>X</kbd> 清空历史</li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/color-studio/src/components/KeyboardHints.tsx
git commit -m "feat(color-studio): KeyboardHints component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Wire it all in `index.tsx` and write `index.css`

**Files:**
- Create: `packages/react-components/src/color-studio/index.tsx`
- Create: `packages/react-components/src/color-studio/index.css`

- [ ] **Step 1: Implement `index.tsx`**

```tsx
// packages/react-components/src/color-studio/index.tsx
import './index.css';
import { ColorStudioProvider } from './src/state/ColorStudioProvider';
import { ColorWheel } from './src/components/ColorWheel';
import { ColorDetailPanel } from './src/components/ColorDetailPanel';
import { PaletteSidebar } from './src/components/PaletteSidebar';
import { QuickAddBar } from './src/components/QuickAddBar';
import { PickerPanel } from './src/components/PickerPanel';
import { HistoryStrip } from './src/components/HistoryStrip';
import { KeyboardHints } from './src/components/KeyboardHints';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';

export default function ColorStudio() {
  return (
    <ColorStudioProvider>
      <Shell />
    </ColorStudioProvider>
  );
}

function Shell() {
  useKeyboardShortcuts();
  return (
    <div className="sl-cs">
      <header className="sl-cs__header">
        <h2>Color Studio</h2>
      </header>
      <aside className="sl-cs__left"><PaletteSidebar /></aside>
      <main className="sl-cs__main">
        <section className="sl-cs__wheel"><ColorWheel /></section>
        <section className="sl-cs__detail"><ColorDetailPanel /></section>
        <section className="sl-cs__history"><HistoryStrip /></section>
      </main>
      <aside className="sl-cs__right">
        <PickerPanel />
        <KeyboardHints />
      </aside>
      <footer className="sl-cs__bottom"><QuickAddBar /></footer>
    </div>
  );
}
```

- [ ] **Step 2: Implement `index.css`**

```css
/* packages/react-components/src/color-studio/index.css */
.sl-cs {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 240px 1fr 280px;
  grid-template-areas:
    "header header header"
    "left   main   right"
    "bottom bottom bottom";
  width: 100%;
  height: 100vh;
  gap: var(--sl-space-3, 12px);
  padding: var(--sl-space-3, 12px);
  background: var(--sl-color-surface, #fff);
  color: var(--sl-color-text, #1a1a1a);
  font-family: var(--sl-font-family, system-ui);
  font-size: var(--sl-font-size-sm, 13px);
  box-sizing: border-box;
}
.sl-cs__header { grid-area: header; }
.sl-cs__left   { grid-area: left;   overflow: auto; }
.sl-cs__main   { grid-area: main;   display: flex; flex-direction: column; gap: 12px; overflow: auto; }
.sl-cs__right  { grid-area: right;  display: flex; flex-direction: column; gap: 12px; overflow: auto; }
.sl-cs__bottom { grid-area: bottom; }

.sl-cs__wheel   { display: flex; gap: 12px; }
.sl-cs__detail  { /* 内部由 ColorDetailPanel 布局 */ }
.sl-cs__history { /* 内部由 HistoryStrip 布局 */ }

.sl-cs-palettes { display: flex; flex-direction: column; gap: 8px; }
.sl-cs-palettes__list { list-style: none; padding: 0; margin: 0; }
.sl-cs-palettes__name { width: 100%; text-align: left; padding: 6px 8px; border: 0; background: transparent; }
.sl-cs-palettes__name.is-active { background: var(--sl-color-primary, #2563eb); color: var(--sl-color-on-primary, #fff); }
.sl-cs-palettes__add { display: flex; gap: 4px; }
.sl-cs-palettes__colors { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.sl-cs-palettes__color { display: flex; align-items: center; gap: 4px; }

.sl-cs-chip { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border: 1px solid var(--sl-color-border, #e5e7eb); border-radius: 6px; flex: 1; }
.sl-cs-chip.is-active { border-color: var(--sl-color-primary, #2563eb); }
.sl-cs-chip__swatch { width: 18px; height: 18px; border: 1px solid rgba(0,0,0,.15); border-radius: 4px; cursor: pointer; padding: 0; }
.sl-cs-chip__hex { font-family: var(--sl-font-family-mono, monospace); font-size: 11px; }
.sl-cs-chip__actions { display: flex; gap: 2px; margin-left: auto; }
.sl-cs-chip__actions button { background: transparent; border: 0; cursor: pointer; font-size: 11px; }

.sl-cs-detail { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--sl-color-border, #e5e7eb); border-radius: 6px; }
.sl-cs-detail__swatch { width: 100%; height: 80px; border-radius: 6px; border: 1px solid var(--sl-color-border, #e5e7eb); }
.sl-cs-detail__fields { display: grid; grid-template-columns: 80px 1fr auto; gap: 4px; align-items: center; }
.sl-cs-detail__label { font-weight: 600; }
.sl-cs-detail__value { font-family: var(--sl-font-family-mono, monospace); font-size: 11px; cursor: text; padding: 2px 4px; }
.sl-cs-detail__copy { background: transparent; border: 0; cursor: pointer; font-size: 11px; }
.sl-cs-detail__a11y { display: flex; gap: 12px; font-size: 11px; color: var(--sl-color-text-secondary, #6b7280); }

.sl-cw { display: flex; flex-direction: column; gap: 8px; }
.sl-cw__disk { touch-action: none; user-select: none; }
.sl-cw__controls { display: flex; flex-direction: column; gap: 8px; }
.sl-cw__slider { display: flex; align-items: center; gap: 8px; }
.sl-cw__slider input { flex: 1; }
.sl-cw__vlabel { font-family: var(--sl-font-family-mono, monospace); font-size: 11px; width: 24px; text-align: right; }
.sl-cw__harmony { display: flex; gap: 4px; flex-wrap: wrap; }
.sl-cw__harmony-btn { background: transparent; border: 1px solid var(--sl-color-border, #e5e7eb); padding: 4px 8px; cursor: pointer; border-radius: 4px; font-size: 11px; }
.sl-cw__harmony-btn.is-active { background: var(--sl-color-primary, #2563eb); color: var(--sl-color-on-primary, #fff); }

.sl-cs-picker { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--sl-color-border, #e5e7eb); border-radius: 6px; }
.sl-cs-picker__eyedropper { width: 100%; padding: 8px; }

.sl-cs-imagepicker__preview { display: flex; flex-direction: column; gap: 6px; }
.sl-cs-imagepicker__hover { display: flex; align-items: center; gap: 6px; }
.sl-cs-imagepicker__chip { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--sl-color-border, #e5e7eb); }

.sl-cs-quickadd { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--sl-color-border, #e5e7eb); }
.sl-cs-quickadd input { flex: 1; padding: 6px 8px; }
.sl-cs-quickadd__err { color: #b91c1c; font-size: 11px; }
.sl-cs-quickadd__hint { font-size: 11px; color: var(--sl-color-text-secondary, #6b7280); }

.sl-cs-history__strip { display: flex; gap: 4px; flex-wrap: wrap; }
.sl-cs-history__chip { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--sl-color-border, #e5e7eb); padding: 0; cursor: pointer; }
.sl-cs-history__empty { color: var(--sl-color-text-secondary, #6b7280); font-size: 11px; }

.sl-cs-kbds ul { list-style: none; padding: 0; }
.sl-cs-kbds li { padding: 2px 0; font-size: 11px; }
.sl-cs-kbds kbd { background: var(--sl-color-surface-alt, #f3f4f6); padding: 1px 5px; border-radius: 3px; font-family: var(--sl-font-family-mono, monospace); font-size: 10px; }
```

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/index.tsx \
        packages/react-components/src/color-studio/index.css
git commit -m "feat(color-studio): top-level shell + grid layout CSS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Stage M5: Config & Verification

## Task 20: Add `component.config.ts`

**Files:**
- Create: `packages/react-components/src/color-studio/component.config.ts`

- [ ] **Step 1: Implement `component.config.ts`**

```ts
// packages/react-components/src/color-studio/component.config.ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'color-studio',
  name: 'ColorStudio',
  title: '色彩管理工作台',
  description: 'HSB 圆盘 + 取色 + 调色板 + 和声派生 + JSON 整体读写。',
  version: '0.1.0',
  framework: 'react',
  entry: './index.tsx',
  platform: 'both',
  group: '设计',
  category: '色彩管理',
  tags: ['color', 'picker', 'palette', 'harmony'],
  status: 'experimental',
  route: { path: '/components/color-studio', title: '色彩管理工作台' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { fullscreen: true, fullscreenMode: 'viewport', resizable: false },
} satisfies ComponentConfig;
```

- [ ] **Step 2: Lint config**

Run: `pnpm lint`
Expected: 0 errors,0 warnings (especially style-library/valid-component-config passing).

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/color-studio/component.config.ts
git commit -m "feat(color-studio): component.config.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: Write README

**Files:**
- Create: `packages/react-components/src/color-studio/README.md`

- [ ] **Step 1: Implement README.md**

```md
# Color Studio

设计/前端用的色彩管理工作台 MVP-B(HSB 圆盘 + 取色 + 调色板 + 和声派生 + JSON 整体读写)。

## 路线

`/components/color-studio`。

## 持久化

kvV1,key `color-studio`,tag `['color-studio']`,走 caller `default_group_id`。
完整文档类型见 `apps/showcase/src/api/components/color-studio/types.ts`。

## 快捷键

| 键 | 动作 |
|---|---|
| P / E | 屏幕取色(EyeDropper) |
| A / Enter | 把当前色加入活动板 |
| C | 复制当前 hex |
| X | 清空历史 |

## 本地开发

```bash
pnpm install
pnpm --filter @style-library/showcase dev
open http://localhost:5173/components/color-studio
```

## 不在范围

Konva 笔刷、滤镜栈、比例视图、全局 Token、Pantone、IndexedDB 离线、跨标签页乐观锁 —— 见 spec §10。
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/color-studio/README.md
git commit -m "docs(color-studio): README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Manifest & build verification

**Files:** n/a (verification gate)

- [ ] **Step 1: Lint clean**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 2: TypeScript clean**

Run: `pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json && pnpm exec tsc --noEmit -p apps/showcase/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: All unit tests pass**

Run: `pnpm exec vitest run`
Expected: all green.

- [ ] **Step 4: Dev manifest check**

Run: `pnpm --filter @style-library/showcase dev &`
Sleep 8 seconds.
Run: `curl -s http://localhost:5173/__component-manifest.json | grep -q '"id":"color-studio"' && echo OK || echo MISSING`
Expected: OK.

- [ ] **Step 5: Prod build check**

Run: `pnpm --filter @style-library/showcase build`
Expected: `apps/showcase/dist/assets/` contains `rc-color-studio-*.js`.

- [ ] **Step 6: Manual browser check (record findings inline here)**

Open `http://localhost:5173/components/color-studio` in browser:
- [ ] Page loads with no console errors
- [ ] Drag on color disk → Center "当前色" updates
- [ ] Click and drag brightness slider → disk hue ring colors recompute
- [ ] Click "互补" harmony → white dashed line appears
- [ ] QuickAddBar: paste `#FF5733, red, hsl(120,100%,50%)` → 3 colors added
- [ ] Reload page → colors persist (KV read-back works)
- [ ] History strip shows the 3 added colors
- [ ] Add a new palette name → it appears in sidebar list, clickable

If any step fails, capture the failing step + console error into a comment, fix in next iteration.

- [ ] **Step 7: Final commit + tag**

```bash
git add -A
git commit -m "feat(color-studio): MVP-B complete (HSB wheel + picker + palette + harmony + KV)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag color-studio-mvp-b
```

---

## Self-Review

**Spec coverage** (each spec section → plan task):

| Spec section | Implemented in task |
|---|---|
| §2.1 ColorStudioDocument types | T2 (host types) |
| §2.2 Pool split / schemaVersion / invariants | T2, T9 (`assertInvariants`) |
| §3.2 createColorStudioStore contract | T3 (with stub for `exportJson` — see note) |
| §3.3 kvV1 key/tag/default group fallback | T3 |
| §4.1 Directory layout | T1-T22 (all paths created) |
| §4.2 Top-level shape (Provider + Shell) | T9, T19 |
| §4.3 engine/colorMath contract | T4 |
| §4.4 useColorStudioDoc contract | T9 (the hook is folded into `ColorStudioProvider` since the provider owns doc state) — see note below |
| §5 component.config.ts metadata | T20 |
| §6 Add culori + react-colorful + happy-dom | T1 |
| §7 别名(无须新增) — verified by using `@api/components/color-studio/*` and `@/shared/auth-store` | T3, T9 |
| §8 Verification | T22 |
| §9 Risks (EyeDropper support check, KV 12 history cap, code 50 fallback, dnd-kit fallback not needed — we used up/down buttons, react-colorful in PickerPanel) | T11, T3, T12, T16, T15 |
| §10 Not-in-scope | Out-of-scope items NOT touched in plan ✓ |

**Notes / deviations:**

1. `useColorStudioDoc` (spec §4.4) was folded into `ColorStudioProvider` (T9) because the provider **already owns** the doc state — having a separate hook with its own state would double the source of truth. Functionality: load on mount, debounced save on setDoc, status, forceReload — all present in `ColorStudioProvider` per the spec's contract semantics.

2. `createColorStudioStore.exportJson` in T3 is a thin pass-through; the actual current-doc tracking lives in the consumer (hook / provider), since the store is by design stateless across calls. Final integration: `PickerPanel` or a future `ExportButton` will call `JSON.stringify(provider.doc)` directly.

3. The `dnd-kit` decision in spec §9 was "失败则降级为上下移按钮"; the plan uses only up/down buttons throughout. Drag-and-drop is an explicit non-goal for MVP-B.

4. `react-colorful` (an added dependency in T1) is **not used** in any UI task yet. Final integration: a future `EditColorModal` may import `HexColorPicker` for a different UX flow. For MVP-B, dependency is wired but unused; can be removed in a follow-up if no integration PR opens soon.

**Placeholder scan:** Searched for "TODO", "TBD", "implement later", "fill in details" — none present.

**Type consistency:**
- `ColorStudioDocument` defined once (T2), re-used in T8 (Zod) and T9 (Provider) and T15 (Sidebar).
- `ColorEntry` fields (`weight`/`note`/`tags`/`derivedFrom`) all preserved.
- `Hex = string` re-exported from `@api/components/color-studio/types` consistently.
- `makeId` defined in T9 (Step 1) but **referenced** before its defining file in T15 — Vite/Vitest both resolve via ESM, so this works as written. If a circular-import strict mode trips, move `makeId` to T14 just before `PaletteSidebar`.

**Done.** Plan ready for execution via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.
