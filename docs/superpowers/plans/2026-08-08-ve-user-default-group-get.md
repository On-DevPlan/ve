# 适配后端 GET /api/v1/user/default-group · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 ve 前端能直接拿后端 GET /api/v1/user/default-group 拿到当前默认工作空间 {groupId, name, myRole},消除 createUserSpaceStore 里 listGroups() 的兜底依赖,并在 user-space 顶部默认徽章展示 name + role(目前只展示「默认」字样)。

**Architecture:** 薄包装 userV1Service.getDefaultGroup()(GET 请求,401 由 request.ts 静默降级);store.resolveDefaultGroupId 改用它(优先路径,失败兜底仍保留 listGroups);UI 顶部把 myRole 显示成 chip、把 groupName 显示在 default 徽章里。

**Tech Stack:** 现有 React + ve api 分层(HttpService / createUserSpaceStore)。无新依赖。

## Global Constraints

- 后端 GET /api/v1/user/default-group 已就绪(契约:`{groupId, name, myRole}`);**不动后端**
- 用户 token 不足时后端 401 → 由现有 `request.ts` 静默降级(不发自动 logout,保留 creds)—— 与现有 userV1.info() 同款处理
- 不重写 resolveDefaultGroupId,只把 listGroups 兜底路径换成新接口优先 + 失败兜底保留
- Conventional Commits;commit 末尾附 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 在 `fix/gis-runtime-bugs` 分支提交(本仓库);**不** push 不开 PR(用户后续决定)
- 不顺手重构
- lint clean;`pnpm exec vitest run` 全过(原 339 + 新增)

---

## Task 1: 适配 GET /user/default-group

**Files:**
- Modify: `apps/showcase/src/api/services/userV1/types.ts`(加 `DefaultGroupInfo` 类型)
- Modify: `apps/showcase/src/api/services/userV1/index.ts`(加 `getDefaultGroup()`)
- Modify: `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`(`resolveDefaultGroupId` 优先用新接口)
- Modify: `apps/showcase/src/api/components/user-space/index.ts`(re-export 类型如有)
- Modify: `packages/react-components/src/user-space/src/types.ts`(透传类型如有需要)
- Modify: `packages/react-components/src/user-space/index.tsx`(顶部默认徽章展示 name+role)
- Test: `apps/showcase/__tests__/userV1.test.ts`(加 getDefaultGroup 用例)
- Test: `apps/showcase/__tests__/user-space-store.test.ts`(加 resolveDefaultGroupId 走新接口的用例)

**Interfaces:**
- `UserV1Service.getDefaultGroup(): Promise<DefaultGroupInfo>`(GET /default-group,401 时抛 ApiError 401)
- `DefaultGroupInfo { groupId: number; name: string; myRole: GroupRole }`
- `createUserSpaceStore.resolveDefaultGroupId()` 优先调新接口(groupId > 0 直接返回),失败/未设置时走 listGroups 兜底(保留旧行为,见 `c75e70e` 之前的实现路径)
- `UserSpaceStore.getDefaultGroupInfo(): Promise<DefaultGroupInfo>` 新增,UI 用它显示 name+role

### Step 1: 写失败测试(userV1 层)

`apps/showcase/__tests__/userV1.test.ts` 已有 userV1Service 测试结构。加:

```ts
it('getDefaultGroup returns {groupId, name, myRole}', async () => {
  const fakeHttp = { get: vi.fn().mockResolvedValue({ groupId: 42, name: 'project-x', myRole: 'owner' }) };
  // 注入到 userV1Service 或直接 stub request.ts 的 api.get
  // 断言 get('/default-group') 走 BASE 派路径 = apiPaths.userV1
});
```

运行:`pnpm exec vitest run apps/showcase/__tests__/userV1.test.ts -t getDefaultGroup` → 应 FAIL(getDefaultGroup 不存在)。

### Step 2: 实现类型 + service 方法

`apps/showcase/src/api/services/userV1/types.ts` 加:

```ts
export type { GroupRole } from '../groupV1/types';
import type { GroupRole } from '../groupV1/types';

export interface DefaultGroupInfo {
  groupId: number;
  name: string;
  myRole: GroupRole;
}
```

`apps/showcase/src/api/services/userV1/index.ts` 加:

```ts
import type { UserInfo, RegisterArgs, DefaultGroupInfo } from './types';
export type { /* 现有 */, DefaultGroupInfo } from './types';

/** GET /default-group —— 当前默认工作空间 {groupId, name, myRole};未设置返回 groupId=0。 */
getDefaultGroup(): Promise<DefaultGroupInfo> {
  return this.reqGet<DefaultGroupInfo>('/default-group');
}
```

跑 Step 1 测试 → PASS。

### Step 3: store 层加 getDefaultGroupInfo,resolveDefaultGroupId 改造

`apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`:

```ts
import { /* 现有 */, userV1Service } from '../../services';
import type { /* 现有 */, DefaultGroupInfo } from '../../services/userV1/types';
export type { DefaultGroupInfo };
```

```ts
// resolveDefaultGroupId:优先新接口,失败/未设置走 listGroups 兜底
async function resolveDefaultGroupId(): Promise<number | null> {
  try {
    const info = await userV1Service.getDefaultGroup();
    if (info.groupId > 0) return info.groupId;
    return null; // 未设置,不再走兜底(避免把「第一个组」误当默认)
  } catch {
    // 网络/401/500 → 兜底(保持现有行为)
  }
  try {
    const { groups } = await groupV1Service.list();
    if (groups.length > 0) return groups[0].id;
  } catch { /* 全部失败 */ }
  return null;
}

async function getDefaultGroupInfo(): Promise<DefaultGroupInfo> {
  const user = requireAuth();
  try {
    return await userV1Service.getDefaultGroup();
  } catch {
    return { groupId: 0, name: '', myRole: 'reader' as GroupRole };
  }
}
```

`UserSpaceStore` 接口加 `getDefaultGroupInfo(): Promise<DefaultGroupInfo>`,return 里加导出。

### Step 4: user-space UI 顶部展示 name + role

`packages/react-components/src/user-space/index.tsx`:

- 加 state `defaultGroupInfo`(`useState<DefaultGroupInfo | null>(null)`)
- `reload` 同时拉 defaultGroupInfo(在 listGroups 之后)
- 顶部 default 徽章:从「默认」字样 → `{name || '默认'} · {myRole.toUpperCase()}`(若 groupName 空则显示「默认」)
- `selectedGroup` 渲染时优先用 defaultGroupInfo 的 name 填充(若 selectedGroup 未就绪)

`packages/react-components/src/user-space/src/types.ts` 透传 `DefaultGroupInfo`。

### Step 5: store 测试

`apps/showcase/__tests__/user-space-store.test.ts` 加:

```ts
it('resolveDefaultGroupId prefers new /default-group endpoint', async () => {
  // stub userV1Service.getDefaultGroup → { groupId: 99, name: 'p', myRole: 'owner' }
  // 断言 listGroups() 不被调,getDefaultGroupId() 返回 99
});

it('falls back to listGroups when /default-group fails', async () => {
  // stub userV1Service.getDefaultGroup → throw
  // stub groupV1Service.list → [{ id: 7, ... }]
  // 断言返回 7
});

it('returns null when default is unset (groupId=0)', async () => {
  // stub getDefaultGroup → { groupId: 0, name: '', myRole: 'reader' }
  // 断言不调 listGroups,返回 null
});
```

### Step 6: 验证 + commit

```bash
pnpm exec vitest run apps/showcase/__tests__/userV1.test.ts apps/showcase/__tests__/user-space-store.test.ts   # 全过
pnpm exec eslint --max-warnings=0 apps/showcase/src/api/services/userV1/ apps/showcase/src/api/components/user-space/ packages/react-components/src/user-space/   # 干净
pnpm exec vitest run   # 全仓库 339 + 新增 全过
git add -A
git commit -m "$(cat <<'EOF'
feat(user-space): adapt GET /user/default-group

Add userV1Service.getDefaultGroup() returning
{groupId, name, myRole}. createUserSpaceStore uses it as the
preferred path for resolveDefaultGroupId (falls back to
listGroups first-group). UI topbar default chip now shows
groupName + role, not just "default".

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

不回填 `kvcli todo done 20` 在 commit 之前,先让 commit 落地。

---

## 不做(避免越界)

- 不改 userV1Service.setDefaultGroup(PATCH)行为
- 不动 user-space 的其他视图
- 不为 default groupInfo 加 GET 之外的端点
- 不改 AuthStore / jwtAuth.init

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\task-20-report.md`:
- 状态、改动摘要、测试摘要、commit hash、顾虑

## 返回

状态、commit hash、测试摘要(原 X / 新 Y)、顾虑。完成后再 `kvcli todo done 20 --result "..."` 回填。