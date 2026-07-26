// 单元测试:buildLoaderInventory 扫描器。
// 覆盖:
//   1) 能从 nested 目录里挑出 index.{vue,tsx},framework 推断正确
//   2) 缺 index 的子目录静默跳过
//   3) 不存在的 root 静默跳过(不抛错)
//
// fixtures 目录:
//   __tests__/fixtures/loader-inventory/
//     vue-components/src/{a,b}/index.vue
//     react-components/src/{a,b}/index.tsx
//     react-components/src/no-entry/README.md (没有 index.*,应被跳过)

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { buildLoaderInventory } from '../src/loader-inventory'; // 被测函数
import { fileURLToPath } from 'node:url'; // URL → 文件系统路径
import path from 'node:path'; // path.join 拼 root

// import.meta.url 转绝对路径,作为 fixtures 的根
const fixtureRoot = fileURLToPath(new URL('./fixtures/loader-inventory', import.meta.url));

describe('buildLoaderInventory', () => {
  it('returns an entry for every index.{vue,tsx} under each root', async () => {
    // 同时给 vue + react 两个 root,断言 4 条记录
    const roots = [
      path.join(fixtureRoot, 'vue-components/src'),
      path.join(fixtureRoot, 'react-components/src'),
    ];
    const entries = await buildLoaderInventory(roots);
    // a + b 各两个 framework = 4
    expect(entries.length).toBe(4);
    // 按 id 排序后断言 id 集合
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual(['a', 'a', 'b', 'b']);
    // 按 id+framework 聚合,确保 framework 推断正确
    const pairs = entries.map((e) => `${e.id}:${e.framework}`).sort();
    expect(pairs).toEqual(['a:react', 'a:vue', 'b:react', 'b:vue']);
  });

  it('captures absolutePath that ends with the entry filename', async () => {
    const roots = [path.join(fixtureRoot, 'vue-components/src')];
    const entries = await buildLoaderInventory(roots);
    // 每条 entry 的 absolutePath 必须以 index.vue / index.tsx 结尾
    for (const e of entries) {
      const tail = path.basename(e.absolutePath);
      expect(['index.vue', 'index.tsx']).toContain(tail);
    }
  });

  it('skips directories without index.{vue,tsx} silently', async () => {
    // react-components/src/no-entry 只有 README.md,应被跳过
    const roots = [path.join(fixtureRoot, 'react-components/src')];
    const entries = await buildLoaderInventory(roots);
    // 没有 no-entry 这条
    expect(entries.find((e) => e.id === 'no-entry')).toBeUndefined();
    // 但 a + b 仍然在
    expect(entries.length).toBe(2);
  });

  it('silently skips non-existent roots', async () => {
    // 给一个根本不存在的路径,不能抛错
    const roots = [
      path.join(fixtureRoot, 'does-not-exist/src'),
      path.join(fixtureRoot, 'vue-components/src'), // 这条仍然正常返回
    ];
    const entries = await buildLoaderInventory(roots);
    // vue a + b 两条
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});