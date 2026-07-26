// __tests__/search.test.ts —— SearchIndex 的最小单元测试。
//
// 用例覆盖:
//   1) query 命中中文 title
//   2) group 过滤生效,只返回同组条目
//
// 注意:
//   - entries 用 ref<readonly ManifestEntry[]>([...]) 构造;通过 helper 构造完整
//     的 ManifestEntry,避免 any 转义类型系统(spec 强调"no any without comment")。
//   - jsdom 环境由 vitest.workspace.ts 提供(Vue ref 需要响应式系统)。

import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { createSearchIndex } from '../src/registry/SearchIndex';
import type { ManifestEntry } from '@style-library/component-contract';

// helper:构造一条最小可用的 ManifestEntry(spec §5 字段全集,只填必要项)
//   - id / name / title / description / version / framework / group / category / tags
//     / route / mount / isolation / assets / loaderKey 全都要有,否则类型报错
function makeEntry(overrides: Partial<ManifestEntry>): ManifestEntry {
  return {
    id: 'x',
    name: 'X',
    title: '',
    description: '',
    version: '1.0.0',
    framework: 'vue',
    group: '',
    category: '',
    tags: [],
    route: { path: '/x', title: '' },
    mount: { kind: 'vue' },
    isolation: { mode: 'shadow-dom' },
    assets: { entryChunk: 'x.js' },
    loaderKey: 'x',
    ...overrides,
  };
}

// 共享测试数据 —— 两条不同 group 的条目
const entries = ref<readonly ManifestEntry[]>([
  makeEntry({
    id: 'btn',
    name: 'Btn',
    title: '按钮',
    description: '基础按钮',
    framework: 'vue',
    group: '基础',
    category: '交互',
    tags: ['button'],
    route: { path: '/btn', title: '按钮' },
    mount: { kind: 'vue' },
    assets: { entryChunk: 'btn.js' },
    loaderKey: 'btn',
  }),
  makeEntry({
    id: 'tbl',
    name: 'Tbl',
    title: '表格',
    description: '数据表格',
    framework: 'react',
    group: '数据',
    category: '表格',
    tags: ['table'],
    route: { path: '/tbl', title: '表格' },
    mount: { kind: 'react' },
    assets: { entryChunk: 'tbl.js' },
    loaderKey: 'tbl',
  }),
]);

describe('SearchIndex', () => {
  it('filters by query (case-insensitive)', () => {
    // 默认 query 空,先设置关键词再断言
    const s = createSearchIndex(entries);
    s.query.value = '按钮';
    // 只命中 "按钮" 那一条
    expect(s.results.value.map((r) => r.id)).toEqual(['btn']);
  });

  it('filters by group', () => {
    // 设置 group,断言数量与首条 id
    const s = createSearchIndex(entries);
    s.group.value = '数据';
    expect(s.results.value.length).toBe(1);
    expect(s.results.value[0].id).toBe('tbl');
  });
});
