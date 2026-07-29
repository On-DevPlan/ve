// composables/useLoaders.ts —— 在组件里取回全局 LoadersMap 的 composable。
//
// 与 useRegistry / useSearch 同模式:
//   1) 暴露 InjectionKey,让 main.ts 走 app.provide(LoadersKey, ...)
//   2) 提供 useLoaders() 让 DetailPage 直接拿到 loaders 引用
//   3) 没拿到时立即抛错,便于在 main.ts 漏配时第一时间发现

import { inject } from 'vue';
import { LoadersKey, type LoadersMap } from '../registry/loaders';

export function useLoaders(): LoadersMap {
  const l = inject(LoadersKey);
  if (!l) {
    throw new Error(
      'Loaders not provided. Call app.provide(LoadersKey, loaders) in main.ts.',
    );
  }
  return l;
}