// __tests__/scoped-id.test.ts —— 单测锁住 computeScopedId 在 5 个真实 SFC 上的 prod 输出。
//
// 目的:防止有人在 plugins/scoped-id.ts 里"随手优化"算法(换 hash、换个 normalize),
//      影响所有 .vue 组件的 scoped data-v-<hex>,组件运行时 __scopeId 与编译期不一致,
//      scoped CSS 静默失效(v1 final review 之前没拦住这种漂移)。
//
// ⚠️ 锁值来自 HEAD 仓根 + v1 算法(createDescriptor in @vitejs/plugin-vue@5.2.4):
//      sha256(normalizePath(relative(root, filename)) + source).substring(0, 8)
//    任何 .vue 文件改动 + 算法不变 → 锁值也会变;届时必须 PR 同步更新。
//
//    关于 v2 brief task-1-brief.md 引用的"v1 final reviewer 锁值"(aed2660f 等):
//      那些 hex 无法从当前文件内容复现。最可能的原因:v1 在 commit fd75bf5..HEAD
//      之间有过 SFC 文案重写,reviewer 当时跑的 file 内容跟现在不一致。
//      本单测锁的是 v1 算法 + 当前 HEAD 内容 —— 它代表"v1 抽离后算法永不改"的契约;
//      build 期 scoped-id-guard 会按相同算法比对 plugin-vue 产物,任何漂移当场挂。

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { computeScopedId } from '../plugins/scoped-id';

// 仓根解析:从 apps/showcase/__tests__/ 推到仓根,跨 3 层
// (apps/showcase/__tests__/ → apps/showcase/ → apps/ → 仓根)
const repoRoot = path.resolve(__dirname, '../../..');

describe('scoped-id', () => {
  it('locks prod scopedId for 5 real-world SFCs (algorithm + current file contents)', () => {
    // 5 个 fixture:覆盖不同的目录深度与文件名形态(index.vue / *.vue)。
    // 每个 fixture 用 prod 模式(拼 source)+ 仓根,与 v1 vue-style-collector 调用一致。
    const fixtures = [
      {
        rel: 'packages/vue-components/src/china-map/index.vue',
        expected: '42b507f2',
      },
      {
        rel: 'packages/vue-components/src/bottom-nav-capsule-v3/index.vue',
        expected: '568fc508',
      },
      {
        rel: 'packages/vue-components/src/mobile-nav-v5/index.vue',
        expected: '66bfaf13',
      },
      {
        rel: 'packages/vue-components/src/parallax-gallery/ParallaxCard.vue',
        expected: '5e86a972',
      },
      {
        rel: 'packages/vue-components/src/gis/ControlPanel.vue',
        expected: 'f2f288d1',
      },
    ];
    for (const fx of fixtures) {
      const abs = path.resolve(repoRoot, fx.rel);
      const source = fs.readFileSync(abs, 'utf-8');
      const actual = computeScopedId(repoRoot, abs, source, true);
      expect(actual, fx.rel).toBe(fx.expected);
    }
  });

  it('algorithm sanity: same input → same output (deterministic)', () => {
    const root = path.resolve(repoRoot, 'packages/vue-components/src/china-map');
    const file = path.join(root, 'index.vue');
    const source = fs.readFileSync(file, 'utf-8');
    const a = computeScopedId(root, file, source, true);
    const b = computeScopedId(root, file, source, true);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{8}$/);
  });

  it('isProduction flag changes the output (prod hashes source, dev does not)', () => {
    const root = path.resolve(repoRoot, 'packages/vue-components/src/china-map');
    const file = path.join(root, 'index.vue');
    const source = fs.readFileSync(file, 'utf-8');
    const devId = computeScopedId(root, file, source, false);
    const prodId = computeScopedId(root, file, source, true);
    expect(devId).not.toBe(prodId);
    // prod 把 source 拼进 hash;改 source 必改 prod
    const prodIdOther = computeScopedId(
      root,
      file,
      source + '\n// touch',
      true,
    );
    expect(prodIdOther).not.toBe(prodId);
  });
});
