import { describe, it, expect } from 'vitest';
import { parseColorImportToml } from '../src/color-studio/src/engine/importParser';
import { mergePalettesIntoDoc } from '../src/color-studio/src/engine/importMerge';
import { exportToml } from '../src/color-studio/src/engine/exporters';
import { emptyDoc, type ColorStudioDocument } from '../../apps/showcase/src/api/components/color-studio/types';

function baseDoc(): ColorStudioDocument {
  return emptyDoc('tester@example.com', 1000);
}

describe('parseColorImportToml', () => {
  it('parses a valid TOML with one palette and one color', () => {
    const toml = `[[palettes]]
name = "品牌主色"

[[palettes.colors]]
hex = "#3B82F6"
weight = 60
note = "主品牌蓝"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes).toHaveLength(1);
    expect(result.palettes[0].name).toBe('品牌主色');
    expect(result.palettes[0].colors).toHaveLength(1);
    expect(result.palettes[0].colors[0]).toMatchObject({
      hex: '#3B82F6',
      weight: 60,
      note: '主品牌蓝',
      tags: [],
    });
  });

  it('parses two palettes with multiple colors', () => {
    const toml = `[[palettes]]
name = "A"

[[palettes.colors]]
hex = "#111111"
weight = 30

[[palettes.colors]]
hex = "#222222"
weight = 70
tags = ["neutral", "text"]

[[palettes]]
name = "B"

[[palettes.colors]]
hex = "#333333"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes).toHaveLength(2);
    expect(result.palettes[0].colors).toHaveLength(2);
    expect(result.palettes[1].colors).toHaveLength(1);
    // weight 缺省为 1
    expect(result.palettes[1].colors[0].weight).toBe(1);
  });

  it('returns empty result for empty input', () => {
    const result = parseColorImportToml('');
    expect(result.palettes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('normalizes hex case and short forms to uppercase #RRGGBB', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
hex = "#3b82f6"

[[palettes.colors]]
hex = "abc"

[[palettes.colors]]
hex = "rgb(59, 130, 246)"

[[palettes.colors]]
hex = "skyblue"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    const colors = result.palettes[0].colors;
    expect(colors[0].hex).toBe('#3B82F6');
    expect(colors[1].hex).toBe('#AABBCC');
    expect(colors[2].hex).toBe('#3B82F6');
    expect(colors[3].hex).toBe('#87CEEB');
  });

  it('skips unparseable hex and records an error', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
hex = "not-a-color"

[[palettes.colors]]
hex = "#3B82F6"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // 合法的那条仍保留
    expect(result.palettes[0].colors).toHaveLength(1);
    expect(result.palettes[0].colors[0].hex).toBe('#3B82F6');
  });

  it('flags invalid weight out of 0-100 range and falls back to 1', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
hex = "#3B82F6"
weight = 150
`;
    const result = parseColorImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.palettes[0].colors[0].weight).toBe(1);
  });

  it('rejects unknown fields', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
hex = "#3B82F6"
opacity = 0.5
`;
    const result = parseColorImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('skips palette missing name', () => {
    const toml = `[[palettes]]
[[palettes.colors]]
hex = "#3B82F6"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.palettes).toHaveLength(0);
  });

  it('skips comment lines', () => {
    const toml = `# 这是一个注释
[[palettes]]
name = "G"

[[palettes.colors]]
hex = "#3B82F6"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes).toHaveLength(1);
  });

  it('parses tags as string array', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
hex = "#3B82F6"
tags = ["primary", "action"]
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes[0].colors[0].tags).toEqual(['primary', 'action']);
  });

  it('handles note/tags appearing before hex (order-independent)', () => {
    const toml = `[[palettes]]
name = "G"

[[palettes.colors]]
note = "先说备注"
tags = ["a"]
hex = "#3B82F6"
`;
    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes[0].colors).toHaveLength(1);
    expect(result.palettes[0].colors[0]).toMatchObject({
      hex: '#3B82F6',
      note: '先说备注',
      tags: ['a'],
    });
  });
});

