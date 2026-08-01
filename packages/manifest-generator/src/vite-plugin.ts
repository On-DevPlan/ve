// manifest-generator —— Vite 插件入口。
// 对应 spec §6.1 manifest 生成流水线的"dev 中间件 + 生产 emit"两端:
//   1) buildStart:       在 dev/build 启动时跑 scanner + generator,把结果缓存到 plugin.cachedManifest
//   2) configureServer:  给 dev server 注册一个 GET /__component-manifest.json 中间件;
//                        watcher 监听 component.config.ts 变化,变化后重新 buildStart 并 full-reload
//   3) generateBundle:   生产构建结束时把缓存的 manifest 序列化成 component-manifest.json emit 到产物
//
// 整个插件的设计要点:
//   - 缓存是单例(plugin.cachedManifest),dev 与 build 共用同一份逻辑
//   - 不发 HMR:component.config.ts 是结构数据,改完直接 full-reload 最简单,避免增量更新错误
//   - 抽出 regenerateManifest() 给 buildStart 与 watcher 共用,避免在生产代码里 cast any

import fs from 'node:fs'; // 读 manifest.schema.json
import path from 'node:path'; // resolve schema 路径
import { fileURLToPath } from 'node:url'; // URL → 路径
import type { Plugin, ViteDevServer } from 'vite'; // Vite 插件类型
import { scanConfigs } from './scanner.ts'; // 扫描 + 校验
import { generateManifest } from './generator.ts'; // 生成 manifest
import { buildLoaderInventory } from './loader-inventory.ts'; // 扫 loader(对账用)
import { reconcile } from './reconcile.ts'; // manifest ↔ loader 对账
import type { ComponentManifest } from '@style-library/component-contract'; // 产物类型

// ajv 输出校验器缓存(module-level,首次调用后复用)。
// ESM 无 require,用 dynamic import 加载 ajv;在 vite-plugin 的 async 上下文里 await。
let _validateManifest: ((data: unknown) => { ok: boolean; errors: string[] }) | null | undefined;
async function getManifestValidator() {
  if (_validateManifest !== undefined) return _validateManifest;
  try {
    const schemaPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'component-contract',
      'src',
      'manifest.schema.json',
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const AjvModule = await import('ajv');
    const Ajv = (AjvModule as { default: typeof import('ajv').default }).default;
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    _validateManifest = (data: unknown) => ({
      ok: validate(data) as boolean,
      errors: validate(data) ? [] : (validate.errors ?? []).map((e) => JSON.stringify(e)),
    });
  } catch {
    _validateManifest = null;  // 基础设施失败(ajv 装不上),永久降级
  }
  return _validateManifest;
}

// 校验 manifest 输出形状;失败 throw(走 buildStart),初始化失败 warn 不阻断。
async function validateManifestOutput(manifest: ComponentManifest): Promise<void> {
  const validate = await getManifestValidator();
  if (!validate) {
    console.warn('[manifest-generator] output validation skipped: ajv unavailable');
    return;
  }
  const result = validate(manifest);
  if (!result.ok) {
    throw new Error(`Generated manifest failed schema validation:\n${result.errors.join('\n')}`);
  }
}

// 插件配置项
//   - componentRoots: 传给 scanConfigs 的 glob 列表(例如 ['packages/vue-components/**/component.config.ts'])
//   - buildId:        注入到 manifest.buildId;不传则用 'dev'
//   - resolveAssetUrl: 可选 hook,manifest 生成后对每条 entry 的 entryChunk 做二次修正
//                      (生产构建里手动分 chunk 后,真实路径可能不是 assets/<id>.js)
export interface ManifestPluginOptions {
  componentRoots: string[];
  buildId?: string;
  /** Hook to patch component.entryChunk asset URLs after manifest generation. */
  resolveAssetUrl?: (componentId: string, suggested: string) => string;
}

