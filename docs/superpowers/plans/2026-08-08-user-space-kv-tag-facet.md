# KV tag facet(组内全部 tag)接入 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** 修 user-space「KV tag 问题」:补 KV tag facet(`/api/v1/kv/tags`)调用,Inventory tag 下拉显示**组内全部成员的 tag 频次**(不再只看当前页 kv.items 的 tag 集合)。

**Architecture:** 后端 `GET /api/v1/kv/tags?groupId=N`(ref2 A6)已就绪,facet 统计组内所有成员。前端薄包装 + Inventory UI 切换。**不动后端。**

**Tech Stack:** 现有 React + ve api 分层(HttpService / createUserSpaceStore)。无新依赖。

## Global Constraints

- **不动后端**;契约见 [[api-reference]] A6
- 不改 KV 编辑器 / 创建器 / duplicate modal 的 tag 输入
- 不持久化 tag 列表(每次进 inventory tab 重新拉)
- 操作(create/update/delete/restore)完成后刷新 tag facet
- Conventional Commits;Co-Authored-By trailer
- 在 `fix/gis-runtime-bugs` 分支提交(本仓库);**不** push 不开 PR
- lint clean;`pnpm exec vitest run` 全过(原 347 + 新增)
- 不顺手重构

---

## Task 1: KV tag facet 接入

**Files:**
- Modify: `apps/showcase/src/api/services/kvV1/types.ts`(确认/加 `KvTagCount` 类型,顺带 re-export)
- Modify: `apps/showcase/src/api/services/kvV1/index.ts`(加 `tags({groupId})` 方法)
- Modify: `apps/showcase/src/api/services/kvV1/` types 索引(如必要 re-export)
- Modify: `apps/showcase/src/api/components/user-space/types.ts`(`UserSpaceStore` 加 `listKvTags(groupId)`)
- Modify: `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`(实现 `listKvTags` 调 `kvV1Service.tags` 传 groupId)
- Modify: `apps/showcase/src/api/components/user-space/index.ts`(re-export KvTagCount 如有)
- Modify: `packages/react-components/src/user-space/src/types.ts`(透传 KvTagCount)
- Modify: `packages/react-components/src/user-space/index.tsx`(加 state `kvTags`,view==='inventory' effect 拉 facet;create/update/delete/restore 后刷新)
- Modify: `packages/react-components/src/user-space/src/pages/Inventory.tsx`(接收 `tags` prop,tag select 用 facet 而不是 items 内收集)
- Test: `apps/showcase/__tests__/kvV1.test.ts`(加 `tags()` 方法单测)

**Interfaces:**
- `KvV1Service.tags(args: { groupId?: number }): Promise<KvTagCount[]>`(GET /tags?groupId=...)
- `KvTagCount { tag: string; count: number }`(ref2 已有,如缺则补)
- `UserSpaceStore.listKvTags(groupId: number): Promise<KvTagCount[]>`
- Inventory 接收 `tags: KvTagCount[]` prop,从 facet 显示(下拉格式:`{tag} ({count})`,空时显示「所有 tag」)

### Step 1: 写失败测试(kvV1 层)

`apps/showcase/__tests__/kvV1.test.ts` 已有结构。加:

```ts
it('tags() returns [{tag, count}] sorted by count desc', async () => {
  // stub request.ts api.get('/api/v1/kv/tags?groupId=42') → [{tag:'prod',count:3},{tag:'cache',count:1}]
  // 断言 service.tags({groupId:42}) 透传 groupId,返回 facet
});

it('tags() omits groupId when 0 or undefined (uses caller default)', async () => {
  // 断言不传 groupId → URL 无 ?groupId=
});
```

跑:`pnpm exec vitest run apps/showcase/__tests__/kvV1.test.ts -t tags` → 应 FAIL(tags 方法不存在)。

### Step 2: 加 `KvTagCount` 类型 + `tags()` 方法

`apps/showcase/src/api/services/kvV1/types.ts`(如有 `KvTagCount` 已声明跳过):

```ts
export interface KvTagCount {
  tag: string;
  count: number;
}
```

`apps/showcase/src/api/services/kvV1/index.ts` 加:

```ts
async tags(args: { groupId?: number } = {}): Promise<KvTagCount[]> {
  const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
  return this.reqGet<KvTagCount[]>(`/tags${qs}`);
}
```

re-export `KvTagCount` 在 services barrel 中(检查 `apps/showcase/src/api/services/index.ts`,kvV1 一般已 re-export 全部类型)。

跑 Step 1 测试 → PASS。

### Step 3: store 加 listKvTags

`UserSpaceStore` 接口(在 `apps/showcase/src/api/components/user-space/types.ts`)加:

```ts
listKvTags(groupId: number): Promise<KvTagCount[]>;
```

`createUserSpaceStore.ts` 实现:

```ts
async function listKvTags(groupId: number): Promise<KvTagCount[]> {
  requireAuth();
  return kvV1Service.tags({ groupId });
}
```

return 里导出。

### Step 4: user-space 顶层拉 facet,Inventory 用

`packages/react-components/src/user-space/index.tsx`:

- 加 state `kvTags` (`useState<KvTagCount[]>([])`)
- `loadKvTags` useCallback:`setKvTags(await store.listKvTags(currentSelected))`
- view==='inventory' effect:除了 loadKv,再 loadKvTags(并行)
- 切组时清空(已有 effect 加 `setKvTags([])`)
- 操作(createKv/updateKv/deleteKv/restoreKv)成功后 `loadKvTags(currentSelected)` 刷新 facet
- 渲染:`<Inventory ... tags={kvTags} ... />`

`Inventory.tsx` 接受新 prop `tags: KvTagCount[]`。删掉旧 `tagOptions` useMemo。改 select:

```tsx
<select value={selectedTag ?? ''} onChange={(e) => onTagChange(e.target.value || null)}>
  <option value="">所有 tag</option>
  {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
</select>
```

`src/types.ts` 透传 `KvTagCount`。

### Step 5: 验证 + commit

```bash
pnpm exec vitest run apps/showcase/__tests__/kvV1.test.ts   # 新 tags 测试过
pnpm exec vitest run apps/showcase/__tests__/user-space-store.test.ts   # 加 listKvTags 单测(可选,本期可省)
pnpm exec vitest run   # 347 + 新增 全过
pnpm exec eslint --max-warnings=0 apps/showcase/src/api/services/kvV1/ apps/showcase/src/api/components/user-space/ packages/react-components/src/user-space/   # 干净
git add -A
git commit -m "$(cat <<'EOF'
feat(user-space): KV tag facet — show all group tags, not just current page

Add kvV1Service.tags({groupId}) -> GET /kv/tags. createUserSpaceStore
exposes listKvTags(groupId). Inventory tag select now renders
[{tag, count}] sorted by count desc, refreshed after create/update/
delete/restore. Fixes tag discovery: tags on other pages were
previously invisible.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

## 不做

- 不修 createInvitation 的 email 可选(簇 C 单独做)
- 不为 file 域加 tags facet(本期 file 模块未接入 user-space)
- 不持久化 tag 列表
- 不动 Inventory 的其他列(值预览、过期等)
- 不加 tag 输入提示(已有的 KvEditorModal 不动)

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\task-2-report.md`:
- 状态、改动摘要、测试摘要、commit hash、顾虑

## 返回

状态、commit hash、测试摘要(原 X / 新 Y)、顾虑。完成后再 `kvcli todo done 2 --result "..."` 回填。