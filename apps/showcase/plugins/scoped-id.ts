// plugins/scoped-id.ts —— 集中托管 computeScopedId(scoped 算法)。
//
// 职责(严格限定):
//   单一函数 computeScopedId,字面照搬 v1 vue-style-collector.ts 内的内联实现。
//   抽离原因:v1 算法"事后"校验通过(v1 final reviewer 锁了 5 个真实 SFC 的 prod hex)。
//   但只要 @vitejs/plugin-vue 升一次 hash 算法,v1 scopedId 就静默漂移,
//   组件运行时的 `__scopeId = 'data-v-<id>'` 与编译期注入的选择器不对齐,
//   scoped 失效。
//
//   抽到独立模块后:
//     - Task 2 可以在 vue-style-collector 里复用
//     - scoped-id-guard 可以在 build 期调它做"事前"拦截
//     - scoped-id.test.ts 可以对它做单测锁值(回归保护层)
//
// 算法来源:
//   复刻 @vitejs/plugin-vue@5.2.4 createDescriptor 的 hash 实现:
//   sha256(input).hex.substring(0, 8)。
//   见 node_modules/.pnpm/@vitejs+plugin-vue@.../dist/index.mjs:152-158、63-94。
//
// 兼容性:
//   dev/prod 模式差异:dev 不拼 source(per isProduction),prod 拼。
//   normalizePath 把 \\ → /(win32 兼容;与 vite 内部 slash 实现一致)。
//
// ⚠️ 修改此文件前请三思 —— 它锁住 v1 完整工作 scoped 链路。
//    任何算法变动必须配合 plugins/scoped-id-guard.ts 一并更新,且必须
//    同步把 apps/showcase/package.json 的 @vitejs/plugin-vue 版本钉死。

import path from 'node:path';
import { createHash } from 'node:crypto';

/** 把 \\ 换成 /(win32 兼容;与 vite 内部 slash 实现一致)。 */
function normalizePath(p: string): string {
  return p.split('\\').join('/');
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
  return createHash('sha256').update(normalized + (isProduction ? source : '')).digest('hex').substring(0, 8);
}
