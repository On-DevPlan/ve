// api/components/user-space/types.ts —— user-space 组件域类型。
//
// 这些类型是**组件侧语义**(不是后端 DTO);后端类型走 services/groupV1/
// services/groupInvitationV1/services/userV1/services/kvV1,这里只放
// "组件需要传给 UI"的形态。
//
// GroupRole 直接复用 services/groupV1 的类型(单一事实源),避免本文件再
// 声明一份造成 api/index.ts barrel 的 export collision。

import type { GroupRole } from '../../services/groupV1/types';

export type { GroupRole };

export interface GroupSummary {
  id: number;
  name: string;
  description: string;
  myRole: GroupRole;
  memberCount: number;
  ownerId: number;
  isDefault: boolean; // 是否 caller 的默认工作空间
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberView {
  userId: number;
  email: string;
  nickname: string;
  role: GroupRole;
  joinedAt: string;
  isSelf: boolean;
}

export interface GroupInvitationView {
  id: number;
  code: string;
  inviterUserId: number;
  inviteeEmail: string;
  role: Exclude<GroupRole, 'owner'>; // 邀请不能直接给 owner
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  status: 1 | 0;
  createdAt: string;
}

export interface GroupKvKeyView {
  key: string;
  /** 截断后长度,避免大 value 撑爆卡片 */
  valuePreview: string;
  valueLength: number;
  tags: string[];
}

export interface GroupKvInventory {
  groupId: number;
  total: number;
  /** 仅展示前几名,完整列表点 "查看全部" 跳 shortcut-library / KV 控制台 */
  keys: GroupKvKeyView[];
}

/** 三视图模式:only one of Overview / Members / Invitations / Inventory */
export type ViewMode = 'overview' | 'members' | 'invitations' | 'inventory';

/** createUserSpaceStore 返回给组件的统一句柄 */
export interface UserSpaceStore {
  // ── 列表 / 详情 ─────────────────────────────────
  listGroups(): Promise<GroupSummary[]>;
  getGroupDetail(id: number): Promise<GroupSummary>;
  /** 拉一次当前默认组 id;不存在返回 null */
  getDefaultGroupId(): Promise<number | null>;

  // ── CRUD ─────────────────────────────────────────
  createGroup(args: { name: string; description?: string }): Promise<GroupSummary>;
  updateGroup(id: number, args: { name?: string; description?: string }): Promise<GroupSummary>;
  dissolveGroup(id: number): Promise<void>;
  leaveGroup(id: number): Promise<void>;
  setDefaultGroup(id: number): Promise<void>;

  // ── 成员管理 ─────────────────────────────────────
  listMembers(id: number): Promise<GroupMemberView[]>;
  changeMemberRole(id: number, userId: number, role: GroupRole): Promise<void>;
  removeMember(id: number, userId: number): Promise<void>;

  // ── 邀请 ─────────────────────────────────────────
  listInvitations(id: number): Promise<GroupInvitationView[]>;
  createInvitation(
    id: number,
    args: { inviteeEmail: string; role: Exclude<GroupRole, 'owner'>; maxUses?: number; ttlSeconds?: number },
  ): Promise<GroupInvitationView>;
  revokeInvitation(id: number, invitationId: number): Promise<void>;
  acceptInvitation(code: string): Promise<GroupSummary>;

  // ── KV 库存(只读,显示该组下了多少 KV) ─────────
  inventory(id: number, limit?: number): Promise<GroupKvInventory>;
}
