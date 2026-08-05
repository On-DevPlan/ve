// store.ts —— shortcut-library 持久化抽象(细粒度增删改查)。
//
// ShortcutCrudStore 是 useShortcuts 读写数据的唯一入口,接口定义在
// createShortcutStore.ts(api 层),本文件实现本地版 LSStore。
// 两个实现:
//   - LSStore(本文件):数据落 localStorage。每个粒度 op = 读整库 → 应用单变更 →
//     整库写回,用 promise 链串行化,避免并发 op 的 read-modify-write 互相覆盖。
//     localStorage 是本地、可整体覆盖(不存在"传空清远端"的风险)。
//   - cloud store(createShortcutStore.ts):逐 key 的 POST /kv / DELETE /kv/:key,
//     pull() 拉取最新。见该文件。
//
// 设计要点:
//   - pull() 是一次性启动读取;增删改走 create*/update*/delete* 细粒度方法,
//     没有 save(snapshot) 整体上传 —— 前端某时刻快照为空/异常,也不会清空远端。
//   - 不在 store 里管 React state —— 那是 useShortcuts 的职责。

import type { Group, Shortcut } from '../types';
import type { ShortcutCrudStore } from '@api/components/shortcut-library/createShortcutStore';

export type { ShortcutCrudStore };

export interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

const LS_KEY = 'sl-shortcut-library:v1';

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

export class LSStore implements ShortcutCrudStore {
  /** 串行化读改写:op 排队逐个执行,避免并发互相覆盖。 */
  private _writeChain: Promise<void> = Promise.resolve();

  private mutateLS(fn: (groups: Group[]) => Group[]): Promise<void> {
    this._writeChain = this._writeChain
      .then(() => {
        writeToLS(fn(loadFromLS()));
      })
      .catch((e: unknown) => {
        // 前一次写失败不阻塞后续 op(loadFromLS/writeToLS 内部已吞错,这里兜底)
        console.error('[LSStore] write failed:', e);
      });
    return this._writeChain;
  }

  pull(): Promise<Group[]> {
    return Promise.resolve(loadFromLS());
  }

  createGroup(g: Group, _order: number): Promise<void> {
    return this.mutateLS((groups) => [...groups, g]);
  }

  updateGroup(g: Group, _order: number): Promise<void> {
    return this.mutateLS((groups) => groups.map((x) => (x.id === g.id ? g : x)));
  }

  deleteGroup(id: string): Promise<void> {
    return this.mutateLS((groups) => groups.filter((g) => g.id !== id));
  }

  createShortcut(groupId: string, s: Shortcut, _order: number): Promise<void> {
    return this.mutateLS((groups) =>
      groups.map((g) =>
        g.id === groupId ? { ...g, shortcuts: [...g.shortcuts, s], updatedAt: Date.now() } : g,
      ),
    );
  }

  updateShortcut(groupId: string, s: Shortcut, _order: number): Promise<void> {
    return this.mutateLS((groups) =>
      groups.map((g) =>
        g.id === groupId
          ? { ...g, shortcuts: g.shortcuts.map((sc) => (sc.id === s.id ? s : sc)), updatedAt: Date.now() }
          : g,
      ),
    );
  }

  deleteShortcut(id: string): Promise<void> {
    return this.mutateLS((groups) =>
      groups.map((g) => ({ ...g, shortcuts: g.shortcuts.filter((sc) => sc.id !== id) })),
    );
  }
}
