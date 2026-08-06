// api/components/user-space/createUserSpaceStore.ts —— user-space 业务封装。
//
// 职责:把 groupV1Service / groupInvitationV1Service / userV1Service / kvV1Service
// 的通用 HTTP 读写,包成 user-space 组件要的 listGroups / createGroup / members /
// invitations / createKv / listKvs 等业务动作。组件只认这些语义,不认后端协议。
//
// 为什么 import 走相对路径而不是 '@api':
//   '@api' 解析到 api/index.ts,而 index.ts 又 `export * from './components'`
//   —— 本文件正在 components 里,形成 self-cycle(index → components → store →
//   index)。ESM 循环虽然能靠 hoisting 侥幸跑通,但求值顺序取决于谁先被 import,
//   一旦有人在 index 顶层加副作用就会拿到 undefined。**目录内部一律走相对
//   路径,'@api' 只留给 src/api/ 外部调用方。**
//
// 关键决策:
//   - 后端 DTO 有 `description: string`(无效空串),UI 统一转 `''` 兜底
//   - createInvitation 后端用 admin / writer / reader;owner 不允许
//   - isDefault / isSelf 由前端按 callerUserId + callerDefaultGroupId 推断
//   - KV CRUD 走 kvV1Service 的 groupId 契约:Set/Delete 需 owner|admin|writer,
//     Get/List 任意成员。listKvs 复用后端 list 自带 value 全文,消除 N+1;
//     toKvView 只做预览截断,不再逐条 get(visibility 已废弃)。

import { jwtAuth } from '../../http/auth-store';
import {
  groupV1Service,
  groupInvitationV1Service,
  userV1Service,
  kvV1Service,
} from '../../services';
import type {
  GroupMemberView,
  GroupSummary,
  GroupInvitationView,
  KvListResult,
  KvView,
  KvVersionView,
  KvEditorPayload,
  UserSpaceStore,
  ShortcutsBlob,
} from './types';
import { ApiError } from '../../services/base';

const VALUE_PREVIEW_MAX = 80;

/** shortcut-library 业务封装用的固定 KV key(user-space 不暴露给其他用途)。
 * 走默认 group(0 = caller.default_group_id),由前端组装整库 JSON 写入。 */
// key 与 tag 同名('shortcut-library'),与 user-kv-invitecode 技能的「tag 区分
// 不同组件数据」模式一致;让 listByTag 扫出来时一眼能对到本组件,也让 API 路径
// /api/v1/kv/shortcut-library 自解释,不需要看文档就知道归属。
const SHORTCUTS_KV_KEY = 'shortcut-library';

function normalizeDescription(desc: string | undefined | null): string {
  return (desc ?? '').trim();
}

