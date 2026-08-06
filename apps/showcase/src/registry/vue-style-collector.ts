// registry/vue-style-collector.ts —— 为 showcase 提供 virtual:vue-styles 的 Vite 插件。
//
// 职责(严格限定):扫描 vue 组件目录下所有 .vue,统计每个 <style> block,
// 生成一个聚合 virtual module,其内容是对每个 style block 的
// `?vue&type=style&index=N&lang.<lang>&inline` import + `export default Record<id, string[]>`。
//
// 为什么不自己编译 scoped:scopedId 由 @vitejs/plugin-vue 在编译期生成,复刻其
// 内部 hash 算法脆弱。走标准 import query 时,编译完全由 vue plugin + vite CSS
// 完成,data-v-xxx 与组件运行时天然一致。

import { parse } from '@vue/compiler-sfc';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const VIRTUAL_VUE_STYLES = 'virtual:vue-styles';

export interface StyleBlockEntry {
  componentId: string;
  file: string; // .vue 绝对路径
  index: number; // style block 在 SFC 内的序号
  lang: string; // 'css' | 'scss' | ...
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
      const count = countStyleBlocks(file);
      for (let index = 0; index < count; index++) {
        const src = readFileSync(file, 'utf-8');
        const { descriptor } = parse(src, { filename: file });
        const lang = descriptor.styles[index]?.lang ?? 'css';
        entries.push({ componentId, file, index, lang });
      }
    }
  }
  return entries;
}

/** 生成 virtual module 源码:import 每条 style block + export default Record<id, string[]>。 */
export function generateVueStylesCode(blocks: StyleBlockEntry[]): string {
  const imports: string[] = [];
  const byId = new Map<string, string[]>();
  blocks.forEach((b, i) => {
    // win32 下 path.join 产生反斜杠绝对路径;导入说明符归一化为正斜杠,
    // 避免原始反斜杠进入 virtual module 源码(vite:resolve 能兜底但不保证)。
    const file = b.file.replaceAll('\\', '/');
    const query = `${file}?vue&type=style&index=${b.index}&lang.${b.lang}&inline`;
    imports.push(`import s${i} from ${JSON.stringify(query)};`);
    const arr = byId.get(b.componentId) ?? [];
    arr.push(`s${i}`);
    byId.set(b.componentId, arr);
  });
  const entries = [...byId.entries()]
    .map(([id, refs]) => `  ${JSON.stringify(id)}: [${refs.join(', ')}],`)
    .join('\n');
  return `${imports.join('\n')}\n\nexport default {\n${entries}\n};\n`;
}

export function vueStyleCollector(opts: { vueComponentsRoot: string }): Plugin {
  let code: string | null = null;
  const build = (): string => {
    const blocks = collectVueStyleBlocks(opts.vueComponentsRoot);
    return generateVueStylesCode(blocks);
  };
  return {
    name: 'vue-style-collector',
    resolveId(id) {
      if (id === VIRTUAL_VUE_STYLES) return VIRTUAL_VUE_STYLES;
    },
    load(id) {
      if (id === VIRTUAL_VUE_STYLES) return (code ??= build());
    },
  };
}
