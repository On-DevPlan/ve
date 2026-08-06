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

import { babelParse, parse, compileStyle, type SFCScriptBlock } from '@vue/compiler-sfc';
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

/**
 * 判定一个 specifier 是否"裸 npm 包 CSS"(需要由 vite 从 node_modules 解析)。
 * 排除:相对路径(/ ./ ../)、URL、绝对路径、hash 路由。
 */
function isBareThirdPartyCss(specifier: string): boolean {
  const pathname = specifier.split(/[?#]/, 1)[0];
  return (
    /\.css$/i.test(pathname) &&
    !specifier.startsWith('.') && !specifier.startsWith('/') &&
    !specifier.startsWith('#') &&
    !/^[a-z][a-z\d+.-]*:/i.test(specifier) &&
    !/^[a-z]:[\\/]/i.test(specifier)
  );
}

/** 根据 SFC script block 的 lang 选择 babel parser plugins。 */
function scriptParserPlugins(block: SFCScriptBlock): unknown[] {
  const plugins: unknown[] = ['importAttributes'];
  const lang = block.lang?.toLowerCase();
  if (lang === 'ts' || lang === 'tsx' || lang === 'mts' || lang === 'cts') {
    plugins.push('typescript', 'explicitResourceManagement', 'decorators-legacy');
  }
  if (lang === 'jsx' || lang === 'tsx') plugins.push('jsx');
  return plugins;
}

/**
 * 用 babel AST 提取某个 script block 里的静态 `import '*.css'` 字面量。
 * 只收 ImportDeclaration,排除 `import type`。
 */
function extractStaticCssImports(block: SFCScriptBlock): string[] {
  const ast = babelParse(block.content, {
    sourceType: 'module',
    plugins: scriptParserPlugins(block) as Parameters<typeof babelParse>[1]['plugins'],
  });
  const imports: string[] = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration' &&
        node.importKind !== 'type' &&
        typeof node.source.value === 'string' &&
        isBareThirdPartyCss(node.source.value)) {
      imports.push(node.source.value);
    }
  }
  return imports;
}

/**
 * 扫描 vue 组件目录,按组件 id 聚合所有 SFC script block 里的
 * 静态 `import '*.css'` 字面量(裸 npm 包)。
 *
 * 用途:openlayers 之类的第三方 CSS 通过 `import 'ol/ol.css'` 被 vite cssCodeSplit
 * inline 进 component CSS chunk 而**不**生成 <link>。组件挂载到 ShadowRoot 后,
 * DOM 在 shadow 内、selector 跨不进 → 控件裸渲染。本函数把这些 specifier 收出来,
 * 在 generateVueStylesCode 里以 `?inline` 后缀和 SFC <style> 一起塞进 cssMap。
 */
