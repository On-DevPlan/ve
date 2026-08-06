// useShortcuts.ts —— shortcut-library 数据层 React 适配。
//
// 数据落点由 host 的 JWT 态决定:
//   - 已登录(jwtAuth.state.token 存在)→ 用 createShortcutStore(内部调 user-space
//     getShortcuts/setShortcuts,经 user-space 的 KV 句柄存取,整库 JSON)
//   - 游客(无 token)→ 自动降级用 LSStore(本地缓存),登录后无缝迁回 cloud store
//   - 所有现有 export(findBindingsByCode / comboKey / comboLabel / ImportStats)
//     保持稳定,既有调用方零改动

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from '../types';
import type { ImportParseResult } from '../engine/import-parser';
import { LSStore, type ImportStats, type ShortcutStore } from '../engine/store';
import { createShortcutStore } from '@api/components/shortcut-library/createShortcutStore';
import { useJwtAuth } from './useAuth';

export type { ImportStats };

function freshId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * 策略:activeStore 由 host JWT 态决定(useJwtAuth 读 token)。
 *   - token 存在 → cloud store(createShortcutStore,内部调 user-space)
 *   - token 不存在 → LSStore(游客本地缓存)
 * 登录 / 登出时 token 变化 → effect 自动切换 activeStore 并重 load。
 * 写操作都走 activeStore;游客模式下天然落本地。
 */
