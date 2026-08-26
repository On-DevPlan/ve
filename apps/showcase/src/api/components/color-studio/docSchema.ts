// apps/showcase/src/api/components/color-studio/docSchema.ts
//
// Zod 校验 ColorStudioDocument 的导入/导出边界。
// 与 ./types.ts 保持同步。色值字段走正则严格校验。

import { z } from 'zod';

const hexSchema = z.string().regex(/^#[0-9A-F]{6}$/, 'hex must be #RRGGBB uppercase');

const harmonyTypeSchema = z.enum([
  'complementary',
  'triadic',
  'split-complementary',
  'analogous',
  'monochromatic',
]);

const colorEntrySchema = z.object({
  id: z.string().min(1),
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
  id: z.string().min(1),
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
