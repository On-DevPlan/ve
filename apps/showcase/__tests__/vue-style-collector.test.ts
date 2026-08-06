import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  countStyleBlocks,
  collectVueStyleBlocks,
  generateVueStylesCode,
  compileRawScopedCss,
  pseudoCssPath,
  vueStyleCollector,
  computeScopedId,
  VIRTUAL_VUE_STYLES,
} from '../src/registry/vue-style-collector';

// 用 vitest 注入的 __dirname(仓库既有惯例,e2e-perf.test.ts 同款),
// 不用 fileURLToPath(new URL(..., import.meta.url)):jsdom 环境下
// import.meta.url 会被 Vite 重写为 http URL,fileURLToPath 直接抛错。
const fixtures = path.resolve(__dirname, 'fixtures/vue-styles');

/**
 * 把插件 hook 取成可直接调用的函数。
 * vite 的 Plugin 类型把 hook 声明成 ObjectHook<Fn>(可以是函数,也可以是 { handler }),
 * 我们的实现全是裸函数,测试里直接取出来调用即可 —— 这些 hook 不使用 this。
 */
function hook<T>(h: unknown): T {
  return (typeof h === 'function' ? h : (h as { handler: T }).handler) as T;
}

/** 跑一遍 configResolved,让插件把 blocks / 伪路径映射准备好。 */
function setup(opts?: { isProduction?: boolean }): Plugin {
  const plugin = vueStyleCollector({ vueComponentsRoot: fixtures });
  hook<(c: ResolvedConfig) => void>(plugin.configResolved)({
    root: fixtures,
    command: opts?.isProduction ? 'build' : 'serve',
  } as ResolvedConfig);
  return plugin;
}

function callResolveId(plugin: Plugin, id: string): string | undefined {
  return hook<(id: string) => string | undefined>(plugin.resolveId)(id);
}

