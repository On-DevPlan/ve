# user-space KV CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 user-space 组件的 KV 库存 tab 里实现 KV 增删改查(基础 CRUD + 分页 + tag 过滤),并把 kvV1Service 从遗留契约升级到 groupId 维度。

**Architecture:** 三层贯穿 —— (1) `kvV1Service` 升级 set/get/delete 到 groupId 契约并删掉废弃 `visibility`(同步修 shortcut-library 调用);(2) `createUserSpaceStore` 增加 `createKv/updateKv/deleteKv/getKvDetail/listKvs`,其中 `listKvs` 复用后端 `list`(自带 value 全文,消除当前 N+1);(3) `Inventory.tsx` 扩展为管理视图,新增 `KvEditorModal` 承担新建/编辑表单,权限按 `myRole` 闸门。

**Tech Stack:** TypeScript、React 19、Vite、Vitest(host 侧 mock `global.fetch`,组件侧 source-level 断言)、现有 `sl-us-*` CSS token 体系。

## Global Constraints

- 遵循 `apps/showcase/src/api/services/README.md`「目录内部 import 规则」:`api/` 目录内部走相对路径,不 import `@api`(barrel),避免 self-cycle
- `BASE` 必须来自 `registry.apiPaths`,不自接 fetch、不 import `api/http/request`
- 后端已废弃 `visibility`/`ownerId`(groupId 维度):**任何新代码不得再发 `visibility` 字段**,`ownerId` query 一并移除
- KV 权限:`Set/Delete` → `owner|admin|writer`;`Get/List` → 任意成员;UI 用 `hasMinRole`(allowlist)做读写闸门,`reader` 只读
- key 不可改(唯一键 `(group_id,key)`);ttl 单位秒(UI 以"天"输入,0=永久)
- 组件 CSS 类名 `sl-us-*` 前缀;全部走 `var(--sl-*)` token
- 提交遵循 Conventional Commits,`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: kvV1Service 升级到 groupId 契约

**Files:**
- Modify: `apps/showcase/src/api/services/kvV1/types.ts`
- Modify: `apps/showcase/src/api/services/kvV1/index.ts`
- Modify: `apps/showcase/src/api/components/shortcut-library/createShortcutStore.ts`
- Test: `apps/showcase/__tests__/kvV1.test.ts`
- Test: `apps/showcase/__tests__/shortcut-library-store.test.ts`

**Interfaces:**
- Produces (Task 2/3 依赖):
  - `KvSetArgs { key: string; value: string; ttl?: number; tags?: string[]; groupId?: number }`
  - `KvGetArgs { key: string; groupId?: number }`
  - `KvDeleteArgs { key: string; groupId?: number }`
  - `KvItem` 补必填 `groupId: number; groupName: string; myRole: 'owner'|'admin'|'writer'|'reader'`,删 `visibility`
  - `kvV1Service.set/get/delete/list` 签名如上

- [ ] **Step 1: 更新 kvV1.test.ts 断言到新契约**

把 `apps/showcase/__tests__/kvV1.test.ts` 中三处断言改为:

```ts
it('set POSTs to /api/v1/kv with Bearer header + tags + no visibility', async () => {
  const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
  global.fetch = mockFetch;

  await kvV1Service.set({
    key: 'shortcuts',
    value: '{}',
    tags: ['prod', 'cache'],
    groupId: 42,
  });

  const url = mockFetch.mock.calls[0][0] as string;
  expect(url).toBe('/api/v1/kv');
  const init = mockFetch.mock.calls[0][1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-xyz' });
  const body = JSON.parse(init.body as string) as Record<string, unknown>;
  expect(body).toMatchObject({ key: 'shortcuts', value: '{}', ttl: 0, tags: ['prod', 'cache'], groupId: 42 });
  expect(body).not.toHaveProperty('visibility');
});

it('get appends groupId query when provided', async () => {
  const mockFetch = vi.fn().mockResolvedValue(
    mockJSON(200, {
      code: 0,
      data: { key: 'k', value: 'v', expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: [] },
    }),
  );
  global.fetch = mockFetch;

  await kvV1Service.get({ key: 'k', groupId: 42 });

  const url = mockFetch.mock.calls[0][0] as string;
  expect(url).toBe('/api/v1/kv/k?groupId=42');
});

it('delete sends DELETE with groupId query', async () => {
  const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
  global.fetch = mockFetch;

  await kvV1Service.delete({ key: 'shortcuts', groupId: 42 });

  const url = mockFetch.mock.calls[0][0] as string;
  expect(url).toBe('/api/v1/kv/shortcuts?groupId=42');
  expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
});
```

删除原 `get appends ownerId when > 0` 测试,并删掉 `set defaults tags to []` 测试里残留的 `visibility` 相关(该测试 body 只断言 `tags`,无需改)。

- [ ] **Step 2: 跑 kvV1 测试确认失败**

Run: `pnpm exec vitest run --project showcase __tests__/kvV1.test.ts`
Expected: FAIL —— 现在 set 仍发 `visibility`、get 用 `ownerId`、delete 无 groupId query。

- [ ] **Step 3: 改 kvV1/types.ts 与 kvV1/index.ts**

`apps/showcase/src/api/services/kvV1/types.ts` 全文替换为:

```ts
export interface KvItem {
  key: string;
  value: string;
  groupId: number;
  groupName: string;
  myRole: 'owner' | 'admin' | 'writer' | 'reader';
  expires_at: string;
  /** 按字母序返回;空数组表示无 tag */
  tags?: string[];
}

export interface KvListResponse {
  items: KvItem[];
  total: number;
}

export interface KvSetArgs {
  key: string;
  value: string;
  /** 秒;0=永不过期 */
  ttl?: number;
  /** replace 语义:会替换已有 tag;空数组 = 清空 */
  tags?: string[];
  /** 工作空间 id;0 或不传 = 默认组 */
  groupId?: number;
}

export interface KvGetArgs {
  key: string;
  groupId?: number;
}

export interface KvDeleteArgs {
  key: string;
  groupId?: number;
}

export interface KvListArgs {
  limit?: number;
  offset?: number;
  tags?: string[];
  match?: 'any' | 'all';
  groupId?: number;
}

export interface KvTagCount {
  tag: string;
  count: number;
}
```

`apps/showcase/src/api/services/kvV1/index.ts` 中 `set/get/delete` 方法替换为:

```ts
async set(args: KvSetArgs): Promise<void> {
  const body: { key: string; value: string; ttl: number; tags: string[]; groupId?: number } = {
    key: args.key,
    value: args.value,
    ttl: args.ttl ?? 0,
    // replace 语义:传了就用,没传默认 [] = 清空
    tags: args.tags ?? [],
  };
  if (args.groupId !== undefined && args.groupId > 0) body.groupId = args.groupId;
  await this.reqPost('', body);
}

async get(args: KvGetArgs): Promise<KvItem> {
  const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
  return this.reqGet<KvItem>(`/${encodeURIComponent(args.key)}${qs}`);
}

async delete(args: KvDeleteArgs): Promise<void> {
  const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
  await this.reqDelete(`/${encodeURIComponent(args.key)}${qs}`);
}
```

同步更新 `kvV1/index.ts` 的 import:把 `KvGetArgs, KvSetArgs` 换成 `KvDeleteArgs` 一并引入;去掉 `Visibility` 类型的 re-export。

- [ ] **Step 4: 同步修 shortcut-library(去 visibility)**

`apps/showcase/src/api/components/shortcut-library/createShortcutStore.ts` 的 `save()` 里:

```ts
await kvV1Service.set({
  key: BLOB_KEY,
  value: JSON.stringify(groups),
  visibility: 'private',
  tags: [...SHORTCUT_TAGS],
});
```

改为(去掉 `visibility` 行,写默认组不传 groupId):

```ts
await kvV1Service.set({
  key: BLOB_KEY,
  value: JSON.stringify(groups),
  tags: [...SHORTCUT_TAGS],
});
```

`apps/showcase/__tests__/shortcut-library-store.test.ts` 的 `saves private groups while logged in, tagged shortcut-library` 测试,把断言:

```ts
expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({ body: expect.stringContaining('"visibility":"private"') }));
```

改为:

```ts
expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({ body: expect.stringContaining('"tags":["shortcut-library"]') }));
```

同时去掉 `expect(...).not.toContain('"visibility"')` 可加可省,保留 tags 断言即可。

- [ ] **Step 5: 跑相关测试确认通过**

Run: `pnpm exec vitest run --project showcase`
Expected: 全部通过(含 `kvV1.test.ts`、`shortcut-library-store.test.ts`、`registry-conflict.test.ts`)。

- [ ] **Step 6: Commit**

```bash
git add apps/showcase/src/api/services/kvV1 apps/showcase/src/api/components/shortcut-library/createShortcutStore.ts apps/showcase/__tests__/kvV1.test.ts apps/showcase/__tests__/shortcut-library-store.test.ts
git commit -m "refactor(kv): upgrade kvV1Service to groupId contract, drop visibility

