// api/components/shortcut-library/createShortcutStore.ts —— 快捷键库的持久化封装(按 item 的增删改查)。
//
// 职责:把 kvV1Service 的通用 KV 读写,包成 shortcut-library 组件要的
// pull / create* / update* / delete* 细粒度业务动作。组件只认这些方法,不认 KV 协议。
//
// 为什么 import 走相对路径 '../../services' 而不是 '@api':
//   '@api' 解析到 api/index.ts,而 index.ts 又 `export * from './components'`
//   —— 本文件正在 components 里,形成 self-cycle(index → components →
//   createShortcutStore → index)。ESM 循环虽然能靠 hoisting 侥幸跑通,但
//   求值顺序取决于谁先被 import,一旦有人在 index 顶层加副作用就会拿到
//   undefined。**目录内部一律走相对路径,'@api' 只留给 src/api/ 外部调用方。**
//
// 数据模型:一个 item(group / shortcut)= 一个 KV key,统一 tag 'shortcut-library'。
//   - group:    sl-group-<id>     → { id, name, order, createdAt, updatedAt }
//   - shortcut: sl-shortcut-<id>  → { id, groupId, order, combo, description, condition, createdAt, updatedAt }
// 拉取 = GET /kv?tags=shortcut-library 分页取全,按 order 重建 groups[]。
// 增删改都是单 key 的 POST /kv(幂等 upsert)或 DELETE /kv/:key,没有"整体 snapshot
// 上传"——前端某时刻快照为空/异常,也不会触发任何写,不会清空远端。
// 旧版本把所有数据塞进单个 'shortcuts' blob 整体覆盖,pull 时一次性迁移成多 key。

import { jwtAuth } from '../../http/auth-store';
import { kvV1Service, ApiError } from '../../services';
import type { Group, Shortcut } from './types';

const TAG = 'shortcut-library';
const GROUP_PREFIX = 'sl-group-';
const SHORTCUT_PREFIX = 'sl-shortcut-';
/** 旧版本的单 blob key(整体覆盖时代)—— 拉取时检测并迁移。 */
const LEGACY_KEY = 'shortcuts';
/** 后端 kv "键不存在" 的业务 code(信封 {code,message,data} 的 code 字段)。 */
const KV_CODE_NOT_FOUND = 50;
/** 单页 list 拉取条数,按 total 分页取全。 */
const LIST_LIMIT = 200;

function groupKey(id: string): string {
  return `${GROUP_PREFIX}${id}`;
}
function shortcutKey(id: string): string {
  return `${SHORTCUT_PREFIX}${id}`;
}

/**
 * 组件读写数据的唯一入口 —— 细粒度增删改查,没有整体 snapshot 上传。
 * 两个实现:云端(本文件,逐 key 请求)与本地 LSStore(整库写,见 store.ts)。
 */
export interface ShortcutCrudStore {
  /** 拉取最新:list 全部 tag=shortcut-library 的 key,重建 groups[](含旧 blob 迁移)。 */
  pull(): Promise<Group[]>;
  /** 新建分组(order = 侧栏位置,由调用方从本地数组派生)。 */
  createGroup(g: Group, order: number): Promise<void>;
  /** 改分组(改名);order 不变也一起传,保持幂等 upsert。 */
  updateGroup(g: Group, order: number): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  /** 新建快捷键(order = 组内位置)。 */
  createShortcut(groupId: string, s: Shortcut, order: number): Promise<void>;
  updateShortcut(groupId: string, s: Shortcut, order: number): Promise<void>;
  deleteShortcut(id: string): Promise<void>;
}

interface GroupRecord {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}
interface ShortcutRecord {
  id: string;
  groupId: string;
  order: number;
  combo: Shortcut['combo'];
  description: string;
  condition?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 建一个 shortcut-library 持久化实例。
 *
 * 所有方法都是**独立闭包**,不依赖 `this` —— 因为调用方常这样用:
 *   const { pull, createShortcut } = createShortcutStore();
 * 如果内部写 `this.createShortcut()`,解构后 `this` 是 undefined,运行时崩。
 */
export function createShortcutStore(): ShortcutCrudStore {
  async function requireLoggedIn(): Promise<void> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
  }

  /** 分页拉取全部 tag=shortcut-library 的 KV item。 */
  async function listAll(): Promise<Array<{ key: string; value: string }>> {
    const items: Array<{ key: string; value: string }> = [];
    let offset = 0;
    for (;;) {
      const page = await kvV1Service.list({ tags: [TAG], match: 'any', limit: LIST_LIMIT, offset });
      items.push(...page.items);
      if (items.length >= page.total || page.items.length === 0) break;
      offset += page.items.length;
    }
    return items;
  }

