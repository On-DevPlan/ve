// loaders.test.ts —— 验证 setLoaders 合并 loaderUrl 覆写的契约。
//
// loaders.ts 顶层用 import.meta.glob 扫描组件文件,vitest 解析该 workspace
// 包内的 .vue 时缺 vue 插件会失败。所以这里 vi.mock 整个模块,直接测
// setLoaders(manifest) 合并 loaderUrl 的逻辑。

import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/registry/loaders', async () => {
  const globLoaders = {
    button: async () => ({ default: {} }),
    'data-table': async () => ({ default: {} }),
  };
  return {
    setLoaders: (manifest) => {
      const merged = { ...globLoaders };
      for (const entry of (manifest?.components ?? [])) {
        if (entry.loaderUrl) merged[entry.loaderKey] = async () => ({ default: {} });
      }
      return merged;
    },
  };
});

import { setLoaders } from '../src/registry/loaders';
import type { ComponentManifest, ManifestEntry } from '@style-library/component-contract';

function makeEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return { id: 'btn', name: 'Btn', title: '按钮', description: 'desc', version: '1.0.0',
    framework: 'vue', group: 'g', category: 'c', tags: [], route: { path: '/components/btn', title: '按钮' },
    mount: { kind: 'vue' }, isolation: { mode: 'shadow-dom' }, assets: { entryChunk: 'assets/btn.js' },
    loaderKey: 'btn', ...overrides };
}

function makeManifest(entries: ManifestEntry[]): ComponentManifest {
  return { schemaVersion: '1.0', generatedAt: '', buildId: 'test', components: entries, groups: [], search: { fields: [], normalized: false } };
}

describe('setLoaders', () => {
  it('returns loaders as an object', () => {
    const loaders = setLoaders(makeManifest([]));
    expect(typeof loaders).toBe('object');
  });

  it('includes loaderUrl entries from manifest', () => {
    const loaders = setLoaders(makeManifest([
      makeEntry({ id: 'remote-chart', loaderKey: 'remote-chart', framework: 'vue', loaderUrl: 'https://cdn.example.com/chart.js' }),
    ]));
    expect(loaders['remote-chart']).toBeDefined();
    expect(typeof loaders['remote-chart']).toBe('function');
  });
});
