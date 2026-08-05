// services/groupV1/types.ts —— /api/v1/groups/* 与 /api/v1/group-invitations/*
// 后端请求 / 响应类型。
//
// 与后端契约对齐(见 dev_ctr_hello skill [[user-kv-invitecode]] / [[client-api]]):
//   - 4 档固定角色:owner / admin / writer / reader(allowlist 映射权限)
//   - 邀请 role 枚举:admin / writer / reader(不能直接给 owner)
//   - 列表响应 (groups / members / invitations) 走 {<key>: Item[]} 形态
//   - 删除/踢人 admin+;解散 owner 唯一;owner 不可退组

export type GroupRole = 'owner' | 'admin' | 'writer' | 'reader';

/** 邀请 role 枚举 —— 不能直接给 owner */
export type InvitationRole = 'admin' | 'writer' | 'reader';

export interface Group {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  /** caller 在该组内的角色;非成员 caller 看不到该组 */
  myRole: GroupRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  userId: number;
  email: string;
  nickname: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupInvitation {
  id: number;
  code: string; // 20 hex
  groupId: number;
  inviterUserId: number;
  inviteeEmail: string;
  role: InvitationRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  status: 1 | 0; // 1 active / 0 revoked
  createdAt: string;
}

export interface CreateGroupArgs {
  name: string;
  description?: string;
}

export interface UpdateGroupArgs {
  name?: string;
  description?: string;
}

export interface CreateInvitationArgs {
  inviteeEmail: string;
  role: InvitationRole;
  /** 1=一次性;0=无限 */
  maxUses?: number;
  /** 秒;默认 7 天;0=永不过期 */
  ttlSeconds?: number;
}

export interface AcceptInvitationArgs {
  code: string;
}

/** 列表 / 详情响应包装 —— 沿用后端 {group, message} / {groups[]} / {members[]} 形态 */
export interface GroupListResponse {
  groups: Group[];
}

export interface GroupDetailResponse {
  group: Group;
}

export interface MemberListResponse {
  members: GroupMember[];
}

export interface InvitationListResponse {
  invitations: GroupInvitation[];
}

export interface CreateInvitationResponse {
  invitation: GroupInvitation;
}

export interface AcceptInvitationResponse {
  group: Group;
  message: string;
}

/** 角色权限映射(本地副本,后端是单一事实源 —— UI 用来 disable 不可点按钮) */
export const ROLE_RANK: Record<GroupRole, number> = {
  owner: 4,
  admin: 3,
  writer: 2,
  reader: 1,
};

export function hasMinRole(myRole: GroupRole | null | undefined, min: GroupRole): boolean {
  if (!myRole) return false;
  return ROLE_RANK[myRole] >= ROLE_RANK[min];
}
