// manifest-generator —— 构建期"manifest 生成器"。
// 对应 spec §6.1 第 3~5 步:
//   validator(已由 scanner 完成)→
//   resolver(这里把 ComponentConfig 提升为 ManifestEntry,补全 route / isolation / assets)→
//   generator(输出 ComponentManifest)。
//
// 输出结构必须符合 packages/component-contract/src/manifest.schema.json。
// ajv 输出校验由 vite-plugin.ts 在 buildStart 异步阶段执行(那里能 dynamic import ajv)。

import type {
  ComponentManifest, // 完整 manifest 类型
  ManifestEntry, // 单条 manifest 记录
  ManifestGroup, // 分组
} from '@style-library/component-contract';
import type { ScannedConfig } from './scanner.ts'; // 扫描结果

// 生成器选项
//   - buildId: 唯一构建标识,用来 dev/prod 比对是否同一份产物
//   - outDir:  目标输出目录(本文件暂未直接写盘,由 Vite plugin 决定怎么写到 outDir)
export interface GeneratorOptions {
  buildId: string;
  outDir: string;
}

// ajv 输出校验在 vite-plugin.ts 里调(那里是 async 上下文,能 dynamic import ajv)。
// 见 packages/manifest-generator/src/vite-plugin.ts 的 validateManifestOutput()。

// 入口:把 ScannedConfig[] 聚合成 ComponentManifest
export function generateManifest(
  scanned: ScannedConfig[],
  opts: GeneratorOptions,
): ComponentManifest {
  // 第一步:id 去重(构建期阻断,见 spec §11.1 "重复 id")
  const seen = new Set<string>();
  for (const s of scanned) {
    if (seen.has(s.config.id)) {
      throw new Error(`Duplicate component id: ${s.config.id}`);
    }
    seen.add(s.config.id);
  }

  // 第二步:把 ComponentConfig 提升为 ManifestEntry,补全默认字段
  const entries: ManifestEntry[] = scanned.map((s) => {
    const cfg = s.config;
    return {
      id: cfg.id,
      name: cfg.name,
      title: cfg.title,
      description: cfg.description,
      version: cfg.version,
      framework: cfg.framework,
      group: cfg.group,
      category: cfg.category,
      tags: cfg.tags,
      status: cfg.status,
      platform: cfg.platform ?? 'both',
      preview: cfg.preview,
      // route 未声明时按约定补 /components/<id>
      route: cfg.route ?? { path: `/components/${cfg.id}`, title: cfg.title },
      mount: cfg.mount,
      // isolation 默认 shadow-dom(spec §10.5 默认值)
      isolation: cfg.isolation ?? { mode: 'shadow-dom' },
      theme: cfg.theme,
      capabilities: cfg.capabilities,
      assets: {
        // entry chunk 路径约定为 assets/<id>.js
        entryChunk: `assets/${cfg.id}.js`,
        cssChunks: [],
      },
      // loaderKey 与 id 同名,详情页用 loaders[id] 时直接走它
      loaderKey: cfg.id,
      // 透传远程 loader URL(若有);loaders.ts 的 setLoaders 会优先用它覆盖 glob 条目
      loaderUrl: cfg.loaderUrl,
    };
  });

  // 第三步:按 group 分组,顺便收集 category 集合
  const groupMap = new Map<string, { ids: string[]; categories: Set<string> }>();
  for (const e of entries) {
    const g = groupMap.get(e.group) ?? { ids: [], categories: new Set() };
    g.ids.push(e.id);
    g.categories.add(e.category);
    groupMap.set(e.group, g);
  }
  const groups: ManifestGroup[] = [...groupMap.entries()].map(([title, v]) => ({
    id: slugify(title), // 中文 group 转 slug id
    title,
    componentIds: v.ids,
    categories: [...v.categories],
  }));

  // 第四步:返回最终 manifest
  const manifest: ComponentManifest = {
    schemaVersion: '1.0', // 与 manifest.schema.json 保持一致
    generatedAt: new Date().toISOString(), // 构建期时间戳
    buildId: opts.buildId, // 调用方传入的构建 id
    components: entries,
    groups,
    search: {
      // 声明可被搜索的字段(spec §5 SearchManifest)
      fields: ['title', 'description', 'tags', 'group', 'category'],
      normalized: true, // 搜索时已做标准化(大小写、空白)
    },
  };

  // 第五步:ajv 输出校验移到 vite-plugin(那里是 async,可以 await dynamic import 加载 ajv)。
  // generator 保持纯同步函数;schema 校验是构建期闸门,由调用方负责触发。

  return manifest;
}

// 简易 slugify:把 "数据展示" 这类字符串转成 "data-display" 之类的稳定 id
// 纯 ASCII 输入时用首词+数字,纯非 ASCII 输入时用 djb2 哈希兜底
// (保证不同标题产生不同且非空的 id,避免重复 group 撞车)
function slugify(s: string): string {
  const ascii = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (ascii.length > 0) return ascii;
  // 纯中文 / 其它非 ASCII 标题:用 djb2 哈希 8 位 hex + 长度后缀
  // 例:"数据可视化" → "group-1f3a8b2c-5"
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `group-${hex}-${s.length}`;
}