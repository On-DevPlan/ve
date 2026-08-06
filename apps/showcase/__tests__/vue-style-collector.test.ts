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

  it('generates virtual module code importing every style block as ?inline', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    expect(code).toContain('?vue&type=style&index=0&lang.css&inline');
    expect(code).toContain('"sample"');
    expect(code).toContain('export default');
  });
});
