import { describe, it, expect } from 'vitest';
import { collectCss, type CssMaps } from '../src/registry/css-collector';
import type { ManifestEntry } from '@style-library/component-contract';

const maps: CssMaps = {
  react: { 'user-space': 'body { color: red; }' },
  vue: { 'china-map': ['.a { color: blue; }', '.b { color: green; }'] },
};

function entry(overrides: Partial<ManifestEntry>): ManifestEntry {
  return {
    id: 'x', name: 'X', title: 'X', description: '', version: '1.0.0',
    framework: 'react', group: 'g', category: 'c', tags: [], status: 'stable',
    platform: 'both', route: { path: '/components/x', title: 'X' },
    mount: { kind: 'react' }, isolation: { mode: 'shadow-dom' },
    assets: { entryChunk: 'assets/x.js' }, loaderKey: 'x',
    ...overrides,
  };
}

describe('collectCss', () => {
  it('returns the single react css text for a react component', () => {
    expect(collectCss(entry({ loaderKey: 'user-space' }), maps)).toEqual(['body { color: red; }']);
  });

  it('returns the full vue css array for a vue component', () => {
    expect(collectCss(entry({ framework: 'vue', loaderKey: 'china-map' }), maps)).toEqual([
      '.a { color: blue; }',
      '.b { color: green; }',
    ]);
  });

  it('returns [] for a remote loaderUrl component', () => {
    expect(collectCss(entry({ loaderUrl: 'https://cdn/x.js' }), maps)).toEqual([]);
  });

  it('returns [] when the loaderKey is missing from maps', () => {
    expect(collectCss(entry({ loaderKey: 'unknown' }), maps)).toEqual([]);
  });
});
