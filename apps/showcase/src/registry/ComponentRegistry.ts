// registry/ComponentRegistry.ts —— showcase 全局组件注册表。
//
// 职责:
//   1) 持有一份由 manifest 灌入的 ManifestEntry 列表(ref 包裹,响应式)
//   2) 暴露 registerManifest / listMetadata / get 三个操作
//   3) 卡片层只读不写;只有 manifest 加载成功后调用一次 registerManifest
//
// 设计取舍:
//   - 用工厂函数 + ref 而不是 class,因为 Vue 3 推崇 composition API;
//     返回的对象可以直接被组件解构使用,无需 inject/provide 桥接。
//   - ref<ManifestEntry[]>([]) 而不是 ref<readonly ManifestEntry[]>([]):
//     内部要 replace 整个数组,外部只读由 readonly 修饰符表达。
//   - 工厂闭包持有 entries,避免全局单例(便于测试隔离与未来 SSR)。

import type { ComponentManifest, ManifestEntry } from '@style-library/component-contract';
import { ref, type Ref } from 'vue';

// 工厂签名:返回的对象是注册表的"实例",包含 ref 与方法。
export function createRegistry() {
  // ref 数组 —— 组件层用 v-for 遍历,搜索/过滤等都基于这个 ref
  const entries: Ref<ManifestEntry[]> = ref([]);

  // 用整个 manifest 灌入,只取 components 数组(spec §6.2 manifest schema)
  function registerManifest(manifest: ComponentManifest): void {
    entries.value = manifest.components;
  }

  // 只读视图:返回原数组的浅引用,但签名上声明 readonly,提醒调用方不要原地改
  function listMetadata(): readonly ManifestEntry[] {
    return entries.value;
  }

  // 按 id 查找 —— 详情页路由守卫、CardGrid 跳转逻辑都用得到
  function get(id: string): ManifestEntry | undefined {
    return entries.value.find((e) => e.id === id);
  }

  return { entries, registerManifest, listMetadata, get };
}

// 注册表实例的类型别名 —— 工厂的返回类型自动推导,这里起名便于传参
export type Registry = ReturnType<typeof createRegistry>;