set/get/delete 支持 groupId;KvItem 补 groupId/groupName/myRole;移除废弃
visibility 字段;同步修 shortcut-library 调用与测试断言。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: user-space store KV CRUD + listKvs

**Files:**
- Create: `apps/showcase/__tests__/user-space-store.test.ts`
- Modify: `apps/showcase/src/api/components/user-space/types.ts`
- Modify: `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`

**Interfaces:**
- Consumes: Task 1 的 `kvV1Service.set({key,value,ttl,tags,groupId})` / `get({key,groupId})` / `delete({key,groupId})` / `list({limit,offset,tags,groupId})`
- Produces (Task 3 依赖):
  - `KvView { key, value, valuePreview, valueLength, tags, groupId, groupName, myRole, expiresAt }`
  - `KvListResult { items: KvView[]; total; page; pageSize }`
  - `UserSpaceStore` 新方法:`createKv(groupId, KvEditorPayload)`, `updateKv(groupId, KvEditorPayload)`, `deleteKv(groupId, key)`, `getKvDetail(groupId, key): Promise<KvView>`, `listKvs(groupId, {page, pageSize, tags?}): Promise<KvListResult>`
  - `KvEditorPayload { key: string; value: string; tags: string[]; ttl: number }`(ttl 秒,0=永久)
  - 删除旧的 `GroupKvInventory` / `GroupKvKeyView`

