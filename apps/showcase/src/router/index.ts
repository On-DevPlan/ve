// router/index.ts —— showcase 的 vue-router 4 初始化入口。
//
// 职责:
//   1) 创建一个 HTML5 history 模式的 Router
//   2) 预置两条路由:/ 走 HomePage;通配走 NotFoundPage
//   3) 详情页路由由 RouterRegistrar 在 manifest 加载完成后动态追加
//
// 为什么 detail 不在这里写:
//   - detail 的数量与路径由 manifest 决定(spec §6.2),构建期未知
//   - 写死会与 manifest 漂移;放在 RouterRegistrar 里集中维护
//
// 调用方:
//   - main.ts 里 import 这个 router,然后 app.use(router)
//   - 之后调用 registerComponentRoutes(router, entries),再 router.isReady

import { createRouter, createWebHistory } from 'vue-router';

// 全局 router 实例 —— 单一来源,所有页面/组件都通过 useRouter() 拿
export const router = createRouter({
  // HTML5 history 模式:URL 干净(/components/button),需要后端 fallback
  history: createWebHistory(),
  routes: [
    // 首页 —— 加载组件列表与搜索/筛选
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    // 通配 404 —— 任何未命中路由都落这里(顺序必须在最后)
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
    },
  ],
});
