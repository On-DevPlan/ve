// store.ts —— shortcut-library 持久化抽象(简单 load/save)。
//
// 整个库作为单个 JSON 字符串读写。云端由 createShortcutStore 委托给 user-space
// 的 getShortcuts/setShortcuts,本地由 LSStore 落 localStorage。组件不感知
// KV 协议(那是 user-space 的事)。
//
// 设计要点:
//   - load() 是一次性启动读取;save() 是每次变更后调。是否 debounce / 失败重试
//     完全关在 store 里,useShortcuts 不感知。
//   - authState 是可选的——只为 UI 显示登录条;LS 永远 'logged-out'(假装)。
//   - 不在 store 里管 React state —— 那是 useShortcuts 的职责。

import type { ShortcutsBlob } from '@api/components/user-space/types';

export type AuthState = 'logged-out' | 'logged-in' | 'syncing' | 'error';

export interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

/** shortcut-library 整个库一次性读写的极简契约。 */
export interface ShortcutStore {
  /** One-shot read at startup. */
  load(): Promise<ShortcutsBlob>;
  /** Persist the new state. */
  save(groups: ShortcutsBlob): Promise<void>;
  /** Optional — UI 用来显示登录态条;LS 永远 'logged-out'(假装)。 */
  readonly authState: AuthState;
}

// ---- LSStore(本地缓存 + 离线 fallback)-----------------------------

const LS_KEY = 'sl-shortcut-library:v1';
const DEBOUNCE_MS = 200;

function loadFromLS(): ShortcutsBlob {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ShortcutsBlob;
  } catch {
    return [];
  }
}

function writeToLS(groups: ShortcutsBlob): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(groups));
  } catch {
    /* quota / private mode — ignore */
  }
}

export class LSStore implements ShortcutStore {
  readonly authState: AuthState = 'logged-out';

  load(): Promise<ShortcutsBlob> {
    return Promise.resolve(loadFromLS());
  }

  async save(groups: ShortcutsBlob): Promise<void> {
    // Debounce: collapse rapid updates into a single write.
    if (this._writeTimer !== null) window.clearTimeout(this._writeTimer);
    this._writeTimer = window.setTimeout(() => {
      writeToLS(groups);
      this._writeTimer = null;
    }, DEBOUNCE_MS);
  }

  private _writeTimer: number | null = null;
}
