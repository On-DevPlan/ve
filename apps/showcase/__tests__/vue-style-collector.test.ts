import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  countStyleBlocks,
  collectVueStyleBlocks,
  collectThirdPartyCssImports,
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
    // configResolved 里 generateVueStylesCode 会调 compileRawScopedCss 做验证,
    // 需要 isProduction 与 compileRawScopedCss 单测保持一致(false)。
    isProduction: opts?.isProduction ?? false,
  } as ResolvedConfig);
  return plugin;
}

function callResolveId(plugin: Plugin, id: string): Promise<string | undefined> | string | undefined {
  const fn = hook<(id: string) => unknown>(plugin.resolveId);
  return (fn as (id: string) => unknown)(id) as
    | Promise<string | undefined>
    | string
    | undefined;
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

  // ---- v3 模块源码形态(懒加载 loader map) ----

  it('emits a lazy loader map instead of v1 inline const strings / v2 eager imports', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), { root: fixtures, isProduction: false });
    // 默认导出是 Record<componentId, () => Promise<string[]>>
    expect(code).toMatch(/export default \{/);
    // 每个 componentId 一个懒加载 loader,内部 Promise.all + 字面量 import
    expect(code).toMatch(/"sample": \(\) => Promise\.all/);
    expect(code).toMatch(/"multi": \(\) => Promise\.all/);
    // v1 的 `export const sN = "<raw css>"` 必须彻底消失
    expect(code).not.toMatch(/export const s\d+ = /);
    // v2 的 cssIds / cssMap 命名导出也消失(改成默认导出懒加载 map)
    expect(code).not.toMatch(/export const cssIds/);
    expect(code).not.toMatch(/export const cssMap/);
    // 不该再有硬编码的 raw CSS 文本(CSS 现在由 vite CSS 插件产出)
    expect(code).not.toMatch(/data-v-[a-f0-9]{8}/);
    // 不再有顶层静态 import(全部改为字面量动态 import)
    expect(code).not.toMatch(/^import /m);
  });

  it('emits one literal dynamic import per style block, each with ?inline', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const code = generateVueStylesCode(blocks, { root: fixtures, isProduction: false });
    // 每个 style block 一条字面量动态 import,且都带 ?inline(让 vite 返回 export default "<css>")
    const imports = code.match(/import\([^)]*\)/g) ?? [];
    expect(imports).toHaveLength(blocks.length);
    expect(imports.every((i) => i.includes('?inline'))).toBe(true);
    expect(imports.every((i) => i.includes('__vscoped__'))).toBe(true);
    expect(imports.every((i) => i.includes('.css?inline'))).toBe(true);
  });

  it('aggregates lazy loaders per componentId and keeps the default export shape', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), { root: fixtures, isProduction: false });
    // sample 含 index.vue(1 block)+ Child.vue(1 block)→ 2 个 import;multi 含 index.vue(2 block)→ 2 个 import。
    // 聚合到同一 componentId 的 loader,内部 Promise.all 顺序与 readdir 一致。
    expect(code).toMatch(
      /"sample": \(\) => Promise\.all\(\[import\("[^"]*__vscoped__index\.vue\.0\.css\?inline"\), import\("[^"]*__vscoped__Child\.vue\.0\.css\?inline"\)\]\)\.then\(ms => ms\.map\(m => m\.default\)\),/,
    );
    expect(code).toMatch(
      /"multi": \(\) => Promise\.all\(\[import\("[^"]*__vscoped__index\.vue\.0\.css\?inline"\), import\("[^"]*__vscoped__index\.vue\.1\.css\?inline"\)\]\)\.then\(ms => ms\.map\(m => m\.default\)\),/,
    );
  });

  it('does not emit ?vue&type=style import queries', () => {
    const code = generateVueStylesCode(collectVueStyleBlocks(fixtures), { root: fixtures, isProduction: false });
    // 不走 `.vue?vue&type=style&...&inline`:那个 id 扩展名是 .vue,
    // isCSSRequest 不命中 → rollup 拿 raw CSS 当 JS 解析 → `Expected ident`(v1 Task 5 复现)
    expect(code).not.toMatch(/\?vue&type=style/);
  });

  // ---- v2 双拦截 ----

  it('resolveId intercepts both the virtual module and pseudo .css paths', async () => {
    const plugin = setup();
    // 拦截 1:虚拟模块
    expect(await callResolveId(plugin, VIRTUAL_VUE_STYLES)).toBe(VIRTUAL_VUE_STYLES);
    // 拦截 2:伪 .css 路径(磁盘不存在,必须我们认领),query 原样保留
    const id = pseudoCssPath(path.join(fixtures, 'sample/index.vue'), 0);
    expect(await callResolveId(plugin, id)).toBe(id);
    expect(await callResolveId(plugin, `${id}?inline`)).toBe(`${id}?inline`);
    // 无关 id 不认领
    expect(await callResolveId(plugin, '/some/other/file.css')).toBeUndefined();
    expect(await callResolveId(plugin, 'vue')).toBeUndefined();
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

  it('load returns the lazy loader map source for the virtual id', () => {
    const plugin = setup();
    const code = callLoad(plugin, VIRTUAL_VUE_STYLES)!;
    // v3 形态:默认导出懒加载 loader map,无顶层静态 import / 无 cssIds 命名导出
    expect(code).toMatch(/export default \{/);
    expect(code).toMatch(/\(\) => Promise\.all\(\[import\("[^"]*__vscoped__[^"]*\.css\?inline"\)/);
    expect(code).not.toMatch(/export const cssIds/);
    expect(code).not.toMatch(/export const cssMap/);
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

  // ---- v3 扩展:第三方 SFC import CSS(specifier)进入 lazy loader map ----

  it('collects static third-party CSS imports per componentId', () => {
    // with-css-import/index.vue 顶层 `import 'pkg.css'` → 收为 { 'with-css-import': ['pkg.css'] }
    const result = collectThirdPartyCssImports(fixtures);
    expect(result['with-css-import']).toEqual(['pkg.css']);
  });

  it('prepends third-party CSS imports before SFC style imports', () => {
    const blocks = collectVueStyleBlocks(fixtures);
    const thirdParty = collectThirdPartyCssImports(fixtures);
    const code = generateVueStylesCode(
      blocks,
      { root: fixtures, isProduction: false },
      thirdParty,
    );
    // 第三方 pkg.css?inline 必须在 SFC __vscoped__... ?inline 之前
    expect(code).toMatch(
      /"with-css-import": \(\) => Promise\.all\(\[import\("pkg\.css\?inline"\),\s*import\("[^"]*__vscoped__index\.vue\.0\.css\?inline"\)\]\)\.then\(ms => ms\.map\(m => m\.default\)\),/,
    );
  });

  it('generateVueStylesCode default third-party param preserves backward compat', () => {
    // 现有 2 参数调用:third-party 默认 {} → 与 v3 行为完全一致,不该有 `pkg.css?inline`
    const code = generateVueStylesCode(
      collectVueStyleBlocks(fixtures),
      { root: fixtures, isProduction: false },
    );
    expect(code).toMatch(/export default \{/);
    expect(code).toMatch(/"sample": \(\) => Promise\.all/);
    expect(code).not.toMatch(/pkg\.css\?inline/);
  });
});