describe('mergePalettesIntoDoc', () => {
  it('appends colors to an existing palette by name', () => {
    const doc = baseDoc();
    const result = parseColorImportToml(`[[palettes]]
name = "默认调色板"

[[palettes.colors]]
hex = "#111111"
weight = 40
`);
    const { doc: next, stats } = mergePalettesIntoDoc(doc, result, 2000);
    expect(stats.palettesAppended).toBe(1);
    expect(stats.palettesAdded).toBe(0);
    expect(stats.colorsAdded).toBe(1);
    expect(next.palettes).toHaveLength(1);
    // 原有默认色 #3B82F6 保留 + 新色追加
    const p = next.palettes[0];
    expect(p.colorIds).toHaveLength(2);
    const entries = p.colorIds.map((id) => next.colorEntries.find((e) => e.id === id)!);
    expect(entries[0].hex).toBe('#3B82F6');
    expect(entries[1].hex).toBe('#111111');
    expect(entries[1].weight).toBe(40);
  });

  it('creates a new palette when name does not exist', () => {
    const doc = baseDoc();
    const result = parseColorImportToml(`[[palettes]]
name = "新板"

[[palettes.colors]]
hex = "#222222"
`);
    const { doc: next, stats } = mergePalettesIntoDoc(doc, result, 2000);
    expect(stats.palettesAdded).toBe(1);
    expect(stats.palettesAppended).toBe(0);
    expect(next.palettes).toHaveLength(2);
    expect(next.palettes[1].name).toBe('新板');
    expect(next.palettes[1].colorIds).toHaveLength(1);
    const entry = next.colorEntries.find((e) => e.id === next.palettes[1].colorIds[0])!;
    expect(entry.hex).toBe('#222222');
  });

  it('skips duplicate hex within the same palette', () => {
    const doc = baseDoc();
    const result = parseColorImportToml(`[[palettes]]
name = "默认调色板"

[[palettes.colors]]
hex = "#3B82F6"
weight = 20
`);
    const { doc: next, stats } = mergePalettesIntoDoc(doc, result, 2000);
    // 默认色板已有 #3B82F6 → 重复被跳过
    expect(stats.colorsSkipped).toBe(1);
    expect(stats.colorsAdded).toBe(0);
    expect(next.palettes[0].colorIds).toHaveLength(1);
  });

  it('updates meta.updatedAt and sets activePaletteId unchanged', () => {
    const doc = baseDoc();
    const result = parseColorImportToml(`[[palettes]]
name = "新板"

[[palettes.colors]]
hex = "#333333"
`);
    const { doc: next } = mergePalettesIntoDoc(doc, result, 5000);
    expect(next.meta.updatedAt).toBe(5000);
    expect(next.activePaletteId).toBe(doc.activePaletteId);
  });

  it('does not mutate the original doc (pure)', () => {
    const doc = baseDoc();
    const snapshot = JSON.stringify(doc);
    const result = parseColorImportToml(`[[palettes]]
name = "新板"

[[palettes.colors]]
hex = "#333333"
`);
    mergePalettesIntoDoc(doc, result, 2000);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});

describe('exportToml round-trip', () => {
  it('produces TOML that re-parses to the same colors', () => {
    const doc = baseDoc();
    doc.palettes[0].name = 'Brand';
    doc.colorEntries[0] = {
      ...doc.colorEntries[0],
      hex: '#3B82F6',
      weight: 60,
      note: '主品牌蓝',
      tags: ['primary'],
    };
    const toml = exportToml(doc);
    expect(toml).toContain('[[palettes]]');
    expect(toml).toContain('name = "Brand"');
    expect(toml).toContain('hex = "#3B82F6"');
    expect(toml).toContain('weight = 60');

    const result = parseColorImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes).toHaveLength(1);
    expect(result.palettes[0].colors[0]).toMatchObject({
      hex: '#3B82F6',
      weight: 60,
      note: '主品牌蓝',
      tags: ['primary'],
    });
  });
});
