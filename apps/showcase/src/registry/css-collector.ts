// registry/css-collector.ts —— 把组件 CSS 懒加载成 adapter 注入用的 string[]。
//
// 纯函数:不接触 glob / virtual module,便于测试。真实 map 见 css-maps.ts。
// 契约:远程组件(loaderUrl)收集不到构建期 CSS,返回 [] —— adapter 走 adoptStylesInto 兜底。
// 评审 #6:CSS map 改 per-component 懒加载;loader 解析后再交回 DetailPage,宿主不再 eager 全量。

import type { ManifestEntry } from '@style-library/component-contract';

export interface CssMaps {
  /** loaderKey → 懒加载 loader:resolve 后是 CSS 文本数组 */
  react: Record<string, () => Promise<string[]>>;
  /** loaderKey → 懒加载 loader:resolve 后是 CSS 文本数组(组件目录下所有 .vue 的 style block) */
  vue: Record<string, () => Promise<string[]>>;
}

export async function collectCss(entry: ManifestEntry, maps: CssMaps): Promise<string[]> {
  if (entry.loaderUrl) return [];           // 远程组件:宿主不管理 CSS,adapter 兜底
  const map = entry.framework === 'react' ? maps.react : maps.vue;
  const loader = map[entry.loaderKey];
  if (!loader) {
    if (import.meta.env.DEV) {
      console.warn(`[css-collector] 未找到 ${entry.loaderKey} 的 CSS,可能扫描根未覆盖`);
    }
    return [];
  }
  return loader();
}