// 工厂函数:返回带 cachedManifest 字段的 Vite 插件
export function manifestPlugin(opts: ManifestPluginOptions): Plugin & {
  cachedManifest: ComponentManifest | null;
} {
  // 抽出"扫描 → 生成 → 写缓存"的纯函数,buildStart 与 watcher 都调它
  // 这样既能在 Vite 钩子里复用,也能在文件变化回调里直接调(不需要伪造 this)
  async function regenerateManifest(): Promise<void> {
    // 第一步:扫描所有 component.config.ts
    const scanned = await scanConfigs({ roots: opts.componentRoots });
    // 第二步:聚合 manifest(buildId 缺省用 'dev')
    const manifest = generateManifest(scanned, {
      buildId: opts.buildId ?? 'dev',
      outDir: 'dist',
    });
    // 第三步:如果配置了 resolveAssetUrl,对每条 entry 做一次修正
    if (opts.resolveAssetUrl) {
      for (const entry of manifest.components) {
        entry.assets.entryChunk = opts.resolveAssetUrl(entry.id, entry.assets.entryChunk);
      }
    }
    // 第三点五步:ajv 校验 manifest 输出形状(P2-3)。
    // 失败 throw(走 buildStart 透传);初始化失败(ajv 装不上)→ warn 不阻断。
    await validateManifestOutput(manifest);
    // 第四步:扫 loader → 与 manifest 对账(P0,见 docs/architecture/manifest-loader-reconciliation.md)
    //   loaderRoots = .../src/<id>/component.config.ts → .../src
    //   与 server.watcher.add 用的提取逻辑保持一致(同样把 /*/component.config.ts 尾巴去掉)
    const loaderRoots = opts.componentRoots.map(extractSrcDir);
    const inventory = await buildLoaderInventory(loaderRoots);
    const report = reconcile(manifest, inventory);
    // inManifestButNoLoader 是硬错:运行时详情页会 "No loader registered for X",
    // 在构建期阻断,把错误暴露给作者而不是用户。
    if (report.inManifestButNoLoader.length > 0) {
      throw new Error(formatMismatchError(report.inManifestButNoLoader, scanned));
    }
    // inLoaderButNoManifest 是警告:可能是有人写了 index.vue 还没补 component.config.ts,
    // 不阻断但提醒(典型于新组件动工阶段的过渡状态)。
    if (report.inLoaderButNoManifest.length > 0) {
      console.warn(
        `[manifestPlugin] Loaders exist without manifest entry: ${report.inLoaderButNoManifest.join(', ')}\n` +
          '  These index.{vue,tsx} files have no component.config.ts — add metadata to make them visible in the showcase.',
      );
    }
    // 写缓存(供 dev middleware / generateBundle 读)
    plugin.cachedManifest = manifest;
  }

  // 用对象字面量而不是 class,这样 Vite 不会 new 它、还能挂任意字段
  const plugin: Plugin & { cachedManifest: ComponentManifest | null } = {
    // 必填:Vite 用 plugin.name 去重
    name: 'component-manifest',
    // 缓存:初始 null —— 配置 server middleware 时,buildStart 还没跑过,
    // 此时请求 manifest 会得到 503(见 configureServer)
    cachedManifest: null,

    // buildStart 钩子:dev 与 prod 都跑(生产构建一开始也会调)
    // 内部 this 由 Rollup 注入,包含 emitFile 等工具方法(本钩子里不用)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async buildStart(_opts?: unknown) {
      await regenerateManifest();
      // 注:这里不调 this.emitFile —— emit 只在 generateBundle 里发生,
      // 这样 buildStart 失败时不会往产物里写入半成品
    },

    // configureServer 钩子:仅 dev 跑(被 Vite dev server 调用)
    // server.middlewares 是 connect 实例,server.watcher 是 chokidar 包装,server.ws 是 ws server
    configureServer(server: ViteDevServer) {
      // dev 路由:GET /__component-manifest.json
      const route = '/__component-manifest.json';
      // watcher debounce 计时器(文件写入竞态合并)
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      server.middlewares.use(route, (_req, res) => {
        // 缓存还没准备好(比如 buildStart 第一次还没跑完)就返回 503
        if (!plugin.cachedManifest) {
          res.statusCode = 503;
          res.end('{}');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(plugin.cachedManifest));
      });

      // 文件监听:component.config.ts 增/删/改 → 重新生成 manifest → full-reload
      // 必须同时监听 add(新组件)和 unlink(删组件),否则 dev server 运行时
      // 加减组件会让 manifest 过期,与 import.meta.glob 不同步。
      //
      // Vite watcher 默认只监听 server root(apps/showcase),但组件源码在
      // packages/*-components/(root 之外),必须显式 watcher.add 才能收到事件。
      const watchRoots = opts.componentRoots.map(extractSrcDir);
      server.watcher.add(watchRoots);

      const onConfigChange = (file: string) => {
        // 用 includes 简单过滤(Windows 路径都含 component.config 字串)
        if (!file.includes('component.config')) return;
        // debounce 200ms:文件写入瞬间可能多次触发 add/change(尤其 Windows),
        // 合并成一次 regenerate,避开"文件未写完就被 import"的竞态。
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          // fire-and-forget:重新跑 regenerate;失败由 Vite 自己报错
          //
          // 注意:这里必须包 try/catch,因为 watcher 回调是 fire-and-forget,
          // regenerateManifest 现在会在对账失败时 throw(见上面第四步)。
          // 那种 throw 是 dev server "本次扫描" 的失败,不是 dev server 本身的失败;
          // 透传上去会被 Vite 当作未捕获异常,可能让 dev server 抖动甚至退到报错页。
          // 用 console.error 把错误吃掉,保留 cachedManifest 上一次的可用值,
          // 作者改完后下次 watcher 触发自然就恢复。
          void regenerateManifest().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[manifestPlugin] regenerate failed (cached manifest kept):\n${msg}`);
          });
          // 让浏览器整页重载 —— 不发 HMR 是因为 manifest 是结构数据,组件级增量更新容易漏
          server.ws.send({ type: 'full-reload' });
        }, 200);
      };
      server.watcher.on('add', onConfigChange);
      server.watcher.on('change', onConfigChange);
      server.watcher.on('unlink', onConfigChange);
    },

    // generateBundle 钩子:仅生产构建跑
    generateBundle(this: { emitFile: (asset: { type: 'asset'; fileName: string; source: string }) => void }) {
      // 缓存未就绪 → 跳过(理论上不应该发生 —— buildStart 先跑)
      if (!plugin.cachedManifest) return;
      // 把 manifest 序列化成 component-manifest.json 作为静态资源 emit
      this.emitFile({
        type: 'asset',
        fileName: 'component-manifest.json',
        source: JSON.stringify(plugin.cachedManifest, null, 2),
      });
    },
  };
  return plugin;
}

// 格式化"manifest 有但 loader 缺"的错误信息。
// 模板见 docs/architecture/manifest-loader-reconciliation.md §4.3:
//   - 列出每个缺失的组件 id
//   - 指出应该在哪个目录里找 index.{vue,tsx}
//   - 给出两种修复路径(创建 entry 或删除 config)
//
// 这里用每个 component.config.ts 的目录路径做定位,而不是 inventory(因为
// inventory 恰恰不含这些 id),调用方在 regenerateManifest 里把 scanned 传进来。
function formatMismatchError(
  missingIds: string[],
  scanned: Array<{ filePath: string; configDir: string }>,
): string {
  // 反查表:从 scanned 里抽出 id → configDir 的映射(scanConfigs 已经把这条带回来了)
  const dirById = new Map<string, string>();
  for (const s of scanned) {
    // configDir 是 component.config.ts 的父目录,<id>/component.config.ts → <id>
    // 用 basename 而不是 s.config.id:对账是按 id 算的,但这里想要的是物理路径,
    // 走 basename 更稳,避免出现命名不一致(config.id !== 目录名)这种小毛病时反查不到。
    const { id, configDir } = extractIdAndDir(s);
    dirById.set(id, configDir);
  }
  const lines: string[] = [];
  lines.push('[manifestPlugin] Manifest/Loader mismatch detected:');
  lines.push('');
  lines.push(`  in manifest but no loader (${missingIds.length}):`);
  for (const id of missingIds) {
    const configDir = dirById.get(id);
    const where = configDir ? configDir : `packages/{vue,react}-components/src/${id}`;
    lines.push(
      `    - ${id} (component.config.ts exists at ${where}, but the matching index.{vue,tsx} is missing in the same directory)`,
    );
  }
  lines.push('');
  lines.push('These would cause runtime errors like:');
  lines.push('  "No loader registered for X" when opening detail page');
  lines.push('  silent invisibility — card never shows up');
  lines.push('');
  lines.push('Fix:');
  lines.push('  - Create index.{vue,tsx} in the component directory (matching the framework in its config)');
  lines.push('  - Or remove the entry from component.config.ts if the component is abandoned');
  lines.push('');
  lines.push('Refusing to provide stale manifest. Exiting.');
  return lines.join('\n');
}

// 从 ScannedConfig 里拆出 id(从 config.id 或目录名兜底) + configDir。
// 用 instanceof + in 检查代替 typeof narrowing,以适配 loose-typed 的 fixture 测试。
function extractIdAndDir(s: { filePath: string; configDir: string; config?: unknown }): {
  id: string;
  configDir: string;
} {
  // config 可能是 undefined(测试里只塞了 {filePath, configDir} 的最小对象),
  // 这种情况下用目录名兜底。
  const cfg = s.config as { id?: string } | undefined;
  const id = cfg?.id ?? s.configDir.split(/[\\/]/).pop() ?? '<unknown>';
  return { id, configDir: s.configDir };
}

// 把 componentRoots 里的 glob 尾巴去掉,得到要扫的"src/"父目录。
//   例:.../vue-components/src/*/component.config.ts   → .../vue-components/src
//      .../fixtures/**/component.config.ts           → .../fixtures
//
// 同时处理单星 * 和双星 ** 两种 glob(生产用单星,测试 fixture 用双星)。
// 返回的字符串可能含通配符:此时调用方应当容忍;本函数不做通配符展开,
// 因为 server.watcher.add 和 buildLoaderInventory 都支持目录路径(glob 由各自内部处理)。
function extractSrcDir(root: string): string {
  const normalized = root.replace(/\\/g, '/');
  // 把 /*/component.config.ts 或 /**/component.config.ts 尾巴去掉
  return normalized.replace(/\/\*+\/component\.config\.ts$/, '');
}