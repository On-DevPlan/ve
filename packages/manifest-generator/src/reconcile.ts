// manifest-generator —— Manifest / Loader Inventory 对账器。
// 对应 docs/architecture/manifest-loader-reconciliation.md §4.2:
//   输入 ComponentManifest + LoaderEntry[],输出 ReconcileReport,
//   把两边按 id 集合做交叉,产出三组:一致 / 单边有 / 单边缺。
//
// 用 Set 运算做 O(n+m),n = manifest.components.length, m = loaderInventory.length,
// 仓库规模下两个值都在 0~100 量级,常数次 map/filter 足够。
//
// 两类不一致的处理策略不一样:
//   - inManifestButNoLoader → 错误(throw):
//     运行时详情页加载会 "No loader registered for X",把错误延迟到打开页面才暴露;
//     在构建期阻断可以把这个失败模式"消灭在开发者侧"。
//   - inLoaderButNoManifest → 警告(console.warn,不计为错误):
//     这是"有人写了 index.vue 但还没加 component.config.ts"的过渡状态,
//     常见于新组件动工阶段;硬阻断会让这种迭代体验很差。
//     等价错误信息:组件永远进不了 showcase,但既然作者没声明这是组件,放行更友好。
//     错误信息由 vite-plugin.ts 在 regenerateManifest 里拼出,见 §4.3 样例。

import type { ComponentManifest } from '@style-library/component-contract'; // 产物类型
import type { LoaderEntry } from './loader-inventory.ts'; // 上一步的扫描产物

// 对账报告。
//   - inManifestButNoLoader:  manifest 有 config 但没有对应 index.{vue,tsx}
//   - inLoaderButNoManifest:  index.{vue,tsx} 存在但没有对应 config(过渡状态)
//   - consistent:             两边都对得上
export interface ReconcileReport {
  inManifestButNoLoader: string[];
  inLoaderButNoManifest: string[];
  consistent: string[];
}

// 对账主入口。
//   - manifest:         已生成的 ComponentManifest
//   - loaderInventory:  buildLoaderInventory 的结果
//   返回 ReconcileReport —— 由调用方(vite-plugin.ts)决定哪些字段升级为 throw/warn。
export function reconcile(
  manifest: ComponentManifest,
  loaderInventory: LoaderEntry[],
): ReconcileReport {
  // 用 Set 做 O(1) 存在性查询
  const manifestIds = new Set(manifest.components.map((c) => c.id));
  const loaderIds = new Set(loaderInventory.map((l) => l.id));

  // 三组都用同一份过滤,按 id 集合交集分类
  const inManifestButNoLoader: string[] = [];
  const inLoaderButNoManifest: string[] = [];
  const consistent: string[] = [];
  for (const id of manifestIds) {
    if (loaderIds.has(id)) consistent.push(id);
    else inManifestButNoLoader.push(id);
  }
  for (const id of loaderIds) {
    if (!manifestIds.has(id)) inLoaderButNoManifest.push(id);
  }
  // 三组都按字典序排一下:报错输出更稳定,便于截图比对
  inManifestButNoLoader.sort();
  inLoaderButNoManifest.sort();
  consistent.sort();
  return { inManifestButNoLoader, inLoaderButNoManifest, consistent };
}