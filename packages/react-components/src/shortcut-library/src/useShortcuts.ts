// useShortcuts.ts —— shortcut-library 数据层 React 适配。
//
// 跟之前的差异:
//   - 默认 store 改成 UserKVStore(邮箱 + JWT,数据存后端 /api/v1/kv)
//   - 游客(无 JWT)自动降级用 LSStore,登录后无缝迁回 UserKVStore
//   - 所有现有 export(findBindingsByCode / comboKey / comboLabel / ImportStats)
//     保持稳定,既有调用方零改动

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from './types';
import type { ImportParseResult } from './import-parser';
import { LSStore, type ImportStats, type ShortcutStore } from './store';
import { UserKVStore } from './userKvStore';

export type { ImportStats };

function freshId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * 策略:始终持有一个 UserKVStore 实例(它自己管 JWT)。
 *   - 启动时 useShortcuts 调 UserKVStore.init() 尝试恢复 LS 里的 token
 *   - 如果成功 → authState=logged-in,数据从 server 拉
 *   - 如果失败(没 token / token 过期)→ authState=logged-out,
 *     useShortcuts 内部用 LSStore 作为 fallback(游客本地缓存)
 *   - 用户在 UI 登录成功后,useAuth hook 调 store.login(),authState 变 logged-in,
 *     下次 load() 拉 server 数据
 *
 * 这里保持"两个 store 共存":cloud 是 source of truth,LS 是降级缓存。
 * 写操作都走 cloud,LS 只在游客模式下生效。
 */
export function useShortcuts() {
  const cloudStore = useMemo(() => new UserKVStore(), []);
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

  // 启动:尝试用 LS 里的 JWT 恢复会话
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. 尝试 cloud session 恢复
      let useCloud = false;
      try {
        await cloudStore.init();
        // 同样用 userId 判断,不看 authState(见下面轮询 effect 的注释)
        if (cloudStore.userId > 0) useCloud = true;
      } catch (e) {
        // init 抛错 → 不致命,游客模式继续
        console.warn('[useShortcuts] cloud init failed:', e);
      }
      if (cancelled) return;

      // 2. 选 store + load
      const store = useCloud ? cloudStore : lsStore;
      setActiveStore(store as ShortcutStore);
      try {
        const g = await store.load();
        if (!cancelled) setGroups(g);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[useShortcuts] load failed:', msg);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [cloudStore, lsStore]);

  // 监听 cloud 登录态变化(登录/登出)→ 切换 active store + 重 load
  //
  // 关键:判断依据是 `userId > 0`(有 creds),**不是** authState。
  // 因为 authState 在 save/load 期间会临时变成 'syncing'/'error',
  // 如果按 authState 判断,同步中就会被误判成"登出"→ 切回 lsStore →
  // UI 显示游客模式(看起来像被强制退出)。
  useEffect(() => {
    const id = window.setInterval(() => {
      const loggedIn = cloudStore.userId > 0;
      const want = loggedIn ? cloudStore : lsStore;
      setActiveStore((prev) => (prev === want ? prev : (want as ShortcutStore)));
    }, 500);
    return () => window.clearInterval(id);
  }, [cloudStore, lsStore]);

  // 登录态下,syncState / lastSyncAt 1s 轮询触发重渲染
  // (让 banner 的 "已同步 N 秒前" 实时刷新 + syncing/error 状态即时切换)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const addGroup = useCallback(
    (name: string) => {
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
    },
    [mutate],
  );

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
      const s_new: Shortcut = {
        id: freshId(),
        combo,
        description: description.trim(),
        condition: condition?.trim() || undefined,
        createdAt: Date.now(),
      };
      mutate((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, shortcuts: [...g.shortcuts, s_new], updatedAt: Date.now() }
            : g,
        ),
      );
      return s_new;
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
            const newShortcuts = g.shortcuts.map((sc) => ({
              id: freshId(),
              combo: sc.combo,
              description: sc.description,
              condition: sc.condition,
              createdAt: Date.now(),
            }));
            existing.shortcuts = [...existing.shortcuts, ...newShortcuts];
            existing.updatedAt = Date.now();
            stats.groupsAppended++;
            stats.shortcutsAdded += newShortcuts.length;
          } else {
            const now = Date.now();
            const newGroup: Group = {
              id: freshId(),
              name: g.name,
              shortcuts: g.shortcuts.map((sc) => ({
                id: freshId(),
                combo: sc.combo,
                description: sc.description,
                condition: sc.condition,
                createdAt: now,
              })),
              createdAt: now,
              updatedAt: now,
            };
            next.push(newGroup);
            stats.groupsAdded++;
            stats.shortcutsAdded += newGroup.shortcuts.length;
          }
        }
        return next;
      });
      return stats;
    },
    [mutate],
  );

  // 登录态切换时(登出 → 切回 LS,登录 → 切到 cloud),主动重拉一次,
  // 保证本地 state 跟新 store 同步。
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
    // store 暴露给 UI(状态条 + 登录面板)
    cloudStore,
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