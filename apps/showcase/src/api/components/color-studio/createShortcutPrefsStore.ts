// apps/showcase/src/api/components/color-studio/createShortcutPrefsStore.ts
//
// 快捷键偏好存储 —— 独立 KV key 've-color-key'(用户指定)。
// 与主文档分开:快捷键是用户偏好,跨文档生效;登录后按用户隔离天然同步。

import { kvV1Service } from '../../services';
import { ApiError } from '../../services/base';

export const SHORTCUT_PREFS_KV_KEY = 've-color-key';
const SHORTCUT_PREFS_TAGS = ['color-studio'] as const;

/** 四个可自定义动作的键位(单字符,小写)。 */
export interface ShortcutMap {
  eyedropper: string;
  addColor: string;
  copy: string;
  clearHistory: string;
}

export interface ShortcutPrefs {
  schemaVersion: '1.0.0';
  shortcuts: ShortcutMap;
  updatedAt: number;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  eyedropper: 'p',
  addColor: 'a',
  copy: 'c',
  clearHistory: 'x',
};

export interface ShortcutPrefsStoreLite {
  load(): Promise<ShortcutPrefs>;
  save(prefs: ShortcutPrefs): Promise<void>;
}

function isShortcutMap(x: unknown): x is ShortcutMap {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  return ['eyedropper', 'addColor', 'copy', 'clearHistory']
    .every((k) => typeof m[k] === 'string' && m[k]?.length === 1);
}

/** 解析 KV value → ShortcutPrefs;非法/缺失 → 默认。 */
export function parseShortcutPrefs(raw: string): ShortcutPrefs {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      isShortcutMap(parsed.shortcuts)
    ) {
      return {
        schemaVersion: '1.0.0',
        shortcuts: parsed.shortcuts,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      };
    }
  } catch {
    // fall through to default
  }
  return { schemaVersion: '1.0.0', shortcuts: { ...DEFAULT_SHORTCUTS }, updatedAt: 0 };
}

export function createShortcutPrefsStore(): ShortcutPrefsStoreLite {
  async function load(): Promise<ShortcutPrefs> {
    try {
      const item = await kvV1Service.get({ key: SHORTCUT_PREFS_KV_KEY });
      return parseShortcutPrefs(item.value);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 50 || e.code === 404)) {
        return { schemaVersion: '1.0.0', shortcuts: { ...DEFAULT_SHORTCUTS }, updatedAt: 0 };
      }
      return { schemaVersion: '1.0.0', shortcuts: { ...DEFAULT_SHORTCUTS }, updatedAt: 0 };
    }
  }

  async function save(prefs: ShortcutPrefs): Promise<void> {
    await kvV1Service.set({
      key: SHORTCUT_PREFS_KV_KEY,
      value: JSON.stringify(prefs),
      tags: [...SHORTCUT_PREFS_TAGS],
      ttl: 0,
    });
  }

  return { load, save };
}
