// registry/vue-style-collector.ts —— 为 showcase 提供 virtual:vue-styles 的 Vite 插件。
//
// 职责(严格限定):扫描 vue 组件目录下所有 .vue,对每个 <style> block:
//   1) 用 `@vue/compiler-sfc` 的 compileStyle 自带 postcss 编译,
//      并注入 id `data-v-<scopedId>`(scoped 选择器)
//   2) 把编译结果打包进虚拟模块的 export const sN = "<css>"
//   3) 模块末尾 export default Record<componentId, string[]>(给 css-maps.ts 消费)
//
// 为什么不走 `import '*.vue?vue&type=style&...&inline'` query 形态:
//   vite CSS 插件的 isCSSRequest 正则只匹配 \.(css|less|sass|...)(?:$|\?),
//   `xxx.vue?vue&type=style&index=0&lang.css&inline` 扩展名是 .vue,
//   无任何插件把 raw CSS 包成 JS,rollup 拿到 raw CSS 直接当 JS 解析,
//   在 @import url(...) 处报 `Expected ident` 失败(Task 5 复现)。
//
//   自写 scoped 编译可绕开 isCSSRequest 边界,且 scopedId 算法必须与
//   @vitejs/plugin-vue@5.2.4 的 descriptor.id 完全一致,
//   否则组件运行时的 `__scopeId = 'data-v-<id>'` 与编译期注入的选择器不对齐,
//   scoped 失效。

import { parse, compileStyle } from '@vue/compiler-sfc';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const VIRTUAL_VUE_STYLES = 'virtual:vue-styles';

export interface StyleBlockEntry {
  componentId: string;
  file: string; // .vue 绝对路径
  index: number; // style block 在 SFC 内的序号
  lang: string; // 'css' | 'scss' | ...
  scoped: boolean; // <style scoped>
  content: string; // 原始 CSS 文本
  source: string; // .vue 全文;production 模式参与 scopedId
}

/** 把 \\ 换成 /(win32 兼容;与 vite 内部 slash 实现一致)。 */
function normalizePath(p: string): string {
  return p.split('\\').join('/');
}

/**
 * 复刻 @vitejs/plugin-vue@5.2.4 createDescriptor 的 hash 实现:
 * sha256(input).hex.substring(0, 8)。
 * 见 node_modules/.pnpm/@vitejs+plugin-vue@.../dist/index.mjs:152-158。
 */
function getHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 8);
}

/**
 * 计算组件的 scopedId,与 @vitejs/plugin-vue@5.2.4 的 descriptor.id 100% 一致。
 * dev:   sha256(normalizePath(relative(root, filename))).substring(0, 8)
 * prod:  sha256(normalizePath(relative(root, filename)) + source).substring(0, 8)
 * 源:createDescriptor(index.mjs:76-91) → descriptor.id = getHash(normalizedPath + (isProduction ? source : ""))
 */
export function computeScopedId(
  root: string,
  filename: string,
  source: string,
  isProduction: boolean,
): string {
  const normalized = normalizePath(path.relative(root, filename));
  return getHash(normalized + (isProduction ? source : ''));
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
 * 显式排序保证 virtual module 的 style 文本顺序与组件 id 数组跨平台可复现。
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
 * 生成 virtual module 源码:每个 style block 一行 `export const sN = <scoped css>`,
 * 末尾 `export default Record<componentId, [sN, ...]>`。
 * 编译走 @vue/compiler-sfc 的 compileStyle(自带 postcss 8 + modules),
 * 注入 id=`data-v-<scopedId>` 使 scoped 选择器在编译期生效。
 *
 * 注意:`preprocessLang` 仅在仓库实际引入 scss/less/sass/styl/stylus 时生效;
 * 当前仓库 0 个 SFC 用了 preprocessor,所以缺包时走默认 fallback 也不影响 fixture。
 */
export function generateVueStylesCode(
  blocks: StyleBlockEntry[],
  opts: { root: string; isProduction: boolean },
): string {
  const byId = new Map<string, string[]>();
  const decls: string[] = [];
  blocks.forEach((b, i) => {
    const scopedId = computeScopedId(opts.root, b.file, b.source, opts.isProduction);
    const result = compileStyle({
      filename: b.file,
      source: b.content,
      id: `data-v-${scopedId}`,
      scoped: b.scoped,
      isProd: opts.isProduction,
      preprocessLang:
        b.lang === 'scss' ||
        b.lang === 'less' ||
        b.lang === 'sass' ||
        b.lang === 'styl' ||
        b.lang === 'stylus'
          ? b.lang
          : undefined,
    });
    if (result.errors.length) {
      throw new Error(
        `compileStyle failed for ${b.file} block #${b.index}: ${result.errors.map((e) => e.message).join('; ')}`,
      );
    }
    decls.push(`export const s${i} = ${JSON.stringify(result.code)};`);
    const arr = byId.get(b.componentId) ?? [];
    arr.push(`s${i}`);
    byId.set(b.componentId, arr);
  });
  const entries = [...byId.entries()]
    .map(([id, refs]) => `  ${JSON.stringify(id)}: [${refs.join(', ')}],`)
    .join('\n');
  return `${decls.join('\n')}\n\nexport default {\n${entries}\n};\n`;
}

export function vueStyleCollector(opts: { vueComponentsRoot: string }): Plugin {
  let code: string | null = null;
  return {
    name: 'vue-style-collector',
    configResolved(config) {
      const blocks = collectVueStyleBlocks(opts.vueComponentsRoot);
      code = generateVueStylesCode(blocks, {
        root: config.root,
        isProduction: config.command === 'build',
      });
    },
    resolveId(id) {
      if (id === VIRTUAL_VUE_STYLES) return VIRTUAL_VUE_STYLES;
    },
    load(id) {
      if (id === VIRTUAL_VUE_STYLES) return code ?? '';
    },
  };
}