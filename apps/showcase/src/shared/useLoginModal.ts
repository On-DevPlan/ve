// shared/useLoginModal.ts —— 登录入口触发器(跨框架)。
//
// 路由式:登录不再是全局模态,而是路由 /login。openLoginModal() 内部
// router.push('/login')(保留 from query 让登录后能回原页);closeLoginModal()
// 通知订阅者(React 端 useSyncExternalStore 用)。Vue 端改用 useRouter() 直调,
// 不再需要 isOpen reactive state(没有模态可挂)。

import { getRouter } from './router-accessor';

const subscribers = new Set<(v: boolean) => void>();

function notify(open: boolean): void {
  for (const cb of subscribers) cb(open);
}

/** 打开登录 —— 路由 push /login,带 from query 让登录后能回原页 */
export function openLoginModal(): void {
  const router = getRouter();
  if (router && typeof window !== 'undefined') {
    if (window.location.pathname === '/login') {
      // 已在 /login,只通知订阅者(React 端可能用)
      notify(true);
      return;
    }
    const from = window.location.pathname + window.location.search + window.location.hash;
    router.push({
      name: 'login',
      query: from && from !== '/login' ? { from } : undefined,
    });
  }
  notify(true);
}

/** 关闭登录 —— 关闭函数名保留(React 端 useLoginModal().close());纯通知订阅者 */
export function closeLoginModal(): void {
  notify(false);
}

/** Vue 端 route-based 状态:open/close 走路由,isOpen 留接口对齐(React 端订阅) */
export function useLoginModalState() {
  return { open: openLoginModal, close: closeLoginModal };
}

export function subscribeLoginModal(cb: (v: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** React 端 useSyncExternalStore 用的快照:isOpen 等价于当前路径 === '/login' */
export function getLoginModalSnapshot(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === '/login';
}