export function useShortcuts() {
  const auth = useJwtAuth();
  const cloudStore = useMemo(() => createShortcutStore(), []);
  const lsStore = useMemo(() => new LSStore(), []);

  const [activeStore, setActiveStore] = useState<ShortcutStore>(lsStore);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  // 同步模式:auto = 改即同步(原行为);manual = 改本地不立即同步,需点 Save
  const [saveMode, setSaveModeState] = useState<'auto' | 'manual'>('auto');
  // dirty:自上次 save 以来是否改过。manual 模式 + dirty → Save 按钮亮起
  const [dirty, setDirty] = useState(false);
  // 退出前是否提醒未保存改动(默认开,持久化到 LS)
  const [warnOnDirtyExit, setWarnOnDirtyExitState] = useState<boolean>(() => {
    try { return localStorage.getItem('sl-userkv:v1:warnOnDirtyExit') !== '0'; } catch { return true; }
  });
  // 把 toggle 写到 LS
  const setWarnOnDirtyExit = useCallback((v: boolean) => {
    setWarnOnDirtyExitState(v);
    try { localStorage.setItem('sl-userkv:v1:warnOnDirtyExit', v ? '1' : '0'); } catch { /* ignore */ }
  }, []);
  // 保存中的 promise,UI 显示 loading
  const [saving, setSaving] = useState(false);

  // 切换 mode 时,如果 dirty 且新 mode = auto → 立即 flush
  const setSaveMode = useCallback(
    (m: 'auto' | 'manual') => {
      setSaveModeState(m);
      // 切到 auto 时把 dirty 状态 flush 一次(用户体验:不要让"切回 auto 之前还丢数据")
      if (m === 'auto' && dirty) {
        void flushDirty();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dirty],
  );

  // 启动 + token 变化:按 JWT 态选 activeStore 并 load。
  // 关键依赖 `auth.jwtAuthState`,不只是 `auth.token`:
  //   - jwtAuth.init() 是 fire-and-forget(main.ts 里),存在一个「token 落 ref
  //     已设但 jwtUser 还在拉 /user/info」的中间态。
  //   - 如果只看 token,init 期间 useShortcuts 会选 cloudStore,然后
  //     userSpace.getShortcuts() 的 requireAuth() 抛 not logged in,导致
  //     页面空白 + 不会自动重试(init 完后再变 activeStore 没有触发源)。
  //   - 把 jwtAuthState 也加入依赖,init 完成态变 → effect 重跑 → 再调一次
  //     cloudStore.load(),这次 jwtUser 已就位,真正发请求。
  useEffect(() => {
    let cancelled = false;
    const store = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
    setActiveStore(store);
    (async () => {
      try {
        const g = await store.load();
        if (!cancelled) setGroups(g);
      } catch (e) {
        console.error('[useShortcuts] load failed:', e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.token, auth.jwtAuthState, cloudStore, lsStore]);

  // token 变化(登录/登出)→ 保证 activeStore 指向正确的 store 实现
  useEffect(() => {
    const want = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
    setActiveStore((prev) => (prev === want ? prev : want));
  }, [auth.token, auth.jwtAuthState, cloudStore, lsStore]);

  // 登出 → reset saveMode + dirty(但不弹窗 — 退出确认已经在 banner 按钮的
  // onClick 里处理了,这里只负责清理 + 重新 load)。
  useEffect(() => {
    const loggedOut = activeStore === lsStore;
    if (loggedOut) {
      setSaveModeState('auto');
      setDirty(false);
    }
    let cancelled = false;
    (async () => {
      try {
        const g = await activeStore.load();
        if (!cancelled) setGroups(g);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[useShortcuts] reload failed:', msg);
      }
    })();
    return () => { cancelled = true; };
  }, [activeStore, lsStore]);

  // 自动选中(第一个 / 刚创建的)
  useEffect(() => {
    if (selectedGroupId && groups.some((g) => g.id === selectedGroupId)) return;
    setSelectedGroupId(groups[0]?.id ?? null);
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  // 把当前 dirty 状态批量 push 到 active store;返回 Promise 给 UI 错误处理用
  const flushDirty = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      // 用 setGroups 回调的 prev 拿最新值——避免闭包过期
      let snapshot: Group[] = [];
      setGroups((prev) => {
        snapshot = prev;
        return prev;
      });
      await activeStore.save(snapshot);
      setDirty(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[useShortcuts] save failed:', msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [activeStore, dirty]);

  const mutate = useCallback(
    (updater: (prev: Group[]) => Group[]) => {
      setGroups((prev) => {
        const next = updater(prev);
        setDirty(true);
        // auto 模式 → 立即同步;manual → 只标 dirty,不调 save
        if (saveMode === 'auto') {
          void activeStore.save(next).catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[useShortcuts] save failed:', msg);
          });
        }
        return next;
      });
    },
    [activeStore, saveMode],
  );

  const addGroup = useCallback((name: string) => {
    const now = Date.now();
    const g: Group = {
      id: freshId(),
      name: name.trim() || '未命名',
      shortcuts: [],
      createdAt: now,
      updatedAt: now,
    };
    mutate((prev) => [...prev, g]);
    setSelectedGroupId(g.id);
    return g;
  }, [mutate]);

  const renameGroup = useCallback(
    (id: string, name: string) => {
      mutate((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, name: name.trim() || g.name, updatedAt: Date.now() } : g,
        ),
      );
    },
    [mutate],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      mutate((prev) => prev.filter((g) => g.id !== id));
    },
    [mutate],
  );

  const addShortcut = useCallback(
    (groupId: string, combo: KeyStroke[], description: string, condition?: string) => {
      const s: Shortcut = {
        id: freshId(),
        combo,
        description: description.trim(),
        condition: condition?.trim() || undefined,
        createdAt: Date.now(),
      };
      mutate((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, shortcuts: [...g.shortcuts, s], updatedAt: Date.now() }
            : g,
        ),
      );
      return s;
    },
    [mutate],
  );

  const updateShortcut = useCallback(
    (
      groupId: string,
      shortcutId: string,
      patch: Partial<Pick<Shortcut, 'combo' | 'description' | 'condition'>>,
    ) => {
      mutate((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                shortcuts: g.shortcuts.map((sc) =>
                  sc.id === shortcutId
                    ? {
                        ...sc,
                        ...patch,
                        condition:
                          patch.condition === undefined
                            ? sc.condition
                            : patch.condition.trim() || undefined,
                        description:
                          patch.description === undefined
                            ? sc.description
                            : patch.description.trim(),
                      }
                    : sc,
                ),
                updatedAt: Date.now(),
              }
            : g,
        ),
      );
    },
    [mutate],
  );

  const deleteShortcut = useCallback(
    (groupId: string, shortcutId: string) => {
      mutate((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, shortcuts: g.shortcuts.filter((sc) => sc.id !== shortcutId), updatedAt: Date.now() }
            : g,
        ),
      );
    },
    [mutate],
  );

  const importGroups = useCallback(
    (data: ImportParseResult): ImportStats => {
      const stats: ImportStats = {
        groupsAdded: 0,
        groupsAppended: 0,
        shortcutsAdded: 0,
        errors: [...data.errors],
      };
      mutate((prev) => {
        const next = [...prev];
        for (const g of data.groups) {
          const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
          if (existing) {
            const added = g.shortcuts.map((s) => ({
              id: freshId(),
              combo: s.combo,
              description: s.description,
              condition: s.condition,
              createdAt: Date.now(),
            }));
            existing.shortcuts = [...existing.shortcuts, ...added];
            existing.updatedAt = Date.now();
            stats.groupsAppended++;
            stats.shortcutsAdded += added.length;
          } else {
            const now = Date.now();
            const shortcuts = g.shortcuts.map((s) => ({
              id: freshId(),
              combo: s.combo,
              description: s.description,
              condition: s.condition,
              createdAt: now,
            }));
            next.push({ id: freshId(), name: g.name, shortcuts, createdAt: now, updatedAt: now });
            stats.groupsAdded++;
            stats.shortcutsAdded += shortcuts.length;
          }
        }
        return next;
      });
      return stats;
    },
    [mutate],
  );

  return {
    groups,
    selectedGroupId,
    selectedGroup,
    setSelectedGroupId,
    query,
    setQuery,
    addGroup,
    renameGroup,
    deleteGroup,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    importGroups,
    ready,
    // 同步模式控制(plan CB)
    saveMode,
    setSaveMode,
    dirty,
    saving,
    flushDirty,
    // 设置面板(plan SettingsPanel)
    warnOnDirtyExit,
    setWarnOnDirtyExit,
  };
}

// 反查 helper: 给定一个 KeyboardEvent.code,找出全部分组下包含这个 code 的 Shortcut。
// 返回的顺序按 group 顺序 + group.shortcuts 顺序,与 UI 列表一致。
// 长按 popup 用这个渲染映射列表。
export interface BindingHit {
  groupId: string;
  groupName: string;
  shortcutId: string;
  comboLabel: string;
  description: string;
  condition?: string;
}

export function findBindingsByCode(groups: Group[], code: string): BindingHit[] {
  const hits: BindingHit[] = [];
  for (const g of groups) {
    for (const s of g.shortcuts) {
      if (s.combo.some((k) => k.code === code)) {
        hits.push({
          groupId: g.id,
          groupName: g.name,
          shortcutId: s.id,
          comboLabel: comboLabel(s.combo),
          description: s.description,
          condition: s.condition,
        });
      }
    }
  }
  return hits;
}

// 序列化 combo 为可比较的字符串(用于冲突检测与搜索)
export function comboKey(combo: KeyStroke[]): string {
  return combo.map((k) => k.code).join('+');
}
export function comboLabel(combo: KeyStroke[]): string {
  return combo.map((k) => k.label).join(' + ');
}