- [ ] **Step 1: 写失败的 user-space-store 测试**

新建 `apps/showcase/__tests__/user-space-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtAuth } from '../src/api/http/auth-store';
import { createUserSpaceStore } from '../src/api/components/user-space';

const originalState = jwtAuth.state;

function loggedIn(): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({
      ...originalState,
      token: 'jwt-abc',
      jwtAuthState: 'logged-in',
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'alice', invitationCode: 'X' },
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
});

function okBody(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
}

describe('user-space store KV CRUD', () => {
  beforeEach(() => loggedIn());

  it('createKv POSTs set with groupId and no visibility', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.createKv(42, { key: 'api_url', value: 'https://x', tags: ['prod'], ttl: 0 });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"groupId":42'),
    }));
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).not.toContain('"visibility"');
  });

  it('updateKv also sets with groupId (upsert by key)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.updateKv(42, { key: 'api_url', value: 'v2', tags: [], ttl: 0 });
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain('"key":"api_url"');
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain('"value":"v2"');
  });

  it('deleteKv DELETE with groupId query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.deleteKv(42, 'api_url');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/api_url?groupId=42', expect.objectContaining({ method: 'DELETE' }));
  });

  it('getKvDetail GETs with groupId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ key: 'k', value: 'v', expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: ['t'] }),
    );
    const store = createUserSpaceStore();
    const view = await store.getKvDetail(42, 'k');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/k?groupId=42', expect.anything());
    expect(view).toMatchObject({ key: 'k', value: 'v', groupId: 42, groupName: 'g', myRole: 'writer' });
  });

  it('listKvs maps pagination + groupId and truncates preview', async () => {
    const long = 'x'.repeat(120);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({
        items: [
          { key: 'k1', value: long, expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: ['t'] },
          { key: 'k2', value: 'short', expires_at: '', groupId: 42, groupName: 'g', myRole: 'reader', tags: [] },
        ],
        total: 2,
      }),
    );
    const store = createUserSpaceStore();
    const result = await store.listKvs(42, { page: 2, pageSize: 10, tags: ['prod'] });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv?limit=10&offset=10&groupId=42&tags=prod', expect.anything());
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items[0].valuePreview.endsWith('…')).toBe(true);
    expect(result.items[1].valuePreview).toBe('short');
  });

  it('throws not logged in when token missing', async () => {
    const store = createUserSpaceStore();
    // 覆盖 loggedIn mock,切回 logged-out
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
    await expect(store.createKv(1, { key: 'k', value: 'v', tags: [], ttl: 0 })).rejects.toThrow('not logged in');
  });
});
```

