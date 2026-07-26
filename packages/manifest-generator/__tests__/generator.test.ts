// 单元测试:generateManifest 生成器。
// 覆盖:
//   1) 端到端:用 fixtures 跑 scanner → generator,断言输出结构
//   2) 失败路径:重复 id 直接抛错(spec §11.1 "重复 id 阻断")

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { generateManifest } from '../src/generator'; // 被测函数
import { scanConfigs } from '../src/scanner'; // 端到端需要
import { fileURLToPath } from 'node:url'; // URL → 路径

describe('generateManifest', () => {
  it('produces a ComponentManifest from scanned configs', async () => {
    // 真扫 fixtures
    const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));
    const scanned = await scanConfigs({ roots: [`${fixtureRoot}/**/component.config.ts`] });
    // 生成 manifest
    const manifest = generateManifest(scanned, { buildId: 'test', outDir: 'dist' });
    // schemaVersion 与 manifest.schema.json 对齐
    expect(manifest.schemaVersion).toBe('1.0');
    // 两个 fixture → 两个 component
    expect(manifest.components.length).toBe(2);
    // 两个不同 group(基础 / 数据展示)→ 至少 1 个 group
    expect(manifest.groups.length).toBeGreaterThan(0);
    // 每条 entry 都按 generator 的约定补全了 assets.entryChunk 与 loaderKey
    for (const entry of manifest.components) {
      expect(entry.assets.entryChunk).toMatch(/^assets\/.*\.js$/);
      expect(entry.loaderKey).toBe(entry.id);
    }
  });

  it('rejects duplicate ids', () => {
    // 构造两条 id 都是 'x' 的扫描结果,触发 generator 的去重抛错
    const scanned = [
      // 故意用 as any 绕过 TS 类型,真实测试对象 id 重复即可,不需要完整结构
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { filePath: '/a/component.config.ts', configDir: '/a', config: { id: 'x' } as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { filePath: '/b/component.config.ts', configDir: '/b', config: { id: 'x' } as any },
    ];
    // 必须抛错(阻断构建)
    expect(() => generateManifest(scanned, { buildId: 'test', outDir: 'dist' })).toThrow();
  });

  it('produces non-empty distinct group IDs for pure-Chinese titles', () => {
    // 三条 component.config.ts,group 全是不同中文
    const scanned = makeScanned([
      { id: 'a', group: '旅行' },
      { id: 'b', group: '地图' },
      { id: 'c', group: '数据' },
    ]);
    const manifest = generateManifest(scanned, { buildId: 'test', outDir: 'dist' });
    // 3 个 group,每个 id 都非空且唯一
    expect(manifest.groups.length).toBe(3);
    const ids = manifest.groups.map((g) => g.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);  // 都不为空
    expect(new Set(ids).size).toBe(3);                     // 都不重复
    // 中文 group 应走 hash 兜底分支(id 形如 'group-xxxxxxxx-N')
    expect(ids[0]).toMatch(/^group-[0-9a-f]{8}-\d+$/);
  });

  it('ASCII group titles use ASCII slug (no hash fallback)', () => {
    const scanned = makeScanned([
      { id: 'a', group: '基础' },
      { id: 'b', group: 'Basic' },
    ]);
    const manifest = generateManifest(scanned, { buildId: 'test', outDir: 'dist' });
    // '基础' 走 hash 兜底;'Basic' 走 ASCII slug
    const ids = manifest.groups.map((g) => g.id);
    expect(ids).toContain('basic');
    expect(ids[0]).toMatch(/^group-[0-9a-f]{8}-\d+$/);
  });
});

// 测试构造器:把 { id, group } 数组变成 ScannedConfig 形状
function makeScanned(entries: Array<{ id: string; group: string }>): Array<{
  filePath: string;
  configDir: string;
  config: {
    id: string;
    group: string;
    category: string;
    tags: string[];
    framework: 'vue' | 'react';
    mount: { kind: 'vue' | 'react' };
  };
}> {
  return entries.map((e) => ({
    filePath: '/' + e.id,
    configDir: '/' + e.id,
    config: {
      id: e.id,
      group: e.group,
      category: 'c',
      tags: [],
      framework: 'vue',
      mount: { kind: 'vue' },
    },
  }));
}