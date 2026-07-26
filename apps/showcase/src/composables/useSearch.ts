// composables/useSearch.ts —— 在组件里取回全局 SearchIndex 实例的 composable。
//
// 职责:
//   1) 暴露 InjectionKey,让 main.ts 走 app.provide(SearchKey, search)
//   2) 提供 useSearch() 让 SearchBar / GroupFilter / CardGrid 直接共享同一个状态
//   3) 没拿到时立即抛错,便于在 main.ts 漏配时第一时间发现
//
// 设计取舍:
//   - query / group 都是 ref,所以多个组件共用同一个实例时,
//     一处修改处处生效 —— 这就是"全局搜索状态"的语义

import { inject, type InjectionKey } from 'vue';
import type { SearchIndexReturn } from '../registry/SearchIndex';

export const SearchKey: InjectionKey<SearchIndexReturn> = Symbol('Search');

export function useSearch(): SearchIndexReturn {
  const s = inject(SearchKey);
  if (!s) {
    throw new Error(
      'Search not provided. Call app.provide(SearchKey, search) in main.ts.',
    );
  }
  return s;
}