import { describe, it, expect } from 'vitest';
import { emptyDoc } from '../../../apps/showcase/src/api/components/color-studio/types';
import {
  pickWheelCommitMode,
  commitWheelColor,
  addColorEntryAndSelect,
} from '../src/color-studio/src/engine/wheelCommit';

describe('wheelCommit.pickWheelCommitMode', () => {
  it('有选中色卡 → 编辑模式(anchor 是选中色卡)', () => {
    const doc = emptyDoc();
    const anchorId = doc.palettes[0]!.colorIds[0]!;
    const mode = pickWheelCommitMode(doc, anchorId);
    expect(mode).toEqual({ mode: 'edit', anchorColorId: anchorId });
  });

  it('无选中但有板首色 → 回退编辑板首色', () => {
    const doc = emptyDoc();
    const firstId = doc.palettes[0]!.colorIds[0]!;
    const mode = pickWheelCommitMode(doc, null);
    expect(mode).toEqual({ mode: 'edit', anchorColorId: firstId });
  });

  it('空调色板 → empty 模式(无编辑目标)', () => {
    const doc = emptyDoc();
    doc.palettes[0].colorIds = [];
    doc.colorEntries = [];
    const mode = pickWheelCommitMode(doc, null);
    expect(mode).toEqual({ mode: 'empty', anchorColorId: null });
  });
});

describe('wheelCommit.commitWheelColor', () => {
  it('编辑模式:更新 anchor 色卡 hex', () => {
    const doc = emptyDoc();
    const anchorId = doc.palettes[0]!.colorIds[0]!;
    const next = commitWheelColor(doc, anchorId, '#00FF00');
    const anchor = next.colorEntries.find((c) => c.id === anchorId)!;
    expect(anchor.hex).toBe('#00FF00');
    expect(next.colorEntries).toHaveLength(1); // 不新增
  });

  it('空板(anchor 为 null):原样返回不新增', () => {
    const doc = emptyDoc();
    doc.palettes[0].colorIds = [];
    doc.colorEntries = [];
    const next = commitWheelColor(doc, null, '#123456', 1000);
    expect(next).toBe(doc); // 未改动
  });
});

describe('wheelCommit.addColorEntryAndSelect', () => {
  it('新增色卡到活动板并选中', () => {
    const doc = emptyDoc();
    const next = addColorEntryAndSelect(doc, '#ABCDEF', 'wheel', 1000);
    const active = next.palettes.find((p) => p.id === next.activePaletteId)!;
    expect(next.colorEntries).toHaveLength(2); // 默认 1 色 + 新增
    const newEntry = next.colorEntries.find((c) => c.hex === '#ABCDEF')!;
    expect(active.colorIds).toContain(newEntry.id);
    expect(next.viewState.selectedColorId).toBe(newEntry.id); // 选中新色卡
    expect(next.pickHistory[0]).toMatchObject({ hex: '#ABCDEF', source: 'wheel' });
  });

  it('空调色板也能新增并选中(白色画布 → 首色)', () => {
    const doc = emptyDoc();
    doc.palettes[0].colorIds = [];
    doc.colorEntries = [];
    const next = addColorEntryAndSelect(doc, '#FFFFFF', 'wheel', 1000);
    expect(next.colorEntries).toHaveLength(1);
    expect(next.colorEntries[0]!.hex).toBe('#FFFFFF');
    expect(next.palettes[0]!.colorIds).toEqual([next.colorEntries[0]!.id]);
    expect(next.viewState.selectedColorId).toBe(next.colorEntries[0]!.id);
  });

  it('推 history 并封顶 12', () => {
    let doc = emptyDoc();
    doc.palettes[0].colorIds = [];
    doc.colorEntries = [];
    for (let i = 0; i < 15; i++) {
      doc = addColorEntryAndSelect(doc, '#111111', 'wheel', i);
    }
    expect(doc.pickHistory).toHaveLength(12);
  });
});
