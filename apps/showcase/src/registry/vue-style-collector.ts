// registry/vue-style-collector.ts —— 为 showcase 提供 virtual:vue-styles 的 Vite 插件(v2)。
//
// v1 的做法与它的缺陷:
//   v1 用 @vue/compiler-sfc 的 compileStyle 把每个 <style> block 编译成 raw scoped CSS,
//   再直接拼成 `export const sN = "<css>"` 塞进虚拟模块。CSS 文本从头到尾没经过
//   vite 的 CSS 插件 —— 于是 postcss(autoprefixer 等)、`url()` 资源重写、
//   `@import` 内联、preprocessor、minify **全部被跳过**。
//   仓库当前 0 个组件用到 url()/@import/scss,所以 build 没暴露问题;
//   一旦有人在 SFC 里写 `background: url(./bg.png)`,产物里就是一条指向不存在路径的
//   死链 —— silent failure,build 不报错。
//
// v2 的做法(本文件):
//   对每个 style block 生成一个**与 .vue 同目录、以真 `.css` 结尾**的伪文件路径:
//       <dir>/__vscoped__<basename>.<index>.css
//   vite CSS 插件的 isCSSRequest 用
//       CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
//   来判定(vite@5.4.21,dist/node/chunks/dep-*.js),`.css` 结尾 → 命中 → 接管。
//   我们只负责 resolveId(把不存在于磁盘的伪路径认领下来)+ load(吐出 compileStyle
//   编译后的 raw scoped CSS,带 data-v-xxx),**不做 postcss** —— 后续 postcss /
//   url 重写 / @import 内联全部交给 vite CSS 插件。
//   import 时带 `?inline` query,vite CSS 插件返回 `export default "<处理后的 CSS>"`,
//   于是虚拟模块拿到的是**经过完整 CSS 管线**的字符串。
//
// 为什么不能直接用 `import 'xxx.vue?vue&type=style&index=0&lang.css&inline'`:
//   那个 id 的扩展名是 `.vue`,isCSSRequest 不命中,没有任何插件把 raw CSS 包成 JS,
//   rollup 直接拿 CSS 当 JS 解析,在 `@import url(...)` 处报 `Expected ident`(v1 Task 5 复现)。
//
// enforce: 'pre' 的作用:让我们的 resolveId/load 排在 vite 内置 CSS 插件**之前**,
//   先把伪路径认领并喂出 raw CSS,vite CSS 插件随后在 transform 阶段接手。
//
// ⚠️ scopedId 必须与 @vitejs/plugin-vue@5.2.4 的 descriptor.id 字节级一致,
//    否则组件运行时的 `__scopeId = 'data-v-<id>'` 与这里注入的选择器不对齐,scoped 失效。
//    算法集中在 plugins/scoped-id.ts,build 期由 plugins/scoped-id-guard.ts 兜底比对。
//    注意 root 必须是 vite 的 config.root(apps/showcase),与 plugin-vue 的
//    createDescriptor(filename, source, { root }) 取值一致。

import { parse, compileStyle } from '@vue/compiler-sfc';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { computeScopedId } from '../../plugins/scoped-id';

export const VIRTUAL_VUE_STYLES = 'virtual:vue-styles';

/** 伪 CSS 文件名前缀;resolveId/load 靠它识别"这是我们造的路径,磁盘上不存在"。 */
const PSEUDO_PREFIX = '__vscoped__';

export interface StyleBlockEntry {
  componentId: string;
  file: string; // .vue 绝对路径
  index: number; // style block 在 SFC 内的序号
  lang: string; // 'css' | 'scss' | ...
  scoped: boolean; // <style scoped>
  content: string; // 原始 CSS 文本
  source: string; // .vue 全文;production 模式参与 scopedId
}

// re-export scoped 算法,保持现有 import 路径(vue-style-collector.test.ts 等既有调用方)。
export { computeScopedId };

/** 把 \ 换成 /;module id 在 vite 里一律用 posix 分隔符,避免 win32 下 resolveId/load 对不上。 */
function toPosix(p: string): string {
  return p.split('\\').join('/');
}

/** 去掉 module id 上的 query(`?inline` / `?used` 等),只留路径部分。 */
function stripQuery(id: string): string {
  const i = id.indexOf('?');
  return i === -1 ? id : id.slice(0, i);
}

/**
 * 为某个 style block 生成伪 CSS 路径:`<dir>/__vscoped__<basename>.<index>.css`。
 *
 * 关键点:
 *   1) **与 .vue 同目录** —— 这样 CSS 里的相对 `url(./bg.png)` / `@import './x.css'`
 *      被 vite 解析时,basedir 与原 SFC 一致,相对路径语义不变。
 *   2) **以 `.css` 结尾** —— 命中 vite 的 CSS_LANGS_RE,CSS 插件才会接管。
 *   3) 带 `__vscoped__` 前缀 + `.<index>` —— 避免与磁盘真实文件重名,且同一 SFC 的
 *      多个 style block 各自独立。
 */
export function pseudoCssPath(file: string, index: number): string {
  const dir = path.dirname(file);
  const base = path.basename(file); // 例:index.vue
  return toPosix(path.join(dir, `${PSEUDO_PREFIX}${base}.${index}.css`));
}

/** 数一个 SFC 的 <style> block 个数;解析失败按 0 处理。 */
export function countStyleBlocks(filePath: string): number {
  try {
    const src = readFileSync(filePath, 'utf-8');
    const { descriptor } = parse(src, { filename: filePath });
    return descriptor.styles.length;
  } catch {
    return 0;
  }
}

/**
 * 目录项排序:组件入口 index.vue 优先,其余按名称升序。
 * 目的:readdirSync 的顺序跨文件系统不稳定(NTFS 按名字、ext4 按创建序),
 * 显式排序保证 virtual module 的 style 顺序与组件 id 数组跨平台可复现。
 */
function compareVueNames(a: string, b: string): number {
  const rank = (name: string) => (name === 'index.vue' ? 0 : 1);
  const r = rank(a) - rank(b);
  if (r !== 0) return r;
  return a < b ? -1 : a > b ? 1 : 0;
}

function walkVueFiles(dir: string, acc: string[]): void {
  for (const name of readdirSync(dir).sort(compareVueNames)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walkVueFiles(p, acc);
    else if (p.endsWith('.vue')) acc.push(p);
  }
}

/** 扫描 vue 组件目录,按组件 id(子目录名)聚合所有 style block。 */
export function collectVueStyleBlocks(vueComponentsRoot: string): StyleBlockEntry[] {
  const entries: StyleBlockEntry[] = [];
  // 根目录不存在时静默返回空数组,避免 dev 冷启动抛错(vite 插件 build 期调用)。
  if (!existsSync(vueComponentsRoot) || !statSync(vueComponentsRoot).isDirectory()) {
    return entries;
  }
  for (const componentId of readdirSync(vueComponentsRoot).sort()) {
    const dir = path.join(vueComponentsRoot, componentId);
    if (!statSync(dir).isDirectory()) continue;
    const vueFiles: string[] = [];
    walkVueFiles(dir, vueFiles);
    for (const file of vueFiles) {
      const source = readFileSync(file, 'utf-8');
      const { descriptor } = parse(source, { filename: file });
      descriptor.styles.forEach((block, index) => {
        entries.push({
          componentId,
          file,
          index,
          lang: block.lang ?? 'css',
          scoped: !!block.scoped,
          content: block.content,
          source,
        });
      });
    }
  }
  return entries;
}

/**
 * 把一个 style block 编译成 **raw scoped CSS**(带 `data-v-<scopedId>` 选择器)。
 *
 * 这里只做 compileStyle 的 scoped 改写 —— 不做 postcss 插件、不做 url 重写、
 * 不做 @import 内联、不 minify。那些**全部**由 vite CSS 插件在 transform 阶段完成。
 * 本函数的输出是喂给 vite CSS 插件的**输入**。
 *
 * `preprocessLang` 仅在 SFC 真的用了 scss/less/sass/styl/stylus 时传;
 * 当前仓库 0 个 SFC 用 preprocessor。
 */
