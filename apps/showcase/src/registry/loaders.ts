// registry/loaders.ts —— import.meta.glob 自动发现所有组件 + manifest 远程覆写。
//
// 静态组件:Vite 在构建时扫描 packages/*/src/*/index.{vue,tsx},各自打成独立 chunk。
//   加组件 = 写 component.config.ts + index.vue,再无其他步骤。
// 远程组件:manifest 中 entry.loaderUrl 不为空时覆盖 glob 条目。
//
// 为什么不用 manifest 推导 import 路径?
//   Vite 分包需要字面量 import() 字符串。manifest 是运行时 JSON,
//   编译时无法用于分包。import.meta.glob 是 Vite 原生方案,
//   构建时自动扫描文件系统并生成静态 import() 映射。

import type { ComponentManifest } from '@style-library/component-contract';
import { type InjectionKey } from 'vue';

/** 组件 loader:惰性 import,返回 ESM 模块 */
type ComponentLoader = () => Promise<unknown>;

// Vite 构建时扫描,按路径生成静态 import 表
// 注意:import.meta.glob 不支持 @ alias,必须用相对路径
const vueModules = import.meta.glob('../../../../packages/vue-components/src/*/index.vue');
const reactModules = import.meta.glob('../../../../packages/react-components/src/*/index.tsx');

export type LoadersMap = Record<string, ComponentLoader>;

function scanToMap(): LoadersMap {
  const map: LoadersMap = {};
  for (const [path, loader] of Object.entries(vueModules)) {
    const id = path.match(/\/src\/([^/]+)\/index\.vue$/)?.[1];
    if (id) map[id] = loader as ComponentLoader;
  }
  for (const [path, loader] of Object.entries(reactModules)) {
    const id = path.match(/\/src\/([^/]+)\/index\.tsx$/)?.[1];
    if (id) map[id] = loader as ComponentLoader;
  }
  return map;
}

const globLoaders = scanToMap();

/** 合并 glob 自动发现的 loader + manifest 中的 loaderUrl 覆写;返回值供 app.provide 使用 */
export function setLoaders(manifest?: ComponentManifest): LoadersMap {
  if (!manifest) return globLoaders;
  const merged = { ...globLoaders };
  for (const entry of manifest.components) {
    if (entry.loaderUrl) {
      merged[entry.loaderKey] = () => import(/* @vite-ignore */ entry.loaderUrl!);
    }
  }
  return merged;
}

/** Vue 注入 key,main.ts 用 app.provide(LoadersKey, ...) 注入 */
export const LoadersKey: InjectionKey<LoadersMap> = Symbol('Loaders');
