// __tests__/registry.test.ts —— ComponentRegistry 的最小单元测试。
//
// 用例覆盖:
//   1) registerManifest 后 listMetadata 返回正确数量
//   2) get(id) 命中与未命中两条路径
//
// 不测的内容(spec 里约定由 F4 ajv 校验保证):
//   - ManifestEntry 字段完整性
//   - schemaVersion / buildId 校验
//   - 重复 id 的去重(由 generator 阶段负责)

import { describe, it, expect } from 'vitest';
import { createRegistry } from '../src/registry/ComponentRegistry';

describe('ComponentRegistry', () => {
  it('registers and queries entries', () => {
    // 工厂创建注册表,ref 默认空数组
    const r = createRegistry();
    // 灌入一条最小可用的 manifest —— 字段必须齐全,否则类型会报错
    r.registerManifest({
      schemaVersion: '1.0',
      generatedAt: '',
      buildId: 't',
      components: [
        {
          id: 'a',
          name: 'A',
          title: 'A',
          description: '',
          version: '1.0.0',
          framework: 'vue',
          group: 'g',
          category: 'c',
          tags: [],
          route: { path: '/a', title: 'A' },
          mount: { kind: 'vue' },
          isolation: { mode: 'shadow-dom' },
          assets: { entryChunk: 'a.js' },
          loaderKey: 'a',
        },
      ],
      groups: [],
      search: { fields: [], normalized: false },
    });
    // 列表里有 1 条
    expect(r.listMetadata().length).toBe(1);
    // 命中 id
    expect(r.get('a')?.title).toBe('A');
    // 未命中返回 undefined
    expect(r.get('b')).toBeUndefined();
  });
});
