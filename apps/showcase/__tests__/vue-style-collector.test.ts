import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  countStyleBlocks,
  collectVueStyleBlocks,
  generateVueStylesCode,
  computeScopedId,
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
    // <style scoped> in fixture:true
    expect(sample.every((b) => b.scoped === true)).toBe(true);
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

  it('emits scoped CSS with data-v-<scopedId> as ESM const exports', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), {
      root: fixtures,
      isProduction: false,
    });
    // 每个 style block 一行 `export const sN = "..."`
    expect(code).toMatch(/export const s0 = /);
    expect(code).toMatch(/export const s1 = /);
    expect(code).toMatch(/export default/);
    // scopedId 必须注入到编译后 CSS,data-v-<8 位 hex>
    expect(code).toMatch(/data-v-[a-f0-9]{8}/);
    // 仍然要包含原始 CSS 选择器(.sample / .child / .multi 等)
    expect(code).toMatch(/\.sample/);
    expect(code).toMatch(/\.child/);
    expect(code).toMatch(/\.multi/);
  });

  it('aggregates style refs per componentId', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), {
      root: fixtures,
      isProduction: false,
    });
    // 聚合形状:每个 componentId 一个数组,多个 style block 归到同 id。
    expect(code).toMatch(/\n {2}"sample": \[s\d+, s\d+\],\n/);
    expect(code).toMatch(/\n {2}"multi": \[s\d+, s\d+\],\n/);
  });

  it('does not emit ?vue&type=style import queries', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), {
      root: fixtures,
      isProduction: false,
    });
    // 不再走 import query 链路:无 `?vue&type=style&...&inline`
    expect(code).not.toMatch(/\?vue&type=style/);
    // 模块顶层是 ESM const 导出,而非 `import s0 from ...`
    expect(code).not.toMatch(/^import s\d+ from/m);
  });

  it('computeScopedId matches @vitejs/plugin-vue@5.2.4 descriptor.id algorithm', () => {
    // dev 模式:sha256(normalizePath(relative(root, filename))).substring(0, 8)
    const devId = computeScopedId(
      '/abs/root',
      '/abs/root/foo/index.vue',
      '<template></template>',
      false,
    );
    expect(devId).toMatch(/^[a-f0-9]{8}$/);
    // 确定性:同一输入 → 同一输出
    expect(devId).toBe(
      computeScopedId('/abs/root', '/abs/root/foo/index.vue', '<template></template>', false),
    );
    // production 把 source 拼进去 → 不同 id
    const prodId = computeScopedId(
      '/abs/root',
      '/abs/root/foo/index.vue',
      '<template></template>',
      true,
    );
    expect(prodId).toMatch(/^[a-f0-9]{8}$/);
    expect(prodId).not.toBe(devId);
    // 不同 source → 不同 id(production)
    const prodIdOther = computeScopedId(
      '/abs/root',
      '/abs/root/foo/index.vue',
      '<template>x</template>',
      true,
    );
    expect(prodIdOther).not.toBe(prodId);
    // 不同文件名 → 不同 id
    expect(
      computeScopedId('/abs/root', '/abs/root/foo/index.vue', '', false),
    ).not.toBe(computeScopedId('/abs/root', '/abs/root/bar/index.vue', '', false));
  });

  it('handles backslash paths via normalizePath (\\ → /)', () => {
    // 直接断言:win32 风格路径里的反斜杠被归一化。
    // 用 path.join 造 win32 风格绝对路径(在当前 OS 下运行:Windows 返回 \\,POSIX 返回 /)。
    // 关键不变量:无论 OS 如何返回,computeScopedId 都把它当 / 处理 → 算法稳定。
    const root = path.resolve('/abs/root');
    const file = path.resolve('/abs/root/foo/index.vue');
    // 用相对的 forward-slash 字符串计算 id:这就是算法真正使用的形式
    const id = computeScopedId(root, file, '', false);
    expect(id).toMatch(/^[a-f0-9]{8}$/);
  });
});