export function compileRawScopedCss(
  block: StyleBlockEntry,
  opts: { root: string; isProduction: boolean },
): string {
  const scopedId = computeScopedId(opts.root, block.file, block.source, opts.isProduction);
  const result = compileStyle({
    filename: block.file,
    source: block.content,
    id: `data-v-${scopedId}`,
    scoped: block.scoped,
    isProd: opts.isProduction,
    preprocessLang:
      block.lang === 'scss' ||
      block.lang === 'less' ||
      block.lang === 'sass' ||
      block.lang === 'styl' ||
      block.lang === 'stylus'
        ? block.lang
        : undefined,
  });
  if (result.errors.length) {
    throw new Error(
      `compileStyle failed for ${block.file} block #${block.index}: ${result.errors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }
  return result.code;
}

/**
 * 生成 virtual:vue-styles 的模块源码(懒加载 loader map)。
 *
 * v2 形态(废弃):顶层静态 `import cN from "<伪 .css>?inline"` + `export const cssMap`。
 *   问题:顶层 import 把所有组件的 CSS 全部 eager 拉进首页,违背评审 #6(单组件
 *   详情页不该加载其他组件的 CSS)。
 *
 * v3 形态(当前):每个 componentId 一个懒加载 loader,内部字面量动态 import,
 *   按需拉取。default export 形态 `Record<componentId, () => Promise<string[]>>`。
 *
 * compileRawScopedCss 验证仍做(dev 期早曝):configResolved 阶段对每个 block 跑一遍
 *   compileStyle,语法错误 / scopedId 算法异常在 dev server 启动时立即抛出,而不是等
 *   某个组件被打开才暴。opts(root / isProduction)就是为这一步保留。
 *
 * 关键:`import('/abs/.../__vscoped__index.0.css?inline')` 是**字面量**,vite 静态分析
 *   可分包;resolveId 拦截伪 .css,vite CSS 插件接管 ?inline。
 */
export function generateVueStylesCode(
  blocks: StyleBlockEntry[],
  opts: { root: string; isProduction: boolean },
): string {
  // compileRawScopedCss 验证仍做(dev 期早曝):抛错即早曝,结果丢弃(CSS 文本由 vite CSS 插件产出)。
  blocks.forEach((b) => { void compileRawScopedCss(b, opts); });

  const byId = new Map<string, string[]>();
  blocks.forEach((b) => {
    const p = pseudoCssPath(b.file, b.index) + '?inline';
    const arr = byId.get(b.componentId) ?? [];
    arr.push(p);
    byId.set(b.componentId, arr);
  });

  const entries = [...byId.entries()]
    .map(([id, paths]) =>
      `  ${JSON.stringify(id)}: () => Promise.all([` +
      paths.map((p) => `import(${JSON.stringify(p)})`).join(', ') +
      `]).then(ms => ms.map(m => m.default)),`,
    )
    .join('\n');

  return `export default {\n${entries}\n};\n`;
}

export function vueStyleCollector(opts: { vueComponentsRoot: string }): Plugin {
  let code: string | null = null;
  // 伪 CSS 路径(无 query) → style block,供 load() 反查。
  const pseudoBlocks = new Map<string, StyleBlockEntry>();
  let root = '';
  let isProduction = false;

  return {
    name: 'vue-style-collector',
    // 'pre' 让 resolveId/load 排在 vite 内置 CSS 插件之前:
    // 我们先认领伪路径并吐出 raw CSS,vite CSS 插件随后 transform。
    enforce: 'pre',
    configResolved(config) {
      // root 必须取 vite 的 config.root —— plugin-vue 的 createDescriptor 也是用它算
      // descriptor.id,两边不一致会导致 data-v-<id> 对不上,scoped 静默失效。
      root = config.root;
      // isProduction 必须与 plugin-vue@5.2.4 的 createDescriptor 取值一致
      // (它用 config.isProduction = NODE_ENV==='production',不是 config.command)。
      // 默认 vite build 下两者等价,但 `vite build --mode development` 会分歧:
      // 本插件算 prod id、plugin-vue 算 dev id → scoped 静默失效。
      isProduction = config.isProduction;
      const blocks = collectVueStyleBlocks(opts.vueComponentsRoot);
      pseudoBlocks.clear();
      for (const b of blocks) {
        pseudoBlocks.set(pseudoCssPath(b.file, b.index), b);
      }
      code = generateVueStylesCode(blocks, { root, isProduction });
    },
    resolveId(id) {
      // 拦截 1:虚拟模块本身。
      if (id === VIRTUAL_VUE_STYLES) return VIRTUAL_VUE_STYLES;
      // 拦截 2:伪 CSS 路径 —— 磁盘上不存在,必须我们认领,否则 vite 解析失败。
      // 原样返回(保留 `?inline` query),让 vite CSS 插件后续能读到 query。
      if (pseudoBlocks.has(stripQuery(toPosix(id)))) return id;
      return undefined;
    },
    load(id) {
      // 拦截 1:虚拟模块 → 返回懒加载 loader map 源码(每 componentId 一个 () => Promise.all([...import('伪 .css?inline')...]))。
      if (id === VIRTUAL_VUE_STYLES) return code ?? '';
      // 拦截 2:伪 CSS 路径 → 返回 raw scoped CSS(带 data-v-xxx)。
      // 到此为止,postcss / url() 重写 / @import 内联全部交给 vite CSS 插件。
      const block = pseudoBlocks.get(stripQuery(toPosix(id)));
      if (block) return compileRawScopedCss(block, { root, isProduction });
      return undefined;
    },
  };
}
