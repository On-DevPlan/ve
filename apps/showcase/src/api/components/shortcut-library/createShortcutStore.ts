// api/components/shortcut-library/createShortcutStore.ts —— 快捷键库的持久化封装。
//
// 职责:把 kvV1Service 的通用 KV 读写,包成 shortcut-library 组件要的
// load / save / importGroups 三个业务动作。组件只认这三个方法,不认 KV 协议。
//
// 为什么 import 走相对路径 '../../services' 而不是 '@api':
//   '@api' 解析到 api/index.ts,而 index.ts 又 `export * from './components'`
//   —— 本文件正在 components 里,形成 self-cycle(index → components →
//   createShortcutStore → index)。ESM 循环虽然能靠 hoisting 侥幸跑通,但
//   求值顺序取决于谁先被 import,一旦有人在 index 顶层加副作用就会拿到
//   undefined。**目录内部一律走相对路径,'@api' 只留给 src/api/ 外部调用方。**

import { jwtAuth } from '@/shared/auth-store';
import { kvV1Service, ApiError } from '../../services';
import type { Group } from './types';

const BLOB_KEY = 'shortcuts';
/** 快捷键库数据落 kv 时打的 tag —— 未来可按 tag 过滤/区分不同组件的数据。 */
const SHORTCUT_TAGS = ['shortcut-library'] as const;

/**
 * 后端 kv "键不存在" 的业务 code(信封 {code,message,data} 的 code 字段)。
 *
 * load() 把它当成"还没存过"→ 返回空数组,而不是抛错:首次登录的用户
 * 必然没有 blob,那是正常状态不是故障。其它 code 一律透传给调用方。
 */
const KV_CODE_NOT_FOUND = 50;

export interface ImportInput {
  groups: { name: string; shortcuts: { combo: Group['shortcuts'][number]['combo']; description: string; condition?: string }[] }[];
  errors: string[];
}

export interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

export interface ShortcutStoreLite {
  load(): Promise<Group[]>;
  save(groups: Group[]): Promise<void>;
  importGroups(data: ImportInput): Promise<ImportStats>;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * 建一个 shortcut-library 持久化实例。
 *
 * 三个方法都是**独立闭包**,不依赖 `this` —— 因为调用方常这样用:
 *   const { load, save } = createShortcutStore();
 * 如果内部写 `this.load()`,解构后 `this` 是 undefined,运行时崩。
 * 所以 load / save 先声明为局部函数,importGroups 直接调它们。
 */
export function createShortcutStore(): ShortcutStoreLite {
  async function load(): Promise<Group[]> {
    if (!jwtAuth.state.token) return [];
    try {
      const item = await kvV1Service.get({ key: BLOB_KEY });
      try {
        return JSON.parse(item.value) as Group[];
      } catch {
        // blob 内容坏了(手改过 / 半写入)——当空库处理,让用户能重新存
        return [];
      }
    } catch (e) {
      // 键不存在 = 首次使用,不是故障
      if (e instanceof ApiError && e.code === KV_CODE_NOT_FOUND) return [];
      throw e;
    }
  }

  async function save(groups: Group[]): Promise<void> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
    await kvV1Service.set({
      key: BLOB_KEY,
      value: JSON.stringify(groups),
      visibility: 'private',
      tags: [...SHORTCUT_TAGS],
    });
  }

  async function importGroups(data: ImportInput): Promise<ImportStats> {
    const stats: ImportStats = {
      groupsAdded: 0,
      groupsAppended: 0,
      shortcutsAdded: 0,
      errors: [...data.errors],
    };
    // 不走 this.load() —— 见函数头注释
    const current = await load();
    const next = [...current];
    for (const g of data.groups) {
      const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
      if (existing) {
        const added = g.shortcuts.map((s) => ({
          id: shortId(),
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
          id: shortId(),
          combo: s.combo,
          description: s.description,
          condition: s.condition,
          createdAt: now,
        }));
        next.push({ id: shortId(), name: g.name, shortcuts, createdAt: now, updatedAt: now });
        stats.groupsAdded++;
        stats.shortcutsAdded += shortcuts.length;
      }
    }
    await save(next);
    return stats;
  }

  return { load, save, importGroups };
}
