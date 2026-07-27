// useShortcuts.ts —— localStorage 后端的 shortcut store
// useState 持状态,变更后 debounce 200ms 写 LS;跨标签通过 storage 事件同步

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group, Shortcut, KeyStroke } from './types';

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
    (groupId: string, combo: KeyStroke[], description: string) => {
      const s: Shortcut = {
        id: freshId(),
        combo,
        description: description.trim(),
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
    (groupId: string, shortcutId: string, patch: Partial<Pick<Shortcut, 'combo' | 'description'>>) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                shortcuts: g.shortcuts.map((s) => (s.id === shortcutId ? { ...s, ...patch } : s)),
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
  };
}

// 序列化 combo 为可比较的字符串(用于冲突检测与搜索)
export function comboKey(combo: KeyStroke[]): string {
  return combo.map((k) => k.code).join('+');
}
export function comboLabel(combo: KeyStroke[]): string {
  return combo.map((k) => k.label).join(' + ');
}
