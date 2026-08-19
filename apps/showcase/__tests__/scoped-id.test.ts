// __tests__/scoped-id.test.ts —— 单测锁住 computeScopedId 在 5 个真实 SFC 上的 prod 输出。
//
// 目的:防止有人在 plugins/scoped-id.ts 里"随手优化"算法(换 hash、换个 normalize),
//      影响所有 .vue 组件的 scoped data-v-<hex>,组件运行时 __scopeId 与编译期不一致,
//      scoped CSS 静默失效(v1 final review 之前没拦住这种漂移)。
//
// ⚠️ 锁值来自 apps/showcase root + v1 算法(createDescriptor in @vitejs/plugin-vue@5.2.4):
//      sha256(normalizePath(relative(root, filename)) + source).substring(0, 8)
//    root 必须是 vite 的 config.root = apps/showcase(vite.config.ts 未显式设 root,
//    默认 process.cwd() = apps/showcase;plugin-vue 与 vue-style-collector 都用它算
//    descriptor.id / scopedId)。任何 .vue 文件改动 + 算法不变 → 锁值也会变;
//    届时必须 PR 同步更新。
//
//    这 5 个值(aed2660f / b3e18dfd / 492642e2 / 442c4847 / a89c26d1)就是 Task 2
//    build 产物 dist/assets/vc-*.css 里真实出现的 scopedId,与运行时 __scopeId 对齐
//    (Task 2 已铁证:7 个组件 chunk ALL ALIGNED)。
//    早期用"仓根"当 root 锁出的 42b507f2 等从不匹配任何真实产物 —— 那是错的:
//    root 用错,path.relative 的相对路径不同 → hash 不同(Fix round 1 修正)。

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { computeScopedId } from '../plugins/scoped-id';

// root 解析(vite.config.ts 未显式设 root,默认 process.cwd() = apps/showcase):
//   - showcaseRoot:作为 computeScopedId 的 root 引用点 —— plugin-vue 的
//     createDescriptor 与本插件的 config.root 都用它算 descriptor.id / scopedId。
//     注意:root 只是 path.relative(root, filename) 的参照,不是文件解析基准,
//     文件路径仍按仓库内绝对路径解析。从 __tests__/ 向上 1 层即 apps/showcase。
//   - repoRoot:仅用于把仓库内相对路径解析成真实文件绝对路径(__tests__/ 向上 3 层)。
const showcaseRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

describe('scoped-id', () => {
  it('locks prod scopedId for 5 real-world SFCs (algorithm + current file contents)', () => {
    // 5 个 fixture:覆盖不同的目录深度与文件名形态(index.vue / *.vue)。
    // 文件用仓库内绝对路径解析;hash 的 root 引用用 apps/showcase(与 vite 一致)。
    //
    // ⚠️ 跨平台 fix:fixture 在 Windows 上首次捕获时文件是 CRLF,linux CI 是 LF。
    //   sha256 包含 raw bytes,直接读盘导致 hash 在两平台不一致。
    //   这里把 source 内容 normalize 到 LF(\r\n → \n)再喂给 computeScopedId:
    //   - 不改生产算法(computeScopedId 仍 byte-faithful 复刻 plugin-vue;
    //     CI 上 plugin-vue 收到的就是 LF,所以 normalize 等价于 plugin-vue 的输入)
    //   - 测试跨平台一致;fixture 锁住"LF 内容"对应的 hash
    //   - 本地 Windows 开发仍按 core.autocrlf 默认(CRLF checkout);
    //     normalize 在测试层把差异抹平,避免开发机 OS 影响 CI 锁值
    const fixtures = [
      {
        rel: 'packages/vue-components/src/china-map/index.vue',
        expected: '56d2f1e2',
      },
      {
        rel: 'packages/vue-components/src/bottom-nav-capsule-v3/index.vue',
        expected: '03e87072',
      },
      {
        rel: 'packages/vue-components/src/mobile-nav-v5/index.vue',
        expected: '9cb8b630',
      },
      {
        rel: 'packages/vue-components/src/parallax-gallery/ParallaxCard.vue',
        expected: '36c878e2',
      },
      {
        rel: 'packages/vue-components/src/gis/ControlPanel.vue',
        expected: '3e275245',
      },
    ];
    for (const fx of fixtures) {
      const abs = path.resolve(repoRoot, fx.rel);
      const raw = fs.readFileSync(abs, 'utf-8');
      const source = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const actual = computeScopedId(showcaseRoot, abs, source, true);
      expect(actual, fx.rel).toBe(fx.expected);
    }
  });

  it('algorithm sanity: same input → same output (deterministic)', () => {
    const abs = path.resolve(repoRoot, 'packages/vue-components/src/china-map/index.vue');
    const raw = fs.readFileSync(abs, 'utf-8');
    const source = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const a = computeScopedId(showcaseRoot, abs, source, true);
    const b = computeScopedId(showcaseRoot, abs, source, true);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{8}$/);
  });

  it('isProduction flag changes the output (prod hashes source, dev does not)', () => {
    const abs = path.resolve(repoRoot, 'packages/vue-components/src/china-map/index.vue');
    const raw = fs.readFileSync(abs, 'utf-8');
    const source = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const devId = computeScopedId(showcaseRoot, abs, source, false);
    const prodId = computeScopedId(showcaseRoot, abs, source, true);
    expect(devId).not.toBe(prodId);
    // prod 把 source 拼进 hash;改 source 必改 prod
    const prodIdOther = computeScopedId(
      showcaseRoot,
      abs,
      source + '\n// touch',
      true,
    );
    expect(prodIdOther).not.toBe(prodId);
  });
});