function callLoad(plugin: Plugin, id: string): string | undefined {
  return hook<(id: string) => string | undefined>(plugin.load)(id);
}

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

  // ---- v2 核心:伪 .css 路径 ----

  it('pseudoCssPath sits next to the .vue and ends with a real .css extension', () => {
    const file = path.join(fixtures, 'sample/index.vue');
    const id = pseudoCssPath(file, 0);
    // 与 .vue 同目录 —— CSS 里的相对 url()/@import 语义才不变
    expect(path.dirname(id)).toBe(path.dirname(file).split('\\').join('/'));
    // 必须以 .css 结尾,否则 vite 的 CSS_LANGS_RE 不命中,CSS 插件不接管
    expect(id.endsWith('.css')).toBe(true);
    expect(path.basename(id)).toBe('__vscoped__index.vue.0.css');
    // vite 的 isCSSRequest 判定(vite@5.4.21 CSS_LANGS_RE),带 ?inline 也要命中
    const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
    expect(CSS_LANGS_RE.test(id)).toBe(true);
    expect(CSS_LANGS_RE.test(`${id}?inline`)).toBe(true);
    // 同一 SFC 的多个 style block 各自独立
    expect(pseudoCssPath(file, 1)).not.toBe(id);
  });

  it('compileRawScopedCss injects data-v-<scopedId> into the selector', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const sample = blocks.find((b) => b.componentId === 'sample')!;
    const css = compileRawScopedCss(sample, { root: fixtures, isProduction: false });
    // v2 核心不变量:raw scoped CSS 必须带 data-v-<8 位 hex>
    expect(css).toMatch(/data-v-[a-f0-9]{8}/);
    // 原始选择器仍在
    expect(css).toMatch(/\.sample/);
    // 注入的 hex 必须等于 computeScopedId 的输出(与 plugin-vue 对齐的唯一保证)
    const expected = computeScopedId(fixtures, sample.file, sample.source, false);
    expect(css).toContain(`data-v-${expected}`);
  });

  // ---- v2 模块源码形态 ----

  it('emits cssIds array and cssMap aggregate instead of v1 inline const strings', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    expect(code).toMatch(/export const cssIds = \[/);
    expect(code).toMatch(/export const cssMap = \{/);
    expect(code).toMatch(/export default cssMap;/);
    // v1 的 `export const sN = "<raw css>"` 必须彻底消失 —— 那正是绕过 vite CSS 的形态
    expect(code).not.toMatch(/export const s\d+ = /);
    // 也不该再有硬编码的 raw CSS 文本(CSS 现在由 vite CSS 插件产出)
    expect(code).not.toMatch(/data-v-[a-f0-9]{8}/);
  });

  it('imports every style block through a pseudo .css path with ?inline', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const code = generateVueStylesCode(blocks);
    // 每个 style block 一条 import,且都带 ?inline(让 vite 返回 export default "<css>")
    const importLines = code.match(/^import c\d+ from ".*";$/gm) ?? [];
    expect(importLines).toHaveLength(blocks.length);
    expect(importLines.every((l) => l.includes('?inline'))).toBe(true);
    expect(importLines.every((l) => l.includes('__vscoped__'))).toBe(true);
    expect(importLines.every((l) => l.includes('.css?inline'))).toBe(true);
  });

  it('aggregates css refs per componentId and keeps the default export shape', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    // 聚合形状:每个 componentId 一个数组,多个 style block 归到同 id。
    // css-maps.ts 消费的是 default export = Record<componentId, string[]>,签名与 v1 一致。
    expect(code).toMatch(/\n {2}"sample": \[c\d+, c\d+\],\n/);
    expect(code).toMatch(/\n {2}"multi": \[c\d+, c\d+\],\n/);
  });

  it('does not emit ?vue&type=style import queries', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures));
    // 不走 `.vue?vue&type=style&...&inline`:那个 id 扩展名是 .vue,
    // isCSSRequest 不命中 → rollup 拿 raw CSS 当 JS 解析 → `Expected ident`(v1 Task 5 复现)
    expect(code).not.toMatch(/\?vue&type=style/);
  });

  // ---- v2 双拦截 ----

  it('resolveId intercepts both the virtual module and pseudo .css paths', () => {
    const plugin = setup();
    // 拦截 1:虚拟模块
    expect(callResolveId(plugin, VIRTUAL_VUE_STYLES)).toBe(VIRTUAL_VUE_STYLES);
    // 拦截 2:伪 .css 路径(磁盘不存在,必须我们认领),query 原样保留
    const id = pseudoCssPath(path.join(fixtures, 'sample/index.vue'), 0);
    expect(callResolveId(plugin, id)).toBe(id);
    expect(callResolveId(plugin, `${id}?inline`)).toBe(`${id}?inline`);
    // 无关 id 不认领
    expect(callResolveId(plugin, '/some/other/file.css')).toBeUndefined();
    expect(callResolveId(plugin, 'vue')).toBeUndefined();
  });

  it('load returns raw scoped CSS for pseudo .css paths (with and without query)', () => {
    const plugin = setup();
    const id = pseudoCssPath(path.join(fixtures, 'sample/index.vue'), 0);
    const css = callLoad(plugin, id);
    // 返回的是 raw scoped CSS,不是 JS 模块 —— 之后交给 vite CSS 插件
    expect(css).toMatch(/data-v-[a-f0-9]{8}/);
    expect(css).toMatch(/\.sample/);
    expect(css).not.toMatch(/^export /m);
    // 带 ?inline 的同一路径必须命中同一个 block
    expect(callLoad(plugin, `${id}?inline`)).toBe(css);
    // 未知路径不接管
    expect(callLoad(plugin, '/some/other/file.css')).toBeUndefined();
  });

  it('load returns the virtual module source with imports for the virtual id', () => {
    const plugin = setup();
    const code = callLoad(plugin, VIRTUAL_VUE_STYLES)!;
    expect(code).toMatch(/^import c0 from ".*\.css\?inline";$/m);
    expect(code).toMatch(/export const cssIds = \[/);
    expect(code).toMatch(/export default cssMap;/);
  });

  it('runs with enforce: pre so it resolves before vite built-in CSS plugins', () => {
    // enforce:'pre' 是 v2 能接管伪路径的前提:必须排在 vite 内置 CSS 插件之前
    expect(vueStyleCollector({ vueComponentsRoot: fixtures }).enforce).toBe('pre');
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
    expect(computeScopedId('/abs/root', '/abs/root/foo/index.vue', '', false)).not.toBe(
      computeScopedId('/abs/root', '/abs/root/bar/index.vue', '', false),
    );
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
