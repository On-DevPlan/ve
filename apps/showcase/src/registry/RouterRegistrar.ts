// registry/RouterRegistrar.ts —— 把 manifest 中的组件路由灌入 vue-router。
//
// 职责:
//   1) 接受一个 vue-router 实例 + ManifestEntry 列表
//   2) 为每个组件添加一条 lazy import 的动态路由
//   3) 路由 meta 上挂 componentId / title,详情页用得到
//
// 设计要点:
//   - 所有详情路由指向同一个 DetailPage.vue(spec §7.4 单页详情壳)
//   - 用 () => import(...) 让详情页本身是单独 chunk;每个组件的实现
//     由 DetailPage 在 onMounted 里按需 import(走 manualChunks 拆分)
//   - 路由 path 直接复用 manifest.route.path —— manifest 是唯一事实来源
//   - addRoute 必须放在 router 启动之后(main.ts 里在 mount 之前调用),
//     否则新路由不会被加入 matcher
//
// 后续可扩展:
//   - 根据 isolation.mode 给 meta 加额外 flag,详情页据此选择挂载策略
//   - 根据 mount.framework 加 framework 标识,DetailPage 据此选择 Vue/React 适配器

import type { Router, RouteRecordRaw } from 'vue-router';
import type { ManifestEntry } from '@style-library/component-contract';

// 一次性把组件路由灌入 vue-router。
export function registerComponentRoutes(
  router: Router,
  entries: readonly ManifestEntry[],
): void {
  for (const e of entries) {
    // path 直接采用 manifest 中的约定(spec §6.2 路由字段)
    const path = e.route.path;
    // 构造一条 RouteRecordRaw;name 加 "Component-" 前缀避免与 home/not-found 重名
    const route: RouteRecordRaw = {
      path,
      name: `Component-${e.id}`,
      // 动态导入 DetailPage.vue —— 由 Vite/manualChunks 单独切走
      component: () => import('../pages/DetailPage.vue'),
      // meta 携带组件 id 与展示标题,详情页取用
      meta: { componentId: e.id, title: e.route.title },
    };
    // addRoute 必须等 router 初始化完成;否则路由匹配不生效
    router.addRoute(route);
  }
}
