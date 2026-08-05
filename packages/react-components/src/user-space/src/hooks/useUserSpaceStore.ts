// src/hooks/useUserSpaceStore.ts —— user-space 业务封装 hook。
//
// 封装 createUserSpaceStore() + 自动 subscribe 登录态变化:
//   - 登录/登出后重新拉 groups(default group 解析依赖 jwtUser)
//   - 404(default groupId 未返)时静默回退到 null
//
// 注意:不缓存 store —— 每次调用 createUserSpaceStore() 拿到的都是同一个
// 无状态 facade;hook 只承担"登录态变化时触发 reload"这一项副作用。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUserSpaceStore } from '@api/components/user-space';
import type { GroupSummary } from '@api/components/user-space';
import { useJwtAuth } from './useAuth';

export interface UseUserSpaceStoreResult {
  /** null = 游客态(组件应展示登录引导);[] = 已登录但还没拉到组 */
  groups: GroupSummary[] | null;
  defaultGroupId: number | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  store: ReturnType<typeof createUserSpaceStore>;
}

export function useUserSpaceStore(): UseUserSpaceStoreResult {
  const auth = useJwtAuth();
  const store = useMemo(() => createUserSpaceStore(), []);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 防止已卸载组件 setState
  const aliveRef = useRef(true);

  const reload = useCallback(async () => {
    if (auth.jwtAuthState !== 'logged-in' || !auth.token) {
      setGroups(null);
      setDefaultGroupId(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, defaultId] = await Promise.all([
        store.listGroups(),
        store.getDefaultGroupId(),
      ]);
      if (!aliveRef.current) return;
      setGroups(list);
      setDefaultGroupId(defaultId);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : 'load failed');
      setGroups([]);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [auth.jwtAuthState, auth.token, store]);

  // 登录态变化(token 切 / 拿到 user info)时重新拉
  useEffect(() => {
    aliveRef.current = true;
    void reload();
    return () => {
      aliveRef.current = false;
    };
  }, [reload]);

  return { groups, defaultGroupId, loading, error, reload, store };
}
