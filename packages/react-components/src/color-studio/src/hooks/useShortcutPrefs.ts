// packages/react-components/src/color-studio/src/hooks/useShortcutPrefs.ts
//
// 快捷键偏好:mount 时从 ve-color-key KV load,修改 600ms debounce save。
// setKey 带冲突检测:同键被其他动作占用时返回被占用动作名(调用方提示)。

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createShortcutPrefsStore,
  DEFAULT_SHORTCUTS,
  type ShortcutMap,
  type ShortcutPrefs,
} from '../../../../../../apps/showcase/src/api/components/color-studio/createShortcutPrefsStore';

export type ShortcutAction = keyof ShortcutMap;

const ACTION_LABELS: Record<ShortcutAction, string> = {
  eyedropper: '屏幕取色',
  addColor: '加入当前色',
  copy: '复制 hex',
  clearHistory: '清空历史',
};

export function shortcutActionLabel(action: ShortcutAction): string {
  return ACTION_LABELS[action];
}

export function useShortcutPrefs(): {
  prefs: ShortcutPrefs;
  ready: boolean;
  /** 绑定键位。若键被其他动作占用,返回冲突动作名(未写入);成功返回 null。 */
  setKey: (action: ShortcutAction, key: string) => string | null;
  resetAll: () => void;
} {
  const [prefs, setPrefs] = useState<ShortcutPrefs>({
    schemaVersion: '1.0.0',
    shortcuts: { ...DEFAULT_SHORTCUTS },
    updatedAt: 0,
  });
  const [ready, setReady] = useState(false);
  const storeRef = useRef(createShortcutPrefsStore());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storeRef.current.load();
      if (!cancelled) {
        setPrefs(loaded);
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next: ShortcutPrefs) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      storeRef.current.save(next).catch(() => undefined);
    }, 600);
  }, []);

  const setKey = useCallback((action: ShortcutAction, rawKey: string): string | null => {
    const key = rawKey.toLowerCase();
    if (!/^[a-z]$/.test(key)) return '仅支持单字母键';
    const conflict = (Object.keys(prefs.shortcuts) as ShortcutAction[])
      .find((a) => a !== action && prefs.shortcuts[a] === key);
    if (conflict) return shortcutActionLabel(conflict);
    const next: ShortcutPrefs = {
      ...prefs,
      shortcuts: { ...prefs.shortcuts, [action]: key },
      updatedAt: Date.now(),
    };
    setPrefs(next);
    persist(next);
    return null;
  }, [prefs, persist]);

  const resetAll = useCallback(() => {
    const next: ShortcutPrefs = {
      schemaVersion: '1.0.0',
      shortcuts: { ...DEFAULT_SHORTCUTS },
      updatedAt: Date.now(),
    };
    setPrefs(next);
    persist(next);
  }, [persist]);

  return { prefs, ready, setKey, resetAll };
}
