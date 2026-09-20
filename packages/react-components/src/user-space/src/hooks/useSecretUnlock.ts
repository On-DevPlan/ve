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
//   4. **「是否已设置」持久化**:用户刷新页面后,React state.password 清空,unlocked=false;
//      但后端 users.kv_secret_salt 仍非空。hook 用 store.hasSecretPassword() 在
//      mount 时探测一次,得到真实的「已设置/未设置」——UI 据此显示「首次设置」
//      或「已生效,点击改密」。
//
// 关联: middleware/secret_unlock.go / service/kv/secretbox.go。

import { useCallback, useEffect, useState } from 'react';
import {
  setSecretPasswordProvider,
  clearSecretPassword,
} from '@/api/services/kvV1';
import { useUserSpaceStore } from './useUserSpaceStore';

export type SecretStatus =
  /** 用户从未设置过二级密码(后端 salt 为 NULL)。UI 显示「首次设置」。 */
  | 'unset'
  /** 用户已设置过二级密码(后端 salt 非空),但当前会话未解锁。UI 显示「已生效,点击解锁」。 */
  | 'set-locked'
  /** 用户已设置 + 本会话已解锁(provider 持有密码)。UI 显示「已解锁」。 */
  | 'unlocked';

export interface SecretUnlockState {
  /** 综合状态(三态机,前端只读这一个字段即可分支渲染)。 */
  status: SecretStatus;
  /** 最近一次解锁/改密动作的 error。消费方可 toast。 */
  error: string | null;
  /** 业务操作中(unlock/reset 的 in-flight 标记)。 */
  busy: boolean;
  unlock: (password: string) => Promise<void>;
  reset: (oldPassword: string, newPassword: string) => Promise<{ reEncrypted: number } | null>;
  /** 主动清除当前会话 KEK provider(注销 / 锁屏);不擦后端 salt。 */
  clear: () => void;
  /** 重新探测后端 salt 状态(在 reset/unlock 后可调用,UI 立即反映)。 */
  refresh: () => Promise<void>;
}

export function useSecretUnlock(): SecretUnlockState {
  // 注意: useUserSpaceStore() 返回的是 { groups, defaultGroupId, loading,
  // error, reload, store } 这个聚合对象,真正的 store 句柄在 .store 字段。
  // 之前写成 `const store = useUserSpaceStore()` —— store 变成聚合对象,
  // store.unlockSecret 恒 undefined → 运行期报 "store.unlockSecret is not a function"。
  const { store } = useUserSpaceStore();
  const [password, setPassword] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 同步 provider 给 kvV1Service:把当前 React state.password 透出去。
  // 卸载时(组件树销毁 / 路由切换)也清掉,避免跨用户态残留。
  useEffect(() => {
    setSecretPasswordProvider(() => password);
    return () => {
      clearSecretPassword();
    };
  }, [password]);

  // mount + 登录态变化时探测后端 salt 是否存在。
  // 这里不能直接 await store.hasSecretPassword() 顶层,因为 store 可能在 user 未
  // 登录时是空的;由调用方在 useEffect 里同步。
  const refresh = useCallback(async () => {
    try {
      const has = await store.hasSecretPassword();
      setHasPassword(has);
    } catch {
      // 探测失败(网络/401 等)保持 null,UI 走 unknown 分支。
      setHasPassword(null);
    }
  }, [store]);

  useEffect(() => { void refresh(); }, [refresh]);

  const unlock = useCallback(async (pw: string) => {
    setError(null);
    setBusy(true);
    try {
      await store.unlockSecret(pw);
      setPassword(pw);
      setHasPassword(true);
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
      setPassword(newPw);
      setHasPassword(true);
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
    clearSecretPassword();
  }, []);

  // 三态合并:hasPassword 是 React 异步状态(初始 null=探测中)。
  const status: SecretStatus =
    password !== null ? 'unlocked'
      : hasPassword === true ? 'set-locked'
        : hasPassword === false ? 'unset'
          : 'unset'; // null 也走 unset,UI 仍可点设置

  return {
    status,
    error,
    busy,
    unlock,
    reset,
    clear,
    refresh,
  };
}
