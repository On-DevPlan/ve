// registry/css-collector.ts —— 把组件 CSS 文本映射成 adapter 注入用的 string[]。
//
// 纯函数:不接触 glob / virtual module,便于测试。真实 map 见 css-maps.ts。
// 契约:远程组件(loaderUrl)收集不到构建期 CSS,返回 [] —— adapter 走 adoptStylesInto 兜底。

import type { ManifestEntry } from '@style-library/component-contract';

export interface CssMaps {
  /** loaderKey → 单条 CSS 文本(React:index.css) */
  react: Record<string, string>;
  /** loaderKey → CSS 文本数组(Vue:组件目录下所有 .vue 的 style block) */
  vue: Record<string, string[]>;
}

export function collectCss(entry: ManifestEntry, maps: CssMaps): string[] {
  if (entry.loaderUrl) return [];
  if (entry.framework === 'react') {
    const text = maps.react[entry.loaderKey];
    return text ? [text] : [];
  }
  if (entry.framework === 'vue') {
    return maps.vue[entry.loaderKey] ?? [];
  }
  return [];
}