  function safeParse<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** 用已解析的 group/shortcut 记录重建组件要的 Group[](丢孤儿、按 order 排序)。 */
  function assemble(groups: Map<string, GroupRecord>, shortcuts: Map<string, ShortcutRecord>): Group[] {
    const sortedGroups = [...groups.values()].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    return sortedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      shortcuts: [...shortcuts.values()]
        .filter((s) => s.groupId === g.id)
        .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
        .map((s) => ({ id: s.id, combo: s.combo, description: s.description, condition: s.condition, createdAt: s.createdAt })),
    }));
  }

  async function pull(): Promise<Group[]> {
    if (!jwtAuth.state.token) return [];
    const groups = new Map<string, GroupRecord>();
    const shortcuts = new Map<string, ShortcutRecord>();
    let sawNewKeys = false;

    for (const item of await listAll()) {
      if (item.key.startsWith(GROUP_PREFIX)) {
        const rec = safeParse<GroupRecord>(item.value);
        if (rec?.id) {
          groups.set(rec.id, rec);
          sawNewKeys = true;
        }
      } else if (item.key.startsWith(SHORTCUT_PREFIX)) {
        const rec = safeParse<ShortcutRecord>(item.value);
        if (rec?.id) {
          shortcuts.set(rec.id, rec);
          sawNewKeys = true;
        }
      }
    }

    // 没有任何新 schema 的 key → 尝试把旧 'shortcuts' blob 迁移成多 key。
    if (!sawNewKeys) {
      const migrated = await tryMigrateLegacy();
      if (migrated) return migrated;
    }

    return assemble(groups, shortcuts);
  }

  /** 旧版单 blob → 逐条写新 key 再删旧 key;没有旧 blob 返回 null。 */
  async function tryMigrateLegacy(): Promise<Group[] | null> {
    let item;
    try {
      item = await kvV1Service.get({ key: LEGACY_KEY });
    } catch (e) {
      if (e instanceof ApiError && e.code === KV_CODE_NOT_FOUND) return null;
      throw e;
    }
    const legacy = safeParse<Group[]>(item.value);
    if (!Array.isArray(legacy)) return null;

    // 逐条落新 key(幂等 upsert);任一条失败就整体中止,旧 blob 保留,下次 pull 重试
    const writes: Promise<unknown>[] = [];
    legacy.forEach((g, gi) => {
      writes.push(
        kvV1Service.set({
          key: groupKey(g.id),
          value: JSON.stringify({ id: g.id, name: g.name, order: gi, createdAt: g.createdAt, updatedAt: g.updatedAt }),
          tags: [TAG],
        }),
      );
      g.shortcuts.forEach((s, si) => {
        writes.push(
          kvV1Service.set({
            key: shortcutKey(s.id),
            value: JSON.stringify({
              id: s.id,
              groupId: g.id,
              order: si,
              combo: s.combo,
              description: s.description,
              condition: s.condition,
              createdAt: s.createdAt,
              updatedAt: g.updatedAt,
            }),
            tags: [TAG],
          }),
        );
      });
    });
    await Promise.all(writes);
    // 全部落盘后再删旧 blob,避免迁移到一半丢数据
    await kvV1Service.delete({ key: LEGACY_KEY });

    return assemble(
      new Map(legacy.map((g, gi) => [g.id, { id: g.id, name: g.name, order: gi, createdAt: g.createdAt, updatedAt: g.updatedAt }])),
      new Map(
        legacy.flatMap((g) =>
          g.shortcuts.map((s, si) => [
            s.id,
            { id: s.id, groupId: g.id, order: si, combo: s.combo, description: s.description, condition: s.condition, createdAt: s.createdAt, updatedAt: g.updatedAt },
          ]),
        ),
      ),
    );
  }

  // ---- 细粒度增删改查(每 key 一个请求) ----
  // create / update 都是幂等 upsert(POST /kv),语义区分,实现共用。

  async function putGroup(g: Group, order: number): Promise<void> {
    await requireLoggedIn();
    await kvV1Service.set({
      key: groupKey(g.id),
      value: JSON.stringify({ id: g.id, name: g.name, order, createdAt: g.createdAt, updatedAt: g.updatedAt }),
      tags: [TAG],
    });
  }

  async function putShortcut(groupId: string, s: Shortcut, order: number): Promise<void> {
    await requireLoggedIn();
    await kvV1Service.set({
      key: shortcutKey(s.id),
      value: JSON.stringify({
        id: s.id,
        groupId,
        order,
        combo: s.combo,
        description: s.description,
        condition: s.condition,
        createdAt: s.createdAt,
        updatedAt: Date.now(),
      }),
      tags: [TAG],
    });
  }

  return {
    pull,
    createGroup: putGroup,
    updateGroup: putGroup,
    deleteGroup: async (id: string) => {
      await requireLoggedIn();
      await kvV1Service.delete({ key: groupKey(id) });
    },
    createShortcut: putShortcut,
    updateShortcut: putShortcut,
    deleteShortcut: async (id: string) => {
      await requireLoggedIn();
      await kvV1Service.delete({ key: shortcutKey(id) });
    },
  };
}
