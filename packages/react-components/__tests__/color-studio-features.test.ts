import { describe, it, expect } from 'vitest';
import { groupByEntries, listGroupNames } from '../src/color-studio/src/utils/grouping';
import { exportCssVars, exportTailwind, exportDesignTokens, exportJson } from '../src/color-studio/src/engine/exporters';
import { emptyDoc } from '../../../apps/showcase/src/api/components/color-studio/types';

function entry(id: string, hex: string, group?: string) {
  return { id, hex, weight: 1, locked: false, note: '', tags: [], group, createdAt: 1, updatedAt: 1 };
}

describe('groupByEntries', () => {
  it('groups by entry.group preserving order', () => {
    const entries = [
      entry('a', '#111111', '品牌色'),
      entry('b', '#222222'),
      entry('c', '#333333', '辅助色'),
      entry('d', '#444444', '品牌色'),
      entry('e', '#555555', ''),
    ];
    const groups = groupByEntries(entries);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ name: '品牌色' });
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'd']);
    expect(groups[1]).toMatchObject({ name: '辅助色' });
    expect(groups[2].name).toBeUndefined();
    expect(groups[2].entries.map((e) => e.id)).toEqual(['b', 'e']);
  });

  it('returns empty array for empty input', () => {
    expect(groupByEntries([])).toEqual([]);
  });

  it('listGroupNames dedupes and preserves order', () => {
    const names = listGroupNames([
      entry('a', '#111111', '品牌色'),
      entry('b', '#222222', '中性色'),
      entry('c', '#333333', '品牌色'),
      entry('d', '#444444'),
    ]);
    expect(names).toEqual(['品牌色', '中性色']);
  });
});

describe('exporters', () => {
  const doc = emptyDoc();
  doc.palettes[0].name = 'Brand';
  doc.colorEntries[0].hex = '#3B82F6';

  it('exportCssVars produces :root with --color-brand-0', () => {
    const out = exportCssVars(doc);
    expect(out).toContain(':root {');
    expect(out).toContain('--color-brand-0: #3B82F6;');
  });

  it('exportTailwind produces theme.extend.colors nesting', () => {
    const out = exportTailwind(doc);
    expect(out).toContain("theme: {");
    expect(out).toContain("colors: {");
    expect(out).toContain("'brand': {");
    expect(out).toContain("'0': '#3B82F6',");
  });

  it('exportDesignTokens produces W3C structure with $type color', () => {
    const out = exportDesignTokens(doc);
    const parsed = JSON.parse(out);
    expect(parsed.color.brand['0']).toEqual({ $type: 'color', $value: '#3B82F6' });
  });

  it('exportJson round-trips the doc', () => {
    const out = exportJson(doc);
    expect(JSON.parse(out).meta.schemaVersion).toBe('1.1.0');
  });

  it('slug handles Chinese palette names', () => {
    const d = emptyDoc();
    d.palettes[0].name = '品牌 色板';
    const css = exportCssVars(d);
    expect(css).toContain('--color-品牌-色板-0:');
  });
});
