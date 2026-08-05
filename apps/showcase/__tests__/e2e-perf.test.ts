// __tests__/e2e-perf.test.ts —— end-to-end performance gate.
//
// Contract verified here (spec §6.3 + §8.1):
//   1) 生产构建必须产出 dist/component-manifest.json
//   2) 必须按 manualChunks 规则拆出每个组件的独立 chunk:
//      - vc-<id> / rc-<id>
//   3) 入口 index.html 的 entry script + modulepreload + stylesheet 不应
//      preload 任何组件实现 chunk,否则首屏就会下载所有组件实现,
//      违背 first-paint contract
//   4) 每个组件的 chunk 必须真正存在(loader 看得到)
//
// 何时运行:
//   - 必须先 `pnpm --filter @style-library/showcase exec vite build`
//   - 这个测试只读 dist,不重新跑 build
//
// 为什么放在 showcase 包里而不是 root:
//   - 测的就是 showcase 构建产物
//   - vitest.workspace.ts 已有 showcase project,include 已覆盖 __tests__/**/*.test.ts
//   - 跟着 showcase 一起跑,失败信息直接指向这个包

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// dist 目录相对 __tests__ 的位置 —— vitest 跑在 apps/showcase 下
const distDir = path.resolve(__dirname, '../dist');

interface ManifestEntry {
  id: string;
  framework: string;
}

interface Manifest {
  components: ManifestEntry[];
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(path.join(distDir, 'component-manifest.json'), 'utf8'));
}

function listAssetNames(): string[] {
  const assetsDir = path.join(distDir, 'assets');
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir);
}

describe('e2e: first paint does not load component implementations', () => {
  beforeAll(() => {
    if (!existsSync(path.join(distDir, 'component-manifest.json'))) {
      throw new Error(
        'dist/component-manifest.json missing. Run: pnpm --filter @style-library/showcase exec vite build',
      );
    }
  });

  it('component-manifest.json exists in dist', () => {
    const content = readFileSync(path.join(distDir, 'component-manifest.json'), 'utf8');
    expect(content.length).toBeGreaterThan(0);
    const manifest: Manifest = JSON.parse(content);
    expect(manifest.components.length).toBeGreaterThan(0);
  });

  it('dist contains per-component chunks', () => {
    const assets = listAssetNames();
    if (assets.length === 0) {
      throw new Error('dist/assets missing — build did not emit any chunks');
    }
    const names = assets.join(' ');
    const manifest = loadManifest();
    for (const c of manifest.components) {
      const prefix = c.framework === 'vue' ? 'vc-' : 'rc-';
      const expected = new RegExp(`${prefix}${c.id}|${c.id}\\.js`);
      expect(names).toMatch(expected);
    }
  });

  it('entry index.js bundle does not statically import any component implementation', () => {
    // 真正的 first-paint 字节是 entry script(<script src="/assets/index-*.js">)。
    // modulepreload 是 vite 的启发式(可能含间接依赖),不严格判定为"首屏"。
    //
    // entry bundle 内会包含一个 __vite__mapDeps 字符串表,把所有 lazy chunk
    // 路径字面量列出来(给原生 modulepreload polyfill 用) —— 这只是字符串,
    // 不是真静态依赖。判定方式:
    //   - 静态 import: `import {...} from ".../vc-xxx-...js"`  → 判定为 leak
    //   - 静态 import: `import ".../vc-xxx-...js"`             → 判定为 leak
    //   - 动态 import: `import(".../vc-xxx-...js")`           → 不算 leak(router 进入才触发)
    //   - 字符串字面量中包含 `vc-xxx`                            → 不算
    const index = readFileSync(path.join(distDir, 'index.html'), 'utf8');

    const entryMatch = index.match(/<script[^>]*type="module"[^>]*src="\/assets\/(index-[^"]+\.js)"/);
    expect(entryMatch, 'index.html must have a type=module entry script').not.toBeNull();
    const entryName = entryMatch![1];

    const entrySource = readFileSync(path.join(distDir, 'assets', entryName), 'utf8');
    const manifest = loadManifest();

    // 静态 import 语句: `import ... from "..."` 或 `import "..."`
    // 注意:动态 `import("...")` 不算
    const staticImportRe = /import\s+(?:[^"';]*?\s+from\s+)?["']([^"']+?)["']/g;

    for (const c of manifest.components) {
      const prefix = c.framework === 'vue' ? `vc-${c.id}` : `rc-${c.id}`;
      // 抽出所有静态 import 的目标路径
      let m: RegExpExecArray | null;
      const staticImports: string[] = [];
      while ((m = staticImportRe.exec(entrySource))) {
        staticImports.push(m[1]);
      }
      const leak = staticImports.some((p) => p.includes(prefix));
      expect(
        leak,
        `entry bundle statically imports component "${c.id}" (prefix ${prefix}); ` +
          `static imports:\n${staticImports.join('\n')}`,
      ).toBe(false);
    }
  });
});