// composables/useRegistry.ts —— 在组件里取回全局 ComponentRegistry 实例的 composable。
//
// 职责:
//   1) 暴露 InjectionKey,让 main.ts 走 app.provide(RegistryKey, registry)
//   2) 提供 useRegistry() 让组件无需通过全局变量,直接拿到 registry
//   3) 在没拿到(忘记 provide)时立即抛错,避免组件层沉默地拿到 undefined 后崩溃
//
// 为什么走 inject/provide 而不是全局单例:
//   - 测试时可以换一个 isolated registry 注入;无需 mock 全局变量
//   - SSR 友好,每次请求一个独立实例
//   - 类型推断稳定 —— inject(RegistryKey) 直接得到 Registry,无需额外 cast

import { inject, type InjectionKey } from 'vue';
import type { Registry } from '../registry/ComponentRegistry';

// 全局 Symbol Key —— Symbol 不会与其他模块的 Key 冲突,也不可被 JSON 序列化
export const RegistryKey: InjectionKey<Registry> = Symbol('Registry');

// 取注册表的 composable。组件内 const registry = useRegistry(); 即可。
export function useRegistry(): Registry {
  const r = inject(RegistryKey);
  if (!r) {
    // 没 provide 时直接抛错 —— 比"返回 undefined 后在某处崩栈"更易定位
    throw new Error(
      'Registry not provided. Call app.provide(RegistryKey, registry) in main.ts.',
    );
  }
  return r;
}