// useShortcuts.ts —— shortcut-library 数据层 React 适配。
//
// 数据落点由 host 的 JWT 态决定:
//   - 已登录(jwtAuth.state.token 存在)→ 用 createShortcutStore(后端 /api/v1/kv,逐 key 增删改查)
//   - 游客(无 token)→ 自动降级用 LSStore(本地缓存),登录后无缝迁回 cloud store
//   - 所有现有 export(findBindingsByCode / comboKey / comboLabel / ImportStats)
//     保持稳定,既有调用方零改动
//
// 同步模型:写操作是**细粒度 op**(create*/update*/delete*),没有"整体 snapshot 上传"。
//   - auto 模式:op 立即执行
//   - manual 模式:op 进 pendingOps 队列,flushDirty() 排空
//   - 读取用 pull()(云端 = GET /kv?tags=shortcut-library 拉取最新)
// 这样前端某时刻快照为空/异常也不会触发任何写、不会清空远端。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from '../types';
import type { ImportParseResult } from '../engine/import-parser';
import { LSStore, type ImportStats, type ShortcutCrudStore } from '../engine/store';
import { createShortcutStore } from '@api/components/shortcut-library/createShortcutStore';
import { useJwtAuth } from './useAuth';

export type { ImportStats };

function freshId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** 细粒度写操作 —— 一个 op = 对一个 store 的一次调用。 */
type PersistOp = (store: ShortcutCrudStore) => Promise<unknown>;

/**
 * 策略:activeStore 由 host JWT 态决定(useJwtAuth 读 token)。
 *   - token 存在 → cloud store(createShortcutStore,逐 key 增删改查)
 *   - token 不存在 → LSStore(游客本地缓存)
 * 登录 / 登出时 token 变化 → effect 自动切换 activeStore 并 pull 重载。
 * 写操作都走 activeStore 的细粒度 op;游客模式下天然落本地。
 */
