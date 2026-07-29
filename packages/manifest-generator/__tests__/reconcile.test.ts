// 单元测试:reconcile 对账器。
// 覆盖三种差异场景:
//   1) 两边完全一致 → 三组只有 consistent 非空
//   2) manifest 有,loader 没(inManifestButNoLoader) → 该组非空
//   3) loader 有,manifest 没(inLoaderButNoManifest) → 该组非空
//   4) 混合:两边各缺一些 → 三组都非空,且 consistent 是交集
//
// 用 mock 而非真扫:reconcile 是纯函数,只关心 id 集合运算。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { reconcile } from '../src/reconcile'; // 被测函数
import type { LoaderEntry } from '../src/loader-inventory'; // mock 类型

// 造一个最小 ComponentManifest 用的工具函数。
// reconcile 只看 components[].id,所以其它字段用 cast 绕过类型校验。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeManifest(ids: string[]): any {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00Z',
    buildId: 'test',
    components: ids.map((id) => ({ id })),
    groups: [],
    search: { fields: [], normalized: true },
  };
}

// 造一个最小 LoaderEntry[] 用的工具函数。
function makeInventory(entries: Array<{ id: string; framework?: 'vue' | 'react' }>): LoaderEntry[] {
  return entries.map((e) => ({
    id: e.id,
    framework: e.framework ?? 'vue',
    entryPath: `/fake/${e.id}/index.${e.framework === 'react' ? 'tsx' : 'vue'}`,
    absolutePath: `/fake/${e.id}/index.${e.framework === 'react' ? 'tsx' : 'vue'}`,
  }));
}

describe('reconcile', () => {
  it('reports everything as consistent when manifest and inventory match', () => {
    const manifest = makeManifest(['button', 'data-table']);
    const inventory = makeInventory([
      { id: 'button', framework: 'vue' },
      { id: 'data-table', framework: 'react' },
    ]);
    const report = reconcile(manifest, inventory);
    expect(report.consistent.sort()).toEqual(['button', 'data-table']);
    expect(report.inManifestButNoLoader).toEqual([]);
    expect(report.inLoaderButNoManifest).toEqual([]);
  });

  it('reports manifest-only ids as inManifestButNoLoader', () => {
    // manifest 有 a + b,loader 只有 a → b 属于 inManifestButNoLoader
    const manifest = makeManifest(['a', 'b']);
    const inventory = makeInventory([{ id: 'a' }]);
    const report = reconcile(manifest, inventory);
    expect(report.inManifestButNoLoader).toEqual(['b']);
    expect(report.inLoaderButNoManifest).toEqual([]);
    expect(report.consistent).toEqual(['a']);
  });

  it('reports loader-only ids as inLoaderButNoManifest', () => {
    // loader 有 a + b,manifest 只有 a → b 属于 inLoaderButNoManifest
    const manifest = makeManifest(['a']);
    const inventory = makeInventory([{ id: 'a' }, { id: 'b' }]);
    const report = reconcile(manifest, inventory);
    expect(report.inManifestButNoLoader).toEqual([]);
    expect(report.inLoaderButNoManifest).toEqual(['b']);
    expect(report.consistent).toEqual(['a']);
  });

  it('partitions a mixed mismatch into all three buckets', () => {
    // manifest = {a, b}, loader = {a, c} → b 缺 loader,c 缺 manifest,a 一致
    const manifest = makeManifest(['a', 'b']);
    const inventory = makeInventory([{ id: 'a' }, { id: 'c' }]);
    const report = reconcile(manifest, inventory);
    expect(report.consistent).toEqual(['a']);
    expect(report.inManifestButNoLoader).toEqual(['b']);
    expect(report.inLoaderButNoManifest).toEqual(['c']);
  });

  it('returns three empty arrays when both sides are empty', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([]);
    const report = reconcile(manifest, inventory);
    expect(report).toEqual({
      inManifestButNoLoader: [],
      inLoaderButNoManifest: [],
      consistent: [],
    });
  });
});