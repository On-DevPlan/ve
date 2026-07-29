// mount-adapters —— Adapter 工厂与选择器。
// 对应 spec §2.1 "MountAdapterFactory"。
//
// 两个对外能力:
//   1) createAdapters():一次性建好 [Vue, React] adapter 列表
//      Host 在 mount 时持有这个列表
//   2) selectAdapter(adapters, framework):根据 framework 找对应 adapter
//      找不到时抛错(spec §9 "framework 与 mount.kind 不一致" 应在构建期阻断,
//      运行时这里只是兜底)

import type {
  Framework, // 'vue' | 'react'
  MountAdapter, // 统一挂载协议
} from '@style-library/component-contract';
import { createVueMountAdapter } from './VueMountAdapter.ts'; // Vue 适配器工厂
import { createReactMountAdapter } from './ReactMountAdapter.ts'; // React 适配器工厂

// 工厂:返回 [Vue adapter, React adapter]
// Host 启动时调一次,持有这个数组
export function createAdapters(): MountAdapter[] {
  return [createVueMountAdapter(), createReactMountAdapter()];
}

// 选择器:遍历 adapter,挑出 canHandle(framework) === true 的那一个
// 兜底:manifest-generator 已经在构建期校验 framework 与 mount.kind 一致,
// 这里找不到 adapter 通常意味着 manifest 数据被破坏,抛错而不是 fallback
export function selectAdapter(adapters: MountAdapter[], framework: Framework): MountAdapter {
  const found = adapters.find((a) => a.canHandle(framework));
  if (!found) {
    // 显式抛错,Host 用 ErrorBoundary 捕获并显示错误页
    throw new Error(`No adapter found for framework: ${framework}`);
  }
  return found;
}