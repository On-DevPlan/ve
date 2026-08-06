import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  countStyleBlocks,
  collectVueStyleBlocks,
  generateVueStylesCode,
} from '../src/registry/vue-style-collector';

// 用 vitest 注入的 __dirname(仓库既有惯例,e2e-perf.test.ts 同款),
// 不用 fileURLToPath(new URL(..., import.meta.url)):jsdom 环境下
// import.meta.url 会被 Vite 重写为 http URL,fileURLToPath 直接抛错。
const fixtures = path.resolve(__dirname, 'fixtures/vue-styles');

describe('vue-style-collector', () => {
  it('counts style blocks in an SFC', () => {
    expect(countStyleBlocks(path.join(fixtures, 'sample/index.vue'))).toBe(1);
    expect(countStyleBlocks(path.join(fixtures, 'sample/Child.vue'))).toBe(1);
    expect(countStyleBlocks(path.join(fixtures, 'multi/index.vue'))).toBe(2);
  });

  it('scans a component dir and groups blocks by componentId', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const sample = blocks.filter((b) => b.componentId === 'sample');
    expect(sample.map((b) => path.basename(b.file))).toEqual(['index.vue', 'Child.vue']);
    expect(sample.every((b) => b.lang === 'css')).toBe(true);
  });

  it('returns [] for a non-existent components root', () => {
    expect(collectVueStyleBlocks(path.join(fixtures, 'does-not-exist'))).toEqual([]);
  });

  it('collects multiple style blocks per SFC with sequential index', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const multi = blocks.filter((b) => b.componentId === 'multi');
    expect(multi.map((b) => b.index)).toEqual([0, 1]);
    expect(multi.every((b) => b.lang === 'css')).toBe(true);
  });

  it('generates virtual module code importing every style block as ?inline', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    expect(code).toContain('?vue&type=style&index=0&lang.css&inline');
    expect(code).toContain('?vue&type=style&index=1&lang.css&inline');
    expect(code).toContain('export default');
  });

  it('aggregates style refs per componentId and uses forward-slash specifiers', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    // 聚合形状:每个 componentId 一个数组,多个 style block 归到同 id(不依赖具体 sN 编号)。
    expect(code).toMatch(/\n {2}"sample": \[s\d+, s\d+\],\n/);
    expect(code).toMatch(/\n {2}"multi": \[s\d+, s\d+\],\n/);
    // win32 归一化回归守卫:导入说明符不得含反斜杠。
    expect(code).not.toMatch(/\\/);
  });
});
