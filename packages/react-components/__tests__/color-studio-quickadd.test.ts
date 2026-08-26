import { describe, it, expect } from 'vitest';
import { applyFilterStackToHex } from '../src/color-studio/src/engine/filterColor';
import { addEntryToActivePalette } from '../src/color-studio/src/utils/paletteActions';
import { emptyDoc } from '../../../apps/showcase/src/api/components/color-studio/types';

describe('applyFilterStackToHex', () => {
  it('empty stack returns hex unchanged', () => {
    expect(applyFilterStackToHex('#3B82F6', [])).toBe('#3B82F6');
  });

  it('neutral-only stack returns hex unchanged', () => {
    expect(applyFilterStackToHex('#3B82F6', [
      { id: '1', type: 'brightness', value: 100, enabled: true },
      { id: '2', type: 'hueRotate', value: 360, enabled: true },
      { id: '3', type: 'grayscale', value: 0, enabled: true },
    ])).toBe('#3B82F6');
  });

  it('disabled filters are skipped', () => {
    expect(applyFilterStackToHex('#FF0000', [
      { id: '1', type: 'invert', value: 100, enabled: false },
    ])).toBe('#FF0000');
  });

  it('invert(100%) of red is cyan', () => {
    expect(applyFilterStackToHex('#FF0000', [
      { id: '1', type: 'invert', value: 100, enabled: true },
    ])).toBe('#00FFFF');
  });

  it('brightness(0) produces black', () => {
    expect(applyFilterStackToHex('#3B82F6', [
      { id: '1', type: 'brightness', value: 0, enabled: true },
    ])).toBe('#000000');
  });

  it('brightness(200) of mid-gray clamps to white', () => {
    expect(applyFilterStackToHex('#808080', [
      { id: '1', type: 'brightness', value: 200, enabled: true },
    ])).toBe('#FFFFFF');
  });

  it('grayscale(100%) makes channels equal', () => {
    const out = applyFilterStackToHex('#FF0000', [
      { id: '1', type: 'grayscale', value: 100, enabled: true },
    ]);
    const r = parseInt(out.slice(1, 3), 16);
    const g = parseInt(out.slice(3, 5), 16);
    const b = parseInt(out.slice(5, 7), 16);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
  });

  it('hue-rotate(360) is identity (within rounding)', () => {
    const out = applyFilterStackToHex('#3B82F6', [
      { id: '1', type: 'hueRotate', value: 360, enabled: true },
    ]);
    const dr = Math.abs(parseInt(out.slice(1, 3), 16) - 0x3b);
    const dg = Math.abs(parseInt(out.slice(3, 5), 16) - 0x82);
    const db = Math.abs(parseInt(out.slice(5, 7), 16) - 0xf6);
    expect(dr).toBeLessThanOrEqual(1);
    expect(dg).toBeLessThanOrEqual(1);
    expect(db).toBeLessThanOrEqual(1);
  });

  it('stack order matters', () => {
    // brightness(0) → black,再 invert → white
    expect(applyFilterStackToHex('#FF0000', [
      { id: '1', type: 'brightness', value: 0, enabled: true },
      { id: '2', type: 'invert', value: 100, enabled: true },
    ])).toBe('#FFFFFF');
    // invert → cyan,再 brightness(0) → black
    expect(applyFilterStackToHex('#FF0000', [
      { id: '1', type: 'invert', value: 100, enabled: true },
      { id: '2', type: 'brightness', value: 0, enabled: true },
    ])).toBe('#000000');
  });
});

describe('addEntryToActivePalette', () => {
  it('adds entry to active palette only + pushes history', () => {
    const doc = emptyDoc();
    const otherPaletteId = 'other-p';
    const doc2 = {
      ...doc,
      palettes: [...doc.palettes, {
        id: otherPaletteId, name: 'B', colorIds: [], harmony: null,
        sortBy: 'manual' as const, createdAt: 1, updatedAt: 1,
      }],
    };
    const next = addEntryToActivePalette(doc2, '#ABCDEF', 'wheel', 1000);
    const active = next.palettes.find((p) => p.id === next.activePaletteId)!;
    const other = next.palettes.find((p) => p.id === otherPaletteId)!;
    expect(active.colorIds).toHaveLength(2); // 默认 1 色 + 新增
    expect(other.colorIds).toHaveLength(0);
    expect(next.pickHistory[0]).toMatchObject({ hex: '#ABCDEF', source: 'wheel', pickedAt: 1000 });
    expect(next.colorEntries).toHaveLength(2);
  });

  it('caps history at 12', () => {
    let doc = emptyDoc();
    for (let i = 0; i < 15; i++) {
      doc = addEntryToActivePalette(doc, '#111111', 'paste', i);
    }
    expect(doc.pickHistory).toHaveLength(12);
    expect(doc.pickHistory[0]?.pickedAt).toBe(14);
  });
});