export function collectThirdPartyCssImports(
  vueComponentsRoot: string,
): Record<string, string[]> {
  if (!existsSync(vueComponentsRoot) || !statSync(vueComponentsRoot).isDirectory()) return {};
  const byId = new Map<string, string[]>();
  for (const componentId of readdirSync(vueComponentsRoot).sort()) {
    const dir = path.join(vueComponentsRoot, componentId);
    if (!statSync(dir).isDirectory()) continue;
    const vueFiles: string[] = [];
    walkVueFiles(dir, vueFiles);
    const set = new Set<string>();
    for (const file of vueFiles) {
      const source = readFileSync(file, 'utf-8');
      const { descriptor } = parse(source, { filename: file });
      const scripts = [descriptor.script, descriptor.scriptSetup]
        .filter((b): b is SFCScriptBlock => b !== null)
        .sort((a, b) => a.loc.start.offset - b.loc.start.offset);
      for (const block of scripts) extractStaticCssImports(block).forEach(set.add, set);
    }
    if (set.size > 0) byId.set(componentId, [...set]);
  }
  return Object.fromEntries(byId);
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
 *
 * 第三参数 `thirdPartyCssImports`(可选)收录 SFC script 里静态 `import '*.css'` 的
 *   裸 npm specifier(componentId → specifier[]),把它们以 `?inline` 后缀和 SFC <style>
 *   一起塞进同一 componentId 的 lazy loader,与组件 CSS 一起进 ShadowRoot —— 修
 *   `import 'ol/ol.css'` 之类被 vite cssCodeSplit 内联进 chunk 但不生成 <link>
 *   导致 ShadowRoot 拿不到样式的 bug。第三参数默认 `{}`,不破坏既有 2 参数调用。
 */
export function generateVueStylesCode(
  blocks: StyleBlockEntry[],
  opts: { root: string; isProduction: boolean },
  thirdPartyCssImports: Record<string, string[]> = {},
): string {
  // compileRawScopedCss 验证仍做(dev 期早曝):抛错即早曝,结果丢弃(CSS 文本由 vite CSS 插件产出)。
  blocks.forEach((b) => { void compileRawScopedCss(b, opts); });

  const byId = new Map<string, string[]>();
  // 第三方 CSS 必须在 SFC <style> 之前:ol.css 定义 :root 变量等,scoped CSS 可能引用。
  for (const [componentId, cssImports] of Object.entries(thirdPartyCssImports)) {
    byId.set(componentId, cssImports.map(withInlineQuery));
  }
  blocks.forEach((b) => {
    const p = `${pseudoCssPath(b.file, b.index)}?inline`;
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

/** 给 module id 加 `?inline` 后缀(已有 inline 则不重复加;已有 `?` 用 `&` 拼)。 */
function withInlineQuery(id: string): string {
  return /[?&]inline\b/.test(id) ? id : `${id}${id.includes('?') ? '&' : '?'}inline`;
}

export function vueStyleCollector(opts: { vueComponentsRoot: string }): Plugin {
  let code: string | null = null;
  // 伪 CSS 路径(无 query) → style block,供 load() 反查。
  const pseudoBlocks = new Map<string, StyleBlockEntry>();
  // 第三方 CSS 绝对路径(无 query)集合,供 resolveId 重委托时认领。
  const thirdPartyCssPaths = new Set<string>();
  // 传给 vite resolver 的 importer —— 用一个真实 SFC,确保 npm CSS 从 vue-components 包而非 apps/showcase 解析。
  let cssResolutionImporter: string | undefined;
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
      const thirdPartyCssImports = collectThirdPartyCssImports(opts.vueComponentsRoot);
      pseudoBlocks.clear();
      for (const b of blocks) {
        pseudoBlocks.set(pseudoCssPath(b.file, b.index), b);
      }
      thirdPartyCssPaths.clear();
      // 第三方 CSS 路径集合用于 resolveId 拦截 —— 我们要拦下来再用真实 SFC importer 重委托,
      // 否则 vite 会从 apps/showcase 的 node_modules 找 `ol/ol.css`(那里没装),直接报错。
      const vueFiles: string[] = [];
      if (existsSync(opts.vueComponentsRoot) && statSync(opts.vueComponentsRoot).isDirectory()) {
        walkVueFiles(opts.vueComponentsRoot, vueFiles);
      }
      cssResolutionImporter = vueFiles[0];
      for (const cssImports of Object.values(thirdPartyCssImports)) {
        for (const spec of cssImports) {
          thirdPartyCssPaths.add(stripQuery(toPosix(spec)));
        }
      }
      code = generateVueStylesCode(blocks, { root, isProduction }, thirdPartyCssImports);
    },
    async resolveId(id) {
      // 拦截 1:虚拟模块本身。
      if (id === VIRTUAL_VUE_STYLES) return VIRTUAL_VUE_STYLES;
      const cleanId = stripQuery(toPosix(id));
      // 拦截 2:伪 CSS 路径 —— 磁盘上不存在,必须我们认领,否则 vite 解析失败。
      // 原样返回(保留 `?inline` query),让 vite CSS 插件后续能读到 query。
      if (pseudoBlocks.has(cleanId)) return id;
      // 拦截 3:第三方 npm CSS —— 用真实 SFC 文件作 importer 重委托,
      // 让 vite 从 vue-components 包的 node_modules 解析(而非 apps/showcase)。
      if (cssResolutionImporter && /[?&]inline\b/.test(id) && thirdPartyCssPaths.has(cleanId)) {
        const resolved = await this.resolve(id, cssResolutionImporter, { skipSelf: true });
        return resolved ?? undefined;
      }
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
