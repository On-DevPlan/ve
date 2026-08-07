// plugins/scoped-id-guard.ts —— scoped-id 算法安全网。
//
// 职责(严格限定):
//   提供一个 Vite 插件 scopedIdGuard(),在 transform 阶段扫 SFC 产物,
//   从产物里抽 __scopeId,再用本地 computeScopedId 复算,对不上就 this.error()。
//   触发场景:build 期 @vitejs/plugin-vue 升了一次,改了 hash 算法,scoped 链路静默漂移,
//   组件运行时的 __scopeId 与编译期注入的选择器不对齐(scoped 失效)。
//
//   Task 1 只备工具不注册到 vite.config.ts,Task 2 才注册——避免改运行路径零风险。
//
// 算法配合:
//   SCOPE_RE 抓 transform 产物中的 __scopeId = "data-v-<8 位 hex>"。
//   本地 computeScopedId 来自 './scoped-id'(字节级照搬 @vitejs/plugin-vue@5.2.4 hash 实现)。
//
// ⚠️ 此 guard 隐含一个版本契约:computeScopedId 锁定的 hash 必须与
//    package.json 里钉死的 @vitejs/plugin-vue 版本对齐。
//    升 plugin-vue 必须同时升 computeScopedId(否则 build 必挂)。

import fs from 'node:fs';
import type { Plugin, ResolvedConfig } from 'vite';
import { computeScopedId } from './scoped-id';

const SCOPE_RE = /__scopeId\s*=\s*["']data-v-([0-9a-f]{8})["']/;

export function scopedIdGuard(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'sl:scoped-id-guard',
    enforce: 'post',
    configResolved(c) {
      config = c;
    },
    transform(code, id) {
      if (!id.endsWith('.vue') || id.includes('?')) return null;
      const m = SCOPE_RE.exec(code);
      if (!m) return null; // SFC 无 scoped style
      const actual = m[1];
      let source: string;
      try {
        source = fs.readFileSync(id, 'utf-8');
      } catch {
        return null; // 文件被删/移动,跳过
      }
      const ours = computeScopedId(config.root, id, source, config.isProduction);
      if (ours !== actual) {
        this.error(
          `[scoped-id-guard] scopedId 算法与 @vitejs/plugin-vue 漂移。\n` +
          `  文件: ${id}\n` +
          `  plugin-vue: data-v-${actual}\n` +
          `  本地实现: data-v-${ours}\n` +
          `  请同步 computeScopedId() 并锁定 plugin-vue 版本。`,
        );
      }
      return null;
    },
  };
}