> 注意:`listKvs` 的 URL 顺序由 `kvV1Service.list` 的 `URLSearchParams` 构造决定 —— 现实现先 set `limit/offset/groupId`,再 append `tags`,所以期望串是 `?limit=10&offset=10&groupId=42&tags=prod`。若实现里调整了顺序,同步改断言。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run --project showcase __tests__/user-space-store.test.ts`
Expected: FAIL —— `createUserSpaceStore()` 尚无 `createKv/listKvs` 等方法。

- [ ] **Step 3: 改 types.ts(组件域)与 createUserSpaceStore.ts**

`apps/showcase/src/api/components/user-space/types.ts`:
- 删除 `GroupKvKeyView` / `GroupKvInventory` 两个接口与 `GroupKvInventory` 相关的注释
- 新增:

```ts
export interface KvView {
  key: string;
  value: string;
  valuePreview: string;
  valueLength: number;
  tags: string[];
  groupId: number;
  groupName: string;
  myRole: GroupRole;
  expiresAt: string;
}

export interface KvListResult {
  items: KvView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KvEditorPayload {
  key: string;
  value: string;
  tags: string[];
  /** 秒;0=永久 */
  ttl: number;
}
```

`UserSpaceStore` 接口删除 `inventory(id, limit?)`,替换为:

```ts
createKv(groupId: number, args: KvEditorPayload): Promise<void>;
updateKv(groupId: number, args: KvEditorPayload): Promise<void>;
deleteKv(groupId: number, key: string): Promise<void>;
getKvDetail(groupId: number, key: string): Promise<KvView>;
listKvs(groupId: number, opts: { page: number; pageSize: number; tags?: string[] }): Promise<KvListResult>;
```

`apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`:
- 顶部 `VALUE_PREVIEW_MAX` 保留(80)
- import 处去掉 `GroupKvInventory, GroupKvKeyView`,引入 `KvListResult, KvView`
- 删除旧 `inventory()` 函数;新增:

```ts
function toKvView(kv: { key: string; value: string; expires_at: string; groupId: number; groupName: string; myRole: KvView['myRole']; tags?: string[] }): KvView {
  return {
    key: kv.key,
    value: kv.value,
    valuePreview: kv.value.length > VALUE_PREVIEW_MAX ? kv.value.slice(0, VALUE_PREVIEW_MAX) + '…' : kv.value,
    valueLength: kv.value.length,
    tags: kv.tags ?? [],
    groupId: kv.groupId,
    groupName: kv.groupName,
    myRole: kv.myRole,
    expiresAt: kv.expires_at,
  };
}

async function createKv(groupId: number, args: KvEditorPayload): Promise<void> {
  requireAuth();
  await kvV1Service.set({ key: args.key, value: args.value, ttl: args.ttl, tags: args.tags, groupId });
}

async function updateKv(groupId: number, args: KvEditorPayload): Promise<void> {
  requireAuth();
  await kvV1Service.set({ key: args.key, value: args.value, ttl: args.ttl, tags: args.tags, groupId });
}

async function deleteKv(groupId: number, key: string): Promise<void> {
  requireAuth();
  await kvV1Service.delete({ key, groupId });
}

async function getKvDetail(groupId: number, key: string): Promise<KvView> {
  requireAuth();
  return toKvView(await kvV1Service.get({ key, groupId }));
}

async function listKvs(groupId: number, opts: { page: number; pageSize: number; tags?: string[] }): Promise<KvListResult> {
  requireAuth();
  const { items, total } = await kvV1Service.list({
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
    tags: opts.tags,
    groupId,
  });
  return { items: items.map(toKvView), total, page: opts.page, pageSize: opts.pageSize };
}
```

- `KvEditorPayload` 从 `./types` import
- return 对象里删 `inventory`,加 `createKv, updateKv, deleteKv, getKvDetail, listKvs`

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run --project showcase __tests__/user-space-store.test.ts`
Expected: PASS(6 个用例)。

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/api/components/user-space apps/showcase/__tests__/user-space-store.test.ts
git commit -m "feat(user-space): KV CRUD store methods + paginated listKvs

createKv/updateKv/deleteKv/getKvDetail/listKvs;listKvs 复用后端 list 自带
value 全文消除 N+1;新增 store 单测(mock global.fetch)。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Inventory 管理视图 + KvEditorModal + 接线

**Files:**
- Create: `packages/react-components/src/user-space/src/pages/KvEditorModal.tsx`
- Create: `packages/react-components/__tests__/user-space-kv-ui.test.ts`
- Modify: `packages/react-components/src/user-space/src/pages/Inventory.tsx`
- Modify: `packages/react-components/src/user-space/index.tsx`
- Modify: `packages/react-components/src/user-space/index.css`

**Interfaces:**
- Consumes: Task 2 的 `listKvs/createKv/updateKv/deleteKv` 与 `KvListResult/KvView/KvEditorPayload`;`hasMinRole`(已从 `@api/components/user-space` 导出)
- Produces:
  - `<Inventory group loading error saving kv list create/update/delete page/pageSize/total onPageChange onTagChange onReload />`
  - `<KvEditorModal open mode(kv-edit|kv-create) initial onSave onClose />`

- [ ] **Step 1: 写失败的 source-level 组件测试**

新建 `packages/react-components/__tests__/user-space-kv-ui.test.ts`(参照 `shortcut-library-features.test.ts` 的读源码断言模式,无需 React 渲染环境):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inventory = readFileSync(resolve(__dirname, '../src/user-space/src/pages/Inventory.tsx'), 'utf8');
const modal = readFileSync(resolve(__dirname, '../src/user-space/src/pages/KvEditorModal.tsx'), 'utf8');
const indexTsx = readFileSync(resolve(__dirname, '../src/user-space/index.tsx'), 'utf8');
const store = readFileSync(resolve(__dirname, '../../apps/showcase/src/api/components/user-space/createUserSpaceStore.ts'), 'utf8');

describe('user-space KV management UI', () => {
  it('Inventory renders write controls only for writer+', () => {
    expect(inventory).toContain('hasMinRole');
    expect(inventory).toContain('新建');
    expect(inventory).toContain('详情');
  });

  it('Inventory wires pagination and tag filter', () => {
    expect(inventory).toContain('pageSize');
    expect(inventory).toContain('total');
    expect(inventory).toContain('onTagChange');
  });

  it('KvEditorModal locks key in edit mode and converts ttl days to seconds', () => {
    expect(modal).toContain('disabled');
    expect(modal).toContain('* 86400');
    expect(modal).toContain('portal');
  });

  it('index.tsx passes listKvs/createKv/updateKv/deleteKv down to Inventory', () => {
    expect(indexTsx).toContain('listKvs');
    expect(indexTsx).toContain('createKv');
    expect(indexTsx).toContain('updateKv');
    expect(indexTsx).toContain('deleteKv');
  });

  it('store no longer exposes legacy inventory()', () => {
    expect(store).not.toContain('async function inventory');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run --project react-components __tests__/user-space-kv-ui.test.ts`
Expected: FAIL —— `KvEditorModal.tsx` 不存在(读取抛错),且 Inventory/index.tsx 尚不含这些接线。

- [ ] **Step 3: 实现 KvEditorModal.tsx**

新建 `packages/react-components/src/user-space/src/pages/KvEditorModal.tsx`:

```tsx
// pages/KvEditorModal.tsx —— 新建 / 编辑 KV 共用表单(portal 渲染到 shadowRoot 外)。
// 新建:key 可填;编辑:key 锁定(唯一键不可改)。ttl 以「天」输入,提交时换算秒。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KvView } from '@api/components/user-space';

export interface KvEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** 编辑模式初始值;新建传 null */
  initial: KvView | null;
  saving: boolean;
  onSave: (payload: { key: string; value: string; tags: string[]; ttl: number }) => Promise<void>;
  onClose: () => void;
}

const DAY_SECONDS = 86400;

export default function KvEditorModal({ open, mode, initial, saving, onSave, onClose }: KvEditorModalProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [ttlDays, setTtlDays] = useState(0);

  useEffect(() => {
    if (!open) return;
    setKey(mode === 'edit' && initial ? initial.key : '');
    setValue(mode === 'edit' && initial ? initial.value : '');
    setTagsText(mode === 'edit' && initial ? (initial.tags ?? []).join(', ') : '');
    setTtlDays(0);
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tags = tagsText.split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sl-us-modal" role="dialog" aria-label={mode === 'create' ? '新建 KV' : '编辑 KV'}>
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{mode === 'create' ? '新建 KV' : '编辑 KV'}</h3>
          <button className="sl-us-icon-btn" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="sl-us-modal__body">
          <label className="sl-us-field">
            <span className="sl-us-label">Key</span>
            <input
              className="sl-us-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={saving || mode === 'edit'}
              placeholder="如 api_url"
              autoFocus
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">Value</span>
            <textarea
              className="sl-us-input sl-us-input--textarea"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={saving}
              rows={6}
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">Tags(逗号分隔)</span>
            <input
              className="sl-us-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={saving}
              placeholder="prod, cache"
            />
          </label>
          <label className="sl-us-field">
            <span className="sl-us-label">TTL(天,0=永久)</span>
            <input
              className="sl-us-input"
              type="number"
              min={0}
              value={ttlDays}
              onChange={(e) => setTtlDays(Number(e.target.value))}
              disabled={saving}
            />
          </label>
        </div>
        <footer className="sl-us-modal__foot">
          <button className="sl-us-btn" onClick={onClose} disabled={saving}>取消</button>
          <button
            className="sl-us-btn sl-us-btn--primary"
            disabled={saving || !key.trim() || mode === 'edit' && !initial}
            onClick={() => void onSave({
              key: key.trim(),
              value,
              tags,
              ttl: ttlDays > 0 ? ttlDays * DAY_SECONDS : 0,
            })}
          >
            {saving ? '保存中…' : mode === 'create' ? '创建' : '保存'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
```

- [ ] **Step 4: 改造 Inventory.tsx 为管理视图**

`packages/react-components/src/user-space/src/pages/Inventory.tsx` 全文替换为:

```tsx
// pages/Inventory.tsx —— KV 管理视图(列表 + 新建/详情/编辑/删除 + 分页/tag 过滤)
// 权限:myRole ∈ {owner,admin,writer} 显示写操作;reader 只读。删除走行内二次确认。

import { useMemo } from 'react';
import type { KvListResult, KvView, GroupSummary } from '@api/components/user-space';
import { hasMinRole } from '@api/components/user-space';

export interface InventoryProps {
  group: GroupSummary;
  kv: KvListResult | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  page: number;
  pageSize: number;
  selectedTag: string | null;
  onPageChange: (page: number) => void;
  onTagChange: (tag: string | null) => void;
  onCreate: () => void;
  onEdit: (item: KvView) => void;
  onDelete: (item: KvView) => void;
  onReload: () => Promise<void>;
}

export default function Inventory(props: InventoryProps) {
  const { group, kv, loading, error, saving, page, pageSize, selectedTag, onPageChange, onTagChange, onCreate, onEdit, onDelete, onReload } = props;
  const canWrite = hasMinRole(group.myRole, 'writer');

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of kv?.items ?? []) for (const t of item.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [kv]);

  const totalPages = kv ? Math.max(1, Math.ceil(kv.total / pageSize)) : 1;

  return (
    <section className="sl-us-view sl-us-inventory">
      <div className="sl-us-view__head">
        <h3 className="sl-us-view__title">KV 管理</h3>
        <span className="sl-us-view__spacer" />
        <select
          className="sl-us-input sl-us-input--compact"
          value={selectedTag ?? ''}
          onChange={(e) => onTagChange(e.target.value || null)}
          aria-label="按 tag 过滤"
        >
          <option value="">全部 tag</option>
          {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {canWrite && (
          <button className="sl-us-btn sl-us-btn--primary" onClick={onCreate} disabled={saving}>
            + 新建 KV
          </button>
        )}
        <button className="sl-us-btn" onClick={() => void onReload()} disabled={loading}>
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      {error && <div className="sl-us-error">{error}</div>}

      <table className="sl-us-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Tags</th>
            <th>过期时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(!kv || kv.items.length === 0) && !loading && (
            <tr><td colSpan={5} className="sl-us-table__empty">该组暂无 KV</td></tr>
          )}
          {kv?.items.map((item) => (
            <KvRow
              key={item.key}
              item={item}
              canWrite={canWrite}
              saving={saving}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>

      <div className="sl-us-pager">
        <span className="sl-us-pager__info">共 {kv?.total ?? 0} 条</span>
        <button className="sl-us-btn" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>上一页</button>
        <span className="sl-us-pager__page">{page} / {totalPages}</span>
        <button className="sl-us-btn" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)}>下一页</button>
      </div>
    </section>
  );
}

function KvRow({ item, canWrite, saving, onEdit, onDelete }: {
  item: KvView; canWrite: boolean; saving: boolean;
  onEdit: (item: KvView) => void; onDelete: (item: KvView) => void;
}) {
  return (
    <tr>
      <td><code className="sl-us-code">{item.key}</code></td>
      <td className="sl-us-inv-value">{item.valuePreview || '—'}</td>
      <td>
        {item.tags.length === 0 ? <span className="sl-us-muted">—</span> : item.tags.map((t) => <span key={t} className="sl-us-badge sl-us-badge--tag">{t}</span>)}
      </td>
      <td>{item.expiresAt || '—'}</td>
      <td>
        <span className="sl-us-table__actions">
          <button className="sl-us-btn" onClick={() => onEdit(item)} title="查看/编辑详情">详情</button>
          {canWrite && (
            <>
              <button className="sl-us-btn" disabled={saving} onClick={() => onEdit(item)} title="编辑">编辑</button>
              <button
                className="sl-us-btn sl-us-btn--danger-ghost"
                disabled={saving}
                onClick={() => { if (window.confirm(`删除 KV「${item.key}」?`)) onDelete(item); }}
              >
                删除
              </button>
            </>
          )}
        </span>
      </td>
    </tr>
  );
}
```

- [ ] **Step 5: index.tsx 接线**

`packages/react-components/src/user-space/index.tsx`:

1. import 处加 `KvEditorModal` 和类型 `KvView`:

```tsx
import KvEditorModal from './src/pages/KvEditorModal';
import type { KvListResult, KvView } from './src/types';
```

2. 替换 inventory state 与 load 逻辑(原 `inventory`/`inventoryLoading`/`inventoryError`/`loadInventory`):

```tsx
const [kv, setKv] = useState<KvListResult | null>(null);
const [kvLoading, setKvLoading] = useState(false);
const [kvError, setKvError] = useState<string | null>(null);
const [kvPage, setKvPage] = useState(1);
const [kvTag, setKvTag] = useState<string | null>(null);
const [kvEditorOpen, setKvEditorOpen] = useState(false);
const [kvEditorMode, setKvEditorMode] = useState<'create' | 'edit'>('create');
const [kvEditorInit, setKvEditorInit] = useState<KvView | null>(null);
const KV_PAGE_SIZE = 10;

const loadKv = useCallback(async () => {
  if (!currentSelected) return;
  setKvLoading(true);
  setKvError(null);
  try {
    const result = await store.listKvs(currentSelected, { page: kvPage, pageSize: KV_PAGE_SIZE, tags: kvTag ?? undefined });
    setKv(result);
  } catch (e) {
    setKvError(e instanceof Error ? e.message : 'load kv failed');
  } finally {
    setKvLoading(false);
  }
}, [currentSelected, kvPage, kvTag, store]);
```

3. 原「切组清空子视图」的 `setInventory(null)` 改为 `setKv(null)`、`setKvPage(1)`、`setKvTag(null)`、`setKvEditorOpen(false)`

4. 原 `view === 'inventory'` 的 effect 依赖数组加入 `kvPage, kvTag`;触发 `loadKv`

5. 新增 handler:

```tsx
async function handleCreateKv(payload: { key: string; value: string; tags: string[]; ttl: number }): Promise<void> {
  if (!currentSelected) return;
  await withError(async () => {
    await store.createKv(currentSelected, payload);
    setKvEditorOpen(false);
    setKvPage(1); // 新建后回到第一页,新 key 在前
    await loadKv();
  });
}

async function handleUpdateKv(payload: { key: string; value: string; tags: string[]; ttl: number }): Promise<void> {
  if (!currentSelected) return;
  await withError(async () => {
    await store.updateKv(currentSelected, payload);
    setKvEditorOpen(false);
    await loadKv();
  });
}

async function handleDeleteKv(item: KvView): Promise<void> {
  if (!currentSelected) return;
  await withError(async () => {
    await store.deleteKv(currentSelected, item.key);
    // 末页删空则回退一页
    if (kv && kv.items.length === 1 && kvPage > 1) setKvPage((p) => p - 1);
    await loadKv();
  });
}
```

6. 渲染 Inventory 改为:

```tsx
{view === 'inventory' && (
  <>
    <Inventory
      group={selectedGroup}
      kv={kv}
      loading={kvLoading}
      error={kvError}
      saving={saving}
      page={kvPage}
      pageSize={KV_PAGE_SIZE}
      selectedTag={kvTag}
      onPageChange={(p) => setKvPage(p)}
      onTagChange={(t) => { setKvTag(t); setKvPage(1); }}
      onCreate={() => { setKvEditorMode('create'); setKvEditorInit(null); setKvEditorOpen(true); }}
      onEdit={(item) => { setKvEditorMode('edit'); setKvEditorInit(item); setKvEditorOpen(true); }}
      onDelete={handleDeleteKv}
      onReload={loadKv}
    />
    <KvEditorModal
      open={kvEditorOpen}
      mode={kvEditorMode}
      initial={kvEditorInit}
      saving={saving}
      onSave={kvEditorMode === 'create' ? handleCreateKv : handleUpdateKv}
      onClose={() => setKvEditorOpen(false)}
    />
  </>
)}
```

7. `./src/types.ts` 加 `export type { KvListResult, KvView } from '@api/components/user-space';`

- [ ] **Step 6: index.css 补样式**

`packages/react-components/src/user-space/index.css` 末尾追加:

```css
/* KV 管理 */
.sl-us-input--compact { width: auto; }
.sl-us-pager { display: flex; align-items: center; gap: 8px; }
.sl-us-pager__info { font-size: 12px; color: var(--sl-color-text-muted, #6b7280); }
.sl-us-pager__page { font-size: 12px; color: var(--sl-color-text-muted, #6b7280); }

.sl-us-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

.sl-us-modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.sl-us-modal {
  width: min(560px, 92vw); max-height: 86vh; overflow-y: auto;
  background: var(--sl-color-surface, #ffffff);
  border: 1px solid var(--sl-color-border, #e5e7eb);
  border-radius: 10px; padding: 16px;
  font-family: var(--sl-font-family, system-ui, sans-serif);
  color: var(--sl-color-text, #1f2328);
}
.sl-us-modal__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.sl-us-modal__title { margin: 0; font-size: 16px; font-weight: 600; }
.sl-us-modal__body { display: flex; flex-direction: column; }
.sl-us-modal__foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
```

- [ ] **Step 7: 跑测试 + lint + build**

Run:
```bash
pnpm exec vitest run --project react-components __tests__/user-space-kv-ui.test.ts
pnpm lint
pnpm build
```
Expected: 组件测试 PASS;lint 0 error / 0 warning;build 成功且 `rc-user-space-*.js` 独立 chunk。

- [ ] **Step 8: Commit**

```bash
git add packages/react-components/src/user-space packages/react-components/__tests__/user-space-kv-ui.test.ts
git commit -m "feat(user-space): KV management UI with CRUD + pagination + tag filter

Inventory 扩展为管理视图;新增 KvEditorModal(新建/编辑,key 编辑锁定,ttl 天转秒);
分页与 tag 过滤;writer+ 才显示写操作;source-level 组件测试。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 自审记录

- **Spec coverage**:服务层升级(Task 1)、store CRUD + 消除 N+1(Task 2)、UI 管理视图 + KvEditorModal + 分页/tag + 权限(Task 3)、错误处理(withError 沿用,Task 3 step 5)、测试(kvV1/shortcut-library/user-space-store/user-space-kv-ui)全部覆盖。手动验收(reader 只读、devtools 无 visibility)在 Task 3 step 7 后的「验收」说明。
- **占位符**:无 TDD/TBD;每个代码步骤含完整代码块。
- **类型一致性**:`KvSetArgs.groupId?` → `kvV1Service.set`;`KvView`/`KvListResult`/`KvEditorPayload` 在 Task 2 定义、Task 3 消费,字段名一致(`valuePreview/valueLength/expiresAt/groupName/myRole`)。`hasMinRole` 已在 Task 之前的 user-space barrel 导出,Task 3 直接 import。
