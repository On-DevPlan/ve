// 单元测试:manifestPlugin Vite 插件。
// 验证两条不变量:
//   1) 返回的 plugin.name 必须等于 'component-manifest' —— 上层 Vite 用它去重
//   2) buildStart 钩子应该把生成的 manifest 缓存到 plugin.cachedManifest
//      (用于 dev middleware / generateBundle 两路复用)
//
// 这里只测 buildStart 的最浅路径(emit 只在 generateBundle 触发)。
// 注意:configureServer / generateBundle 需要一个真 Vite server,不在单测里覆盖。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { manifestPlugin } from '../src/vite-plugin'; // 被测函数
import { fileURLToPath } from 'node:url'; // URL → 文件系统路径

// import.meta.url 转绝对路径,作为 glob 的 cwd
const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

describe('manifestPlugin', () => {
  it('returns a Vite plugin with name "component-manifest"', () => {
    // 直接调用工厂函数,断言 plugin.name 字符串
    const plugin = manifestPlugin({
      componentRoots: [`${fixtureRoot}/**/component.config.ts`],
    });
    expect(plugin.name).toBe('component-manifest');
  });

  it('buildStart populates cachedManifest', async () => {
    const plugin = manifestPlugin({
      componentRoots: [`${fixtureRoot}/**/component.config.ts`],
    });
    // 造一个"假 this":buildStart 在真 Vite 里由 Rollup 上下文调用,
    // 这里只关心它有没有 emitFile(应该没有 —— emit 只在 generateBundle 里)。
    let emitCalled = false;
    // 用 .call 把 this 替换成最小可用的对象,绕开严格 this 类型检查
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await plugin.buildStart.call({ emitFile: () => { emitCalled = true; } } as any);
    // emit 应该没有触发 —— buildStart 只负责生成 manifest 并缓存
    expect(emitCalled).toBe(false);
    // cachedManifest 必须有值(否则 dev middleware 会一直返回 503)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((plugin as any).cachedManifest).toBeTruthy();
  });
});