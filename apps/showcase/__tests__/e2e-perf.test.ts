// __tests__/e2e-perf.test.ts —— end-to-end performance gate.
//
// Contract verified here (spec §6.3 + §8.1):
//   1) 生产构建必须产出 dist/component-manifest.json
//   2) 必须按 manualChunks 规则拆出每个组件的独立 chunk:
//      - vc-button / vc-heavy-chart
//      - rc-data-table
//   3) 入口 index.html 不能直接引用任何一个组件实现 chunk,
//      否则首屏就会下载所有组件实现,违背 first-paint contract
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

describe('e2e: first paint does not load component implementations', () => {
  beforeAll(() => {
    // 测试前置:dist 必须存在且包含 manifest,否则提示用户先 build
    if (!existsSync(path.join(distDir, 'component-manifest.json'))) {
      throw new Error(
        'dist/component-manifest.json missing. Run: pnpm --filter @style-library/showcase exec vite build',
      );
    }
  });

  it('component-manifest.json exists in dist', () => {
    const content = readFileSync(path.join(distDir, 'component-manifest.json'), 'utf8');
    expect(content.length).toBeGreaterThan(0);
    const manifest = JSON.parse(content);
    expect(manifest.components.length).toBeGreaterThan(0);
  });

  it('dist contains per-component chunks', () => {
    const assetsDir = path.join(distDir, 'assets');
    if (!existsSync(assetsDir)) {
      throw new Error('dist/assets missing — build did not emit any chunks');
    }
    const assets = readdirSync(assetsDir);
    const chunkNames = assets.join(' ');
    // 从 manifest 拿真实组件列表,断言每个组件都有自己的 chunk
    // (之前硬编码 button / heavy-chart / data-table,某次组件删除后测试过期)
    const manifest = JSON.parse(readFileSync(path.join(distDir, 'component-manifest.json'), 'utf8'));
    for (const c of manifest.components as Array<{ id: string; framework: string }>) {
      const prefix = c.framework === 'vue' ? 'vc-' : 'rc-';
      const expected = new RegExp(`${prefix}${c.id}|${c.id}\\.js`);
      expect(chunkNames).toMatch(expected);
    }
  });

  it('entry index.html does not import any component chunk', () => {
    const index = readFileSync(path.join(distDir, 'index.html'), 'utf8');
    // 首页/首屏路由不引用任何组件实现 chunk;具体哪些 id 存在,以 manifest 为准。
    const manifest = JSON.parse(readFileSync(path.join(distDir, 'component-manifest.json'), 'utf8'));
    for (const c of manifest.components as Array<{ id: string }>) {
      expect(index).not.toMatch(new RegExp(c.id));
    }
  });
});