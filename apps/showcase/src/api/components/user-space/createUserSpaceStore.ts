// api/components/user-space/createUserSpaceStore.ts —— user-space 业务封装。
//
// 职责:把 groupV1Service / groupInvitationV1Service / userV1Service / kvV1Service
// 的通用 HTTP 读写,包成 user-space 组件要的 listGroups / createGroup / members /
// invitations / inventory 等业务动作。组件只认这些语义,不认后端协议。
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
//   - inventory 只读 groupId 下的 KV:用 kvV1Service.list({groupId,...}) 拉,
//     截断 + 总量返回给 UI,不暴露给后端 DTO 的内部字段(visibility 已经废弃)

import { jwtAuth } from '../../http/auth-store';
import {
  groupV1Service,
  groupInvitationV1Service,
  userV1Service,
  kvV1Service,
  ApiError,
} from '../../services';
import type {
  GroupMemberView,
  GroupSummary,
  GroupKvInventory,
  GroupKvKeyView,
  GroupInvitationView,
  UserSpaceStore,
} from './types';

const VALUE_PREVIEW_MAX = 80;
/** 后端 "组内 KV 已存在但 key 不属于 caller" 业务 code(per-key)—— UI 忽略单条失败 */
const KV_CODE_NOT_FOUND = 50;

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

  // ── KV 库存(只读) ─────────────────────────────

  async function inventory(id: number, limit: number = 10): Promise<GroupKvInventory> {
    requireAuth();
    const safeLimit = Math.max(1, Math.min(50, limit));
    const { items, total } = await kvV1Service.list({ limit: safeLimit, offset: 0, groupId: id });
    const keys: GroupKvKeyView[] = [];
    for (const kv of items) {
      // 安全:即使单条 get 失败也不阻塞整个列表
      let valuePreview = '';
      let valueLength = 0;
      try {
        const full = await kvV1Service.get({ key: kv.key });
        valueLength = full.value.length;
        valuePreview = full.value.length > VALUE_PREVIEW_MAX
          ? full.value.slice(0, VALUE_PREVIEW_MAX) + '…'
          : full.value;
      } catch (e) {
        // 单 key 不存在或权限不足:lid 静默跳过
        if (e instanceof ApiError && e.code === KV_CODE_NOT_FOUND) continue;
        // 其它错误也吞掉 —— inventory 是 best-effort,不能因单条失败炸列表
        continue;
      }
      keys.push({
        key: kv.key,
        valuePreview,
        valueLength,
        tags: kv.tags ?? [],
      });
    }
    return { groupId: id, total, keys };
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
    inventory,
  };
}
