// src/hooks/useSecretUnlock.ts —— 全局二级密码会话(2026-09-19)。
//
// 设计原则:
//   1. **UI 一次输入,后续自动**:用户首次输入二级密码调 store.unlockSecret() →
//      通过 setSecretPasswordProvider 把密码钉到 provider 上 → 所有后续 KV
//      请求自动带 X-Secret-Password header → server 端中间件派生 KEK 入 ctx + LRU。
//      不需要每个组件弹窗、不需要在每个请求前手动加 header。
//   2. **密码不进存储**:password 只在 React state 临时持有,provider 闭包持有引用,
//      锁屏/路由切换/登出都应 clearSecretPassword()。绝不入 localStorage。
//   3. **改密码**:用 store.resetSecret(oldPassword, newPassword) → 后端事务内
//      全表重加密 → 成功后用新密码替换 provider(旧密码过期,服务端会拒)。
//
// 这是 user-space 模块的内部 hook(没 export 给其他组件域),因为:
//   - 它绑定了 userSpaceStore(consumer 已知 store)
//   - 仅 KV 域需要;其他模块用不到二级密码
//   - 不需要复杂的 React context,直接用模块单例足够

import { useCallback, useEffect, useState } from 'react';
import {
  setSecretPasswordProvider,
  clearSecretPassword,
} from '@/api/services/kvV1';
import { useUserSpaceStore } from './useUserSpaceStore';

export interface SecretUnlockState {
  /** 当前是否已设置 provider(密码在内存里)。 */
  unlocked: boolean;
  /** 最近一次解锁/改密动作的 error。消费方可 toast。 */
  error: string | null;
  /** 业务操作中(unlock/reset 的 in-flight 标记)。 */
  busy: boolean;
  unlock: (password: string) => Promise<void>;
  reset: (oldPassword: string, newPassword: string) => Promise<{ reEncrypted: number } | null>;
  /** 主动清除(注销 / 锁屏)。 */
  clear: () => void;
}

/**
 * 全局二级密码会话 hook。挂载后:
 *   - 注入 provider(把当前 React state 里的密码透出给 kvV1Service 的请求)
 *   - 卸载时清除 provider(避免组件树销毁后旧引用残留)
 *   - 任意调用方可以反复 unlock / reset / clear,状态会更新
 *
 * 注意:password 不暴露给 React 树外的任何东西。provider 闭包持有的就是 hook 内
 * 的 state.password,React 重渲时会刷新闭包。clear 时同步 clearSecretPassword。
 */
export function useSecretUnlock(): SecretUnlockState {
  // 注意: useUserSpaceStore() 返回的是 { groups, defaultGroupId, loading,
  // error, reload, store } 这个聚合对象,真正的 store 句柄在 .store 字段。
  // 之前写成 `const store = useUserSpaceStore()` —— store 变成聚合对象,
  // store.unlockSecret 恒 undefined → 运行期报 "store.unlockSecret is not a function"。
  const { store } = useUserSpaceStore();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 同步 provider 给 kvV1Service:把当前 React state.password 透出去。
  // 卸载时(组件树销毁 / 路由切换)也清掉,避免跨用户态残留。
  useEffect(() => {
    setSecretPasswordProvider(() => password);
    return () => {
      // 卸载不清 state(避免 React 警告),只清 provider;React 自己回收 state。
      clearSecretPassword();
    };
  }, [password]);

  const unlock = useCallback(async (pw: string) => {
    setError(null);
    setBusy(true);
    try {
      await store.unlockSecret(pw);
      setPassword(pw); // 仅在 server 端确认后才注入 provider
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPassword(null);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [store]);

  const reset = useCallback(async (oldPw: string, newPw: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await store.resetSecret(oldPw, newPw);
      // 旧密码已废(后端事务里 salt 重生,旧 KEK 派生空间失效),立刻注入新密码
      setPassword(newPw);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPassword(null);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [store]);

  const clear = useCallback(() => {
    setPassword(null);
    setError(null);
    clearSecretPassword();
  }, []);

  return {
    unlocked: password !== null,
    error,
    busy,
    unlock,
    reset,
    clear,
  };
}