export function useShortcuts() {
  const auth = useJwtAuth();
  const cloudStore = useMemo(() => createShortcutStore(), []);
  const lsStore = useMemo(() => new LSStore(), []);

  const [activeStore, setActiveStore] = useState<ShortcutCrudStore>(lsStore);
  const [groups, setGroups] = useState<Group[]>([]);
  // groups 的同步镜像:actions 里读最新值派生 order/取当前分组,
  // 避免 React setState 异步拿不到最新值。apply() 同时维护它。
  const groupsRef = useRef<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  // 同步模式:auto = 改即同步(原行为);manual = 改本地不立即同步,需点 Save
  const [saveMode, setSaveModeState] = useState<'auto' | 'manual'>('auto');
  // dirty:manual 模式下有未同步的 op 积压
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

  // 当前生效 store 的 ref,避免闭包过期
  const activeStoreRef = useRef<ShortcutCrudStore>(lsStore);
  useEffect(() => { activeStoreRef.current = activeStore; }, [activeStore]);
  // manual 模式待同步的 op 队列
  const pendingOpsRef = useRef<PersistOp[]>([]);

  /** 更新 React state + 同步镜像(一次调用,天然避免 StrictMode 双跑 updater)。 */
  const apply = useCallback((updater: (prev: Group[]) => Group[]) => {
    const next = updater(groupsRef.current);
    groupsRef.current = next;
    setGroups(next);
    return next;
  }, []);

  /** 逐个执行 op,单个失败只打日志不中断(与旧 auto save 的 fire-and-forget 一致)。 */
  const runOps = useCallback(async (ops: PersistOp[], store: ShortcutCrudStore) => {
    for (const op of ops) {
      try {
        await op(store);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[useShortcuts] sync failed:', msg);
      }
    }
  }, []);

  /** 持久化:auto 立即执行;manual 入队 + 标 dirty。 */
  const persist = useCallback((ops: PersistOp[]) => {
    if (saveMode === 'manual') {
      pendingOpsRef.current.push(...ops);
      setDirty(true);
      return;
    }
    void runOps(ops, activeStoreRef.current);
  }, [saveMode, runOps]);

  // 切换 mode 时,如果 manual 有积压 op 且新 mode = auto → 立即 flush
  // (用户体验:不要让"切回 auto 之前还丢数据")
  const flushDirty = useCallback(async () => {
    const ops = pendingOpsRef.current;
    if (ops.length === 0) return;
    setSaving(true);
    const store = activeStoreRef.current;
    try {
      for (let i = 0; i < ops.length; i++) {
        try {
          await ops[i](store);
        } catch (e) {
          // 失败:未执行的部分放回队列,下次 flush 重试
          pendingOpsRef.current = ops.slice(i);
          throw e;
        }
      }
      pendingOpsRef.current = [];
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, []);

  const setSaveMode = useCallback((m: 'auto' | 'manual') => {
    setSaveModeState(m);
    if (m === 'auto' && pendingOpsRef.current.length > 0) {
      void flushDirty();
    }
  }, [flushDirty]);

  // 启动 + token 变化:按 JWT 态选 activeStore 并 pull。
  // host 的 jwtAuth.init() 已在应用启动时跑过(Task 10),这里只读当前 token。
  // useJwtAuth() 每次渲染返回新快照,但 auth.token 是原始值,作为依赖稳定。
  useEffect(() => {
    let cancelled = false;
    const store = auth.token ? cloudStore : lsStore;
    setActiveStore(store);
    (async () => {
      try {
        const g = await store.pull();
        if (!cancelled) {
          groupsRef.current = g;
          setGroups(g);
        }
      } catch (e) {
        console.error('[useShortcuts] pull failed:', e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.token, cloudStore, lsStore]);

  // token 变化(登录/登出)→ 保证 activeStore 指向正确的 store 实现
  useEffect(() => {
    const want = auth.token ? cloudStore : lsStore;
    setActiveStore((prev) => (prev === want ? prev : want));
  }, [auth.token, cloudStore, lsStore]);

  // activeStore 变化(登录/登出)→ 重 pull 一次,保持本地 state 跟新 store 同步。
  // 登出 → reset saveMode + dirty + 清空积压 op(退出确认在 host 全局按钮处理)。
  useEffect(() => {
    const loggedOut = activeStore === lsStore;
    if (loggedOut) {
      setSaveModeState('auto');
      setDirty(false);
      pendingOpsRef.current = [];
    }
    let cancelled = false;
    (async () => {
      try {
        const g = await activeStore.pull();
        if (!cancelled) {
          groupsRef.current = g;
          setGroups(g);
        }
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

  // ---- 细粒度 mutation:更新本地 state + 持久化对应 op ----

  const addGroup = useCallback((name: string) => {
    const now = Date.now();
    const g: Group = {
      id: freshId(),
      name: name.trim() || '未命名',
      shortcuts: [],
      createdAt: now,
      updatedAt: now,
    };
    const next = apply((prev) => [...prev, g]);
    persist([(s) => s.createGroup(g, next.length - 1)]);
    setSelectedGroupId(g.id);
    return g;
  }, [apply, persist]);

  const renameGroup = useCallback((id: string, name: string) => {
    const now = Date.now();
    const next = apply((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, name: name.trim() || g.name, updatedAt: now } : g,
      ),
    );
    const order = next.findIndex((g) => g.id === id);
    if (order >= 0) {
      persist([(s) => s.updateGroup(next[order], order)]);
    }
  }, [apply, persist]);

  const deleteGroup = useCallback((id: string) => {
    // 顺带删掉该组下快捷键的 key,避免孤儿积压
    const group = groupsRef.current.find((g) => g.id === id);
    apply((prev) => prev.filter((g) => g.id !== id));
    const shortcutIds = group?.shortcuts.map((sc) => sc.id) ?? [];
    persist([
      (s) => s.deleteGroup(id),
      ...shortcutIds.map((scId) => (s: ShortcutCrudStore) => s.deleteShortcut(scId)),
    ]);
  }, [apply, persist]);

  const addShortcut = useCallback(
    (groupId: string, combo: KeyStroke[], description: string, condition?: string) => {
      const s: Shortcut = {
        id: freshId(),
        combo,
        description: description.trim(),
        condition: condition?.trim() || undefined,
        createdAt: Date.now(),
      };
      const next = apply((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, shortcuts: [...g.shortcuts, s], updatedAt: Date.now() }
            : g,
        ),
      );
      const group = next.find((g) => g.id === groupId);
      if (group) persist([(st) => st.createShortcut(groupId, s, group.shortcuts.length - 1)]);
      return s;
    },
    [apply, persist],
  );

  const updateShortcut = useCallback(
    (
      groupId: string,
      shortcutId: string,
      patch: Partial<Pick<Shortcut, 'combo' | 'description' | 'condition'>>,
    ) => {
      const now = Date.now();
      const next = apply((prev) =>
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
                updatedAt: now,
              }
            : g,
        ),
      );
      const group = next.find((g) => g.id === groupId);
      const order = group?.shortcuts.findIndex((sc) => sc.id === shortcutId);
      if (group && order !== undefined && order >= 0) {
        persist([(st) => st.updateShortcut(groupId, group.shortcuts[order], order)]);
      }
    },
    [apply, persist],
  );

  const deleteShortcut = useCallback((groupId: string, shortcutId: string) => {
    apply((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, shortcuts: g.shortcuts.filter((sc) => sc.id !== shortcutId), updatedAt: Date.now() }
          : g,
      ),
    );
    persist([(s) => s.deleteShortcut(shortcutId)]);
  }, [apply, persist]);

  const importGroups = useCallback((data: ImportParseResult): ImportStats => {
    const stats: ImportStats = {
      groupsAdded: 0,
      groupsAppended: 0,
      shortcutsAdded: 0,
      errors: [...data.errors],
    };
    const createdGroups: Group[] = [];
    const createdShortcuts: Array<{ groupId: string; s: Shortcut; order: number }> = [];
    // 不动 prev 里的对象(保持不可变),新创建的分组/快捷键记下来用于持久化
    const next = apply((prev) => {
      const result = prev.map((eg) => {
        const incoming = data.groups.find((dg) => dg.name.toLowerCase() === eg.name.toLowerCase());
        if (!incoming) return eg;
        const newShortcuts: Shortcut[] = incoming.shortcuts.map((sc) => ({
          id: freshId(),
          combo: sc.combo,
          description: sc.description,
          condition: sc.condition,
          createdAt: Date.now(),
        }));
        newShortcuts.forEach((s, i) => createdShortcuts.push({ groupId: eg.id, s, order: eg.shortcuts.length + i }));
        stats.groupsAppended++;
        stats.shortcutsAdded += newShortcuts.length;
        return { ...eg, shortcuts: [...eg.shortcuts, ...newShortcuts], updatedAt: Date.now() };
      });
      const existingNames = new Set(prev.map((g) => g.name.toLowerCase()));
      for (const g of data.groups) {
        if (existingNames.has(g.name.toLowerCase())) continue;
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
        newGroup.shortcuts.forEach((s, i) => createdShortcuts.push({ groupId: newGroup.id, s, order: i }));
        result.push(newGroup);
        createdGroups.push(newGroup);
        stats.groupsAdded++;
        stats.shortcutsAdded += newGroup.shortcuts.length;
      }
      return result;
    });
    const groupOrders = new Map<string, number>();
    next.forEach((g, i) => groupOrders.set(g.id, i));
    persist([
      ...createdGroups.map((g) => (s: ShortcutCrudStore) => s.createGroup(g, groupOrders.get(g.id) ?? 0)),
      ...createdShortcuts.map(({ groupId, s, order }) => (st: ShortcutCrudStore) => st.createShortcut(groupId, s, order)),
    ]);
    return stats;
  }, [apply, persist]);

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
    // 同步模式控制
    saveMode,
    setSaveMode,
    dirty,
    saving,
    flushDirty,
    // 设置面板
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
