// store.ts —— shortcut-library 持久化抽象。
//
// ShortcutStore 是 useShortcuts 读写数据的唯一入口。两个实现:
//   - LSStore: 原行为,数据落 localStorage(默认 + 离线 fallback)
//   - E2EKVStore: 数据落 e2ekv 后端,前端加密(见 ./e2ekvStore.ts)
//
// 设计要点:
//   - load() 是一次性启动读取;save() 是每次变更后调。
//     这样把"是否 debounce / 是否冲突重试"完全关进 store 里,
//     useShortcuts 不需要感知。
//   - authState 是可选的——只有 E2EKV 用得上;LS 永远 'logged-out'(假装)。
//     UI 据此显示状态条 + 登录面板。
//   - importGroups 是 e2ekv 不需要的批量操作,LS 实现里复用旧 import 逻辑。
//   - 不在 store 里管 React state —— 那是 useShortcuts 的职责。

import type { Group } from '../types';
import type { ImportParseResult } from './import-parser';

export type AuthState = 'logged-out' | 'logged-in' | 'syncing' | 'error';

export interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

export interface ShortcutStore {
  /** One-shot read at startup. */
  load(): Promise<Group[]>;

  /** Persist the new state. Must be safe to call repeatedly (debounce internally). */
  save(groups: Group[]): Promise<void>;

  /** Optional — only used by e2ekv. Local store returns 'logged-out'. */
  readonly authState: AuthState;

  /** Optional — e2ekv uses this to expose the current AuthHash for debugging. */
  readonly authHash?: string;

  /** Optional — store may take a password (e2ekv) or no args (user/kv restores from LS).
 *  返回 mode 表示"如何进入会话":
 *    - 'setup':需要首次注册(仅 e2ekv 走这个分支)
 *    - 'login':已有会话(本地恢复或刚 login)
 *    - 'register':可注册新账号(仅 user/kv 需要这个区分)
 *    - null:无会话,UI 应引导用户登录/注册
 */
  init?(password?: string): Promise<{ mode: 'setup' | 'login' | 'register' } | null>;

  /** Optional — clears credentials (e2ekv: sessionStorage; user/kv: localStorage JWT). */
  logout?(): void;

  /** Optional — merge imported TOML into the store. LS-side only for now. */
  importGroups?(data: ImportParseResult): Promise<ImportStats>;

  /**
   * Optional — subscribe to cross-tab updates. Returns an unsubscribe fn.
   * LS uses the 'storage' event; e2ekv uses polling (or nothing in v1).
   */
  subscribe?(cb: (groups: Group[]) => void): () => void;
}

// ---- LSStore (原 useShortcuts.ts 里的 LS 行为) ------------------------

const LS_KEY = 'sl-shortcut-library:v1';
const DEBOUNCE_MS = 200;

function freshId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadFromLS(): Group[] {
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

function writeToLS(groups: Group[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(groups));
  } catch {
    /* quota / private mode — ignore */
  }
}

export class LSStore implements ShortcutStore {
  readonly authState: AuthState = 'logged-out';
  readonly authHash: string | undefined = undefined;

  load(): Promise<Group[]> {
    return Promise.resolve(loadFromLS());
  }

  async save(groups: Group[]): Promise<void> {
    // Debounce: collapse rapid updates into a single write.
    if (this._writeTimer !== null) window.clearTimeout(this._writeTimer);
    this._writeTimer = window.setTimeout(() => {
      writeToLS(groups);
      this._writeTimer = null;
    }, DEBOUNCE_MS);
  }

  private _writeTimer: number | null = null;

  importGroups(data: ImportParseResult): Promise<ImportStats> {
    const stats: ImportStats = {
      groupsAdded: 0,
      groupsAppended: 0,
      shortcutsAdded: 0,
      errors: [...data.errors],
    };
    const current = loadFromLS();
    const next = [...current];
    for (const g of data.groups) {
      const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
      if (existing) {
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
    writeToLS(next);
    return Promise.resolve(stats);
  }

  subscribe(cb: (groups: Group[]) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) cb(loadFromLS());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}