function toGroupSummary(input: {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  myRole: GroupSummary['myRole'];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}, isDefault: boolean): GroupSummary {
  return {
    id: input.id,
    name: input.name,
    description: normalizeDescription(input.description),
    myRole: input.myRole,
    memberCount: input.memberCount,
    ownerId: input.ownerId,
    isDefault,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

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

function toKvVersionView(v: { version_no: number; value_len: number; replaced_at: string }): KvVersionView {
  return { versionNo: v.version_no, valueLen: v.value_len, replacedAt: v.replaced_at };
}

export function createUserSpaceStore(): UserSpaceStore {
  function requireAuth(): { userId: number } {
    const user = jwtAuth.state.jwtUser;
    if (!user || jwtAuth.state.jwtAuthState !== 'logged-in') {
      throw new Error('not logged in');
    }
    return { userId: user.id };
  }

  async function resolveDefaultGroupId(): Promise<number | null> {
    // 顺序:先看 /user/info 是否回 defaultGroupId(后续 DTO 补字段);
    // 否则返回 null,UI 提示用户**第一次**手动选默认组。
    const info = jwtAuth.state.jwtUser;
    if (info?.defaultGroupId && info.defaultGroupId > 0) return info.defaultGroupId;
    return null;
  }

  async function decorate(groups: GroupSummary[]): Promise<GroupSummary[]> {
    const defaultId = await resolveDefaultGroupId();
    return groups.map((g) => ({ ...g, isDefault: defaultId === g.id }));
  }

  // ── 列表 / 详情 ─────────────────────────────────

  async function listGroups(): Promise<GroupSummary[]> {
    requireAuth();
    const { groups } = await groupV1Service.list();
    return decorate(groups.map((g) => toGroupSummary(g, false)));
  }

  async function getGroupDetail(id: number): Promise<GroupSummary> {
    requireAuth();
    const { group } = await groupV1Service.detail(id);
    return toGroupSummary(group, (await resolveDefaultGroupId()) === id);
  }

  async function getDefaultGroupId(): Promise<number | null> {
    requireAuth();
    return resolveDefaultGroupId();
  }

  // ── CRUD ─────────────────────────────────────────

  async function createGroup(args: { name: string; description?: string }): Promise<GroupSummary> {
    requireAuth();
    const { group } = await groupV1Service.create({
      name: args.name.trim(),
      description: normalizeDescription(args.description),
    });
    return toGroupSummary(group, (await resolveDefaultGroupId()) === group.id);
  }

  async function updateGroup(id: number, args: { name?: string; description?: string }): Promise<GroupSummary> {
    requireAuth();
    const payload: { name?: string; description?: string } = {};
    if (args.name !== undefined) payload.name = args.name.trim();
    if (args.description !== undefined) payload.description = normalizeDescription(args.description);
    const { group } = await groupV1Service.update(id, payload);
    return toGroupSummary(group, (await resolveDefaultGroupId()) === id);
  }

  async function dissolveGroup(id: number): Promise<void> {
    requireAuth();
    await groupV1Service.dissolve(id);
  }

  async function leaveGroup(id: number): Promise<void> {
    requireAuth();
    await groupV1Service.leave(id);
  }

  async function setDefaultGroup(id: number): Promise<void> {
    requireAuth();
    await userV1Service.setDefaultGroup(id);
    // 后端 DTO 当前不回 defaultGroupId(遗留:e2e 用 SQL 适配)。组件层
    // setDefaultGroup 之后应主动 refreshUser() 让 jwtAuth.user.defaultGroupId
    // 对齐;若不刷新,下一次 listGroups 的 resolveDefaultGroupId 会拿到旧值
    // —— 这是已知 trade-off,见 store 顶部 resolveDefaultGroupId 注释。
  }

  // ── 成员管理 ─────────────────────────────────────

  async function listMembers(id: number): Promise<GroupMemberView[]> {
    const { userId: callerId } = requireAuth();
    const { members } = await groupV1Service.members(id);
    return members.map((m) => ({
      userId: m.userId,
      email: m.email,
      nickname: m.nickname,
      role: m.role,
      joinedAt: m.joinedAt,
      isSelf: m.userId === callerId,
    }));
  }

  async function changeMemberRole(id: number, userId: number, role: GroupMemberView['role']): Promise<void> {
    requireAuth();
    await groupV1Service.changeMemberRole(id, userId, role);
  }

  async function removeMember(id: number, userId: number): Promise<void> {
    requireAuth();
    await groupV1Service.removeMember(id, userId);
  }

  // ── 邀请 ─────────────────────────────────────────

  async function listInvitations(id: number): Promise<GroupInvitationView[]> {
    requireAuth();
    const { invitations } = await groupV1Service.invitations(id);
    return invitations.map((inv) => ({
      id: inv.id,
      code: inv.code,
      inviterUserId: inv.inviterUserId,
      inviteeEmail: inv.inviteeEmail,
      role: inv.role,
      maxUses: inv.maxUses,
      usedCount: inv.usedCount,
      expiresAt: inv.expiresAt,
      status: inv.status,
      createdAt: inv.createdAt,
    }));
  }

  async function createInvitation(
    id: number,
    args: { inviteeEmail: string; role: Exclude<GroupMemberView['role'], 'owner'>; maxUses?: number; ttlSeconds?: number },
  ): Promise<GroupInvitationView> {
    requireAuth();
    const { invitation } = await groupV1Service.createInvitation(id, {
      inviteeEmail: args.inviteeEmail.trim(),
      role: args.role,
      maxUses: args.maxUses,
      ttlSeconds: args.ttlSeconds,
    });
    return {
      id: invitation.id,
      code: invitation.code,
      inviterUserId: invitation.inviterUserId,
      inviteeEmail: invitation.inviteeEmail,
      role: invitation.role,
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      createdAt: invitation.createdAt,
    };
  }

  async function revokeInvitation(id: number, invitationId: number): Promise<void> {
    requireAuth();
    // id(group)当前不用 —— 撤销端点只接受邀请记录 id。保留参数是为了
    // 与 UserSpaceStore 接口签名一致(将来后端按 group 校验权限时再启用)。
    void id;
    await groupInvitationV1Service.revoke(invitationId);
  }

  async function acceptInvitation(code: string): Promise<GroupSummary> {
    requireAuth();
    const { group } = await groupInvitationV1Service.accept({ code: code.trim() });
    return toGroupSummary(group, (await resolveDefaultGroupId()) === group.id);
  }

  // ── KV CRUD ─────────────────────────────────────
  // 权限(后端 contract):Set/Delete → owner|admin|writer;Get/List → 任意成员。
  // createKv/updateKv 都是 set 的 upsert(按 key 覆盖);ttl 秒,0=永久。

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

  async function listKvVersions(groupId: number, key: string): Promise<KvVersionView[]> {
    requireAuth();
    const vers = await kvV1Service.versions({ key, groupId });
    return vers.map(toKvVersionView);
  }

  async function restoreKv(groupId: number, key: string, version: number): Promise<void> {
    requireAuth();
    await kvV1Service.restore({ key, version, groupId });
  }

  // ─── 组件业务封装(per-component contract)────────────────────────
  // shortcut-library 的整个库作为单个 KV 整体存取,内部固定 key='shortcuts'。
  // shortcut-library 不知道 KV 协议,也不直接接触 kvV1Service。
  // KV 后端 "键不存在"(code 50)当作首次使用 → 返回空数组(不是故障)。
  //
  // 自愈读(getShortcuts):'shortcuts' blob 不存在时,扫一次 tag=shortcut-library
  // 的全量列表,识别旧 per-item 行(sl-group-* / sl-shortcut-*)→ 合并成新格式 →
  // 写回 'shortcuts' blob → best-effort 删旧行。这样切换 schema 不需要后端迁移
  // 脚本,部署后第一次读用户时自动完成。失败也不阻塞 —— 旧行只会遗留为不可见
  // (组件后续只读写单 blob)。

  const SHORTCUT_TAGS = ['shortcut-library'] as const;
  const LEGACY_GROUP_PREFIX = 'sl-group-';
  const LEGACY_SHORTCUT_PREFIX = 'sl-shortcut-';
  const LEGACY_LIST_PAGE_SIZE = 200;

  function safeParseShortcuts(raw: string): ShortcutsBlob {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ShortcutsBlob;
      return [];
    } catch {
      return [];
    }
  }

  interface LegacyGroupRecord { id: string; name: string; order: number; createdAt: number; updatedAt: number; }
  interface LegacyShortcutRecord { id: string; groupId: string; order: number; combo: { code: string; label: string; isModifier: boolean }[]; description: string; condition?: string; createdAt: number; updatedAt: number; }
  function isLegacyGroupRecord(x: unknown): x is LegacyGroupRecord {
    return !!x && typeof x === 'object' && typeof (x as LegacyGroupRecord).id === 'string' && typeof (x as LegacyGroupRecord).name === 'string';
  }
  function isLegacyShortcutRecord(x: unknown): x is LegacyShortcutRecord {
    return !!x && typeof x === 'object' && typeof (x as LegacyShortcutRecord).id === 'string' && typeof (x as LegacyShortcutRecord).groupId === 'string';
  }

  /** 把 per-item 旧行合并成新格式 Group[]。 */
  function consolidateLegacy(groups: LegacyGroupRecord[], shortcuts: LegacyShortcutRecord[]): ShortcutsBlob {
    const sorted = [...groups].sort((a, b) => a.order - b.order);
    return sorted.map((g) => ({
      id: g.id,
      name: g.name,
      shortcuts: shortcuts
        .filter((s) => s.groupId === g.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: s.id,
          combo: s.combo,
          description: s.description,
          condition: s.condition,
          createdAt: s.createdAt,
        })),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  /** 拉全量 ?tags=shortcut-library(分页),返回旧行集合。 */
  async function listLegacyShortcutKeys(groupId: number): Promise<{ legacyGroups: LegacyGroupRecord[]; legacyShortcuts: LegacyShortcutRecord[]; legacyKeys: string[] }> {
    const legacyGroups: LegacyGroupRecord[] = [];
    const legacyShortcuts: LegacyShortcutRecord[] = [];
    const legacyKeys: string[] = [];
    let offset = 0;
    while (true) {
      let resp: { items?: Array<{ key?: string; value?: string }>; total?: number };
      try {
        resp = await kvV1Service.list({ limit: LEGACY_LIST_PAGE_SIZE, offset, tags: [...SHORTCUT_TAGS], groupId });
      } catch {
        return { legacyGroups, legacyShortcuts, legacyKeys };
      }
      if (!resp || !Array.isArray(resp.items)) return { legacyGroups, legacyShortcuts, legacyKeys };
      if (resp.items.length === 0) break;
      for (const item of resp.items) {
        if (!item || typeof item.key !== 'string') continue;
        if (item.key === SHORTCUTS_KV_KEY) continue; // 新格式 blob,忽略
        if (item.key.startsWith(LEGACY_GROUP_PREFIX)) {
          legacyKeys.push(item.key);
          try { const parsed = JSON.parse(String(item.value ?? '')); if (isLegacyGroupRecord(parsed)) legacyGroups.push(parsed); } catch { /* skip */ }
        } else if (item.key.startsWith(LEGACY_SHORTCUT_PREFIX)) {
          legacyKeys.push(item.key);
          try { const parsed = JSON.parse(String(item.value ?? '')); if (isLegacyShortcutRecord(parsed)) legacyShortcuts.push(parsed); } catch { /* skip */ }
        }
      }
      offset += resp.items.length;
      if (typeof resp.total !== 'number' || offset >= resp.total) break;
    }
    return { legacyGroups, legacyShortcuts, legacyKeys };
  }

  async function getShortcuts(): Promise<ShortcutsBlob> {
    requireAuth();
    const defaultGroupId = await resolveDefaultGroupId();
    if (defaultGroupId === null) return [];
    // 1) 主路径:读新格式 'shortcuts' blob
    try {
      const item = await kvV1Service.get({ key: SHORTCUTS_KV_KEY, groupId: defaultGroupId });
      return safeParseShortcuts(item.value);
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 50) throw e; // 其它业务错误透传
    }
    // 2) 旧版本兼容:扫描 tag 全量,识别 per-item 旧行 → 合并 → 写回 → 删旧行
    const { legacyGroups, legacyShortcuts, legacyKeys } = await listLegacyShortcutKeys(defaultGroupId);
    if (legacyGroups.length === 0 && legacyShortcuts.length === 0) return [];
    const merged = consolidateLegacy(legacyGroups, legacyShortcuts);
    try {
      await kvV1Service.set({
        key: SHORTCUTS_KV_KEY,
        value: JSON.stringify(merged),
        tags: [...SHORTCUT_TAGS],
        ttl: 0,
        groupId: defaultGroupId,
      });
    } catch {
      // 写不进去也不阻塞本次读
    }
    // best-effort 删旧行
    for (const k of legacyKeys) {
      kvV1Service.delete({ key: k, groupId: defaultGroupId }).catch(() => undefined);
    }
    return merged;
  }

  async function setShortcuts(groups: ShortcutsBlob): Promise<void> {
    requireAuth();
    const defaultGroupId = await resolveDefaultGroupId();
    if (defaultGroupId === null) {
      throw new Error('no default group; call setDefaultGroup first');
    }
    await kvV1Service.set({
      key: SHORTCUTS_KV_KEY,
      value: JSON.stringify(groups),
      tags: ['shortcut-library'],
      ttl: 0,
      groupId: defaultGroupId,
    });
  }

  return {
    listGroups,
    getGroupDetail,
    getDefaultGroupId,
    createGroup,
    updateGroup,
    dissolveGroup,
    leaveGroup,
    setDefaultGroup,
    listMembers,
    changeMemberRole,
    removeMember,
    listInvitations,
    createInvitation,
    revokeInvitation,
    acceptInvitation,
    createKv,
    updateKv,
    deleteKv,
    getKvDetail,
    listKvs,
    listKvVersions,
    restoreKv,
    getShortcuts,
    setShortcuts,
  };
}
