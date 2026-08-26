import { describe, it, expect } from 'vitest';
import { docSchema } from '../../../apps/showcase/src/api/components/color-studio/docSchema';
import { emptyDoc } from '../../../apps/showcase/src/api/components/color-studio/types';

/** 构造一份 1.0.0 旧文档(无 group / groupBy 字段)。 */
function makeV100Doc() {
  const d = emptyDoc() as Record<string, unknown>;
  // 模拟旧版:剥掉 v1.1.0 新字段,schemaVersion 降回 1.0.0
  const meta = d.meta as Record<string, unknown>;
  meta.schemaVersion = '1.0.0';
  const viewState = d.viewState as Record<string, unknown>;
  delete viewState.groupBy;
  return d;
}

describe('docSchema v1.1.0 migration', () => {
  it('1.0.0 doc migrates to 1.1.0 with groupBy=none', () => {
    const parsed = docSchema.parse(makeV100Doc());
    expect(parsed.meta.schemaVersion).toBe('1.1.0');
    expect(parsed.viewState.groupBy).toBe('none');
  });

  it('1.1.0 doc with group field round-trips', () => {
    const doc = emptyDoc();
    doc.viewState.groupBy = 'group';
    (doc.colorEntries[0] as { group?: string }).group = '品牌色';
    const parsed = docSchema.parse(doc);
    expect(parsed.meta.schemaVersion).toBe('1.1.0');
    expect(parsed.viewState.groupBy).toBe('group');
    expect((parsed.colorEntries[0] as { group?: string }).group).toBe('品牌色');
  });

  it('emptyDoc emits 1.1.0 with groupBy=none', () => {
    const doc = emptyDoc();
    expect(doc.meta.schemaVersion).toBe('1.1.0');
    expect(doc.viewState.groupBy).toBe('none');
  });

  it('docSchema.parse(emptyDoc()) passes', () => {
    expect(() => docSchema.parse(emptyDoc())).not.toThrow();
  });

  it('group must be string when present', () => {
    const doc = emptyDoc() as unknown as { colorEntries: Array<Record<string, unknown>> };
    doc.colorEntries[0].group = 123;
    expect(() => docSchema.parse(doc)).toThrow();
  });

  it('rejects unknown schemaVersion', () => {
    const doc = makeV100Doc() as { meta: { schemaVersion: string } };
    doc.meta.schemaVersion = '9.9.9';
    expect(() => docSchema.parse(doc)).toThrow();
  });
});
