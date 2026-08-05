// shared/router-accessor.ts —— shared 层访问 vue-router 实例的窗口。
//
// 目的:shared 层(无路由依赖,纯横切能力)需要在不直接依赖 router/ 的前提下
// 拿到 router 实例以执行 push/replace。注册时机:createApp().use(App) 之后,
// App.vue 里注册(也只注册一次)。
//
// 不引入 router 包作为依赖 —— 只是 untyped hold(name: any, args: any),保持
// shared → 无路由依赖。

interface RouterLike {
  currentRoute: { value: { path: string; fullPath: string; name?: unknown } };
  push: (to: { name?: unknown; path?: string; query?: Record<string, unknown> }) => Promise<unknown>;
  replace: (to: { name?: unknown; path?: string; query?: Record<string, unknown> }) => Promise<unknown>;
}

let routerInstance: RouterLike | null = null;

export function setRouter(r: RouterLike): void {
  routerInstance = r;
}

export function getRouter(): RouterLike | null {
  return routerInstance;
}
