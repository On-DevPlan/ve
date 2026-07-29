// useShortcuts.ts —— localStorage 后端的 shortcut store
// useState 持状态,变更后 debounce 200ms 写 LS;跨标签通过 storage 事件同步

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from './types';
import type { ImportParseResult } from './import-parser';

const LS_KEY = 'sl-shortcut-library:v1';
const DEBOUNCE_MS = 200;

function freshId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function load(): Group[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Group[];
  } catch {
    return [];
  }
}

function save(groups: Group[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(groups));
  } catch {
    /* quota / private mode — ignore */
  }
}

interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

export function useShortcuts() {
  const [groups, setGroups] = useState<Group[]>(() => load());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const writeTimer = useRef<number | null>(null);

  // 持久化(debounce)
  useEffect(() => {
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => save(groups), DEBOUNCE_MS);
    return () => {
      if (writeTimer.current) window.clearTimeout(writeTimer.current);
    };
  }, [groups]);

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setGroups(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 自动选中(第一个 / 刚创建的)
  useEffect(() => {
    if (selectedGroupId && groups.some((g) => g.id === selectedGroupId)) return;
    setSelectedGroupId(groups[0]?.id ?? null);
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const addGroup = useCallback((name: string) => {
    const now = Date.now();
    const g: Group = { id: freshId(), name: name.trim() || '未命名', shortcuts: [], createdAt: now, updatedAt: now };
    setGroups((prev) => [...prev, g]);
    setSelectedGroupId(g.id);
    return g;
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name, updatedAt: Date.now() } : g)),
    );
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addShortcut = useCallback(
    (groupId: string, combo: KeyStroke[], description: string, condition?: string) => {
      const s: Shortcut = {
        id: freshId(),
        combo,
        description: description.trim(),
        condition: condition?.trim() || undefined,
        createdAt: Date.now(),
      };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, shortcuts: [...g.shortcuts, s], updatedAt: Date.now() }
            : g,
        ),
      );
      return s;
    },
    [],
  );

  const updateShortcut = useCallback(
    (
      groupId: string,
      shortcutId: string,
      patch: Partial<Pick<Shortcut, 'combo' | 'description' | 'condition'>>,
    ) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                shortcuts: g.shortcuts.map((s) =>
                  s.id === shortcutId
                    ? {
                        ...s,
                        ...patch,
                        // 把空字符串规范化成 undefined,保持数据干净
                        condition:
                          patch.condition === undefined
                            ? s.condition
                            : patch.condition.trim() || undefined,
                        description:
                          patch.description === undefined
                            ? s.description
                            : patch.description.trim(),
                      }
                    : s,
                ),
                updatedAt: Date.now(),
              }
            : g,
        ),
      );
    },
    [],
  );

  const deleteShortcut = useCallback((groupId: string, shortcutId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, shortcuts: g.shortcuts.filter((s) => s.id !== shortcutId), updatedAt: Date.now() }
          : g,
      ),
    );
  }, []);

  const importGroups = useCallback((data: ImportParseResult): ImportStats => {
    const stats: ImportStats = { groupsAdded: 0, groupsAppended: 0, shortcutsAdded: 0, errors: [...data.errors] };

    setGroups((prev) => {
      const next = [...prev];
      for (const g of data.groups) {
        // Look up existing group by name (case-insensitive)
        const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
        if (existing) {
          // Append shortcuts to existing group
          const newShortcuts = g.shortcuts.map((s) => ({
            id: freshId(),
            combo: s.combo,
            description: s.description,
            condition: s.condition,
            createdAt: Date.now(),
          }));
          existing.shortcuts = [...existing.shortcuts, ...newShortcuts];
          existing.updatedAt = Date.now();
          stats.groupsAppended++;
          stats.shortcutsAdded += newShortcuts.length;
        } else {
          // Create new group
          const now = Date.now();
          const newGroup: Group = {
            id: freshId(),
            name: g.name,
            shortcuts: g.shortcuts.map((s) => ({
              id: freshId(),
              combo: s.combo,
              description: s.description,
              condition: s.condition,
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
  }, []);

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

export type { ImportStats };

// 序列化 combo 为可比较的字符串(用于冲突检测与搜索)
export function comboKey(combo: KeyStroke[]): string {
  return combo.map((k) => k.code).join('+');
}
export function comboLabel(combo: KeyStroke[]): string {
  return combo.map((k) => k.label).join(' + ');
}
