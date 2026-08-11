// api/components/user-space/types.ts —— user-space 组件域类型。
//
// 这些类型是**组件侧语义**(不是后端 DTO);后端类型走 services/groupV1/
// services/groupInvitationV1/services/userV1/services/kvV1,这里只放
// "组件需要传给 UI"的形态。
//
// GroupRole 直接复用 services/groupV1 的类型(单一事实源),避免本文件再
// 声明一份造成 api/index.ts barrel 的 export collision。

import type { GroupRole } from '../../services/groupV1/types';
import type { DefaultGroupInfo } from '../../services/userV1/types';
import type { KvDuplicateArgs, KvDuplicateResponse, KvTagCount } from '../../services/kvV1/types';
import type { FileAccessLevel, FileDuplicateArgs, FileDuplicateResponse, FileThumbnail } from '../../services/fileV1/types';

export type { GroupRole };
export type { DefaultGroupInfo };
export type { KvDuplicateArgs, KvDuplicateResponse, KvTagCount };
export type { FileAccessLevel, FileDuplicateArgs, FileDuplicateResponse, FileThumbnail };

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

/** 文件视图(组件侧语义)。
 *  displayName:后端未补 originalName,前端临时用 fileId 前 8 hex 作展示名;
 *              调用方应将 displayName 用于 UI 唯一识别 + confirm 提示。
 *  isPreviewable:public + image MIME 才能在表格里出缩略图;其余类型只出图标。
 *  fileKind:image/text/other —— UI 按此决定缩略图 / 类型图标 / 文案。
 *  thumbnails:后端 2026-08-10 起返回的缩略图档位元数据;老文件 / 非图片 / md5
 *             dedup 命中 → undefined。UI 可据此选择 sm/md/lg 渲染。 */
export interface FileView {
  fileId: string;
  url: string;
  displayName: string;
  accessLevel: FileAccessLevel;
  size: number;
  contentType: string;
  groupId: number;
  groupName: string;
  myRole: GroupRole;
  tags: string[];
  md5: string;
  sha256: string;
  createdAt: string;
  expireAt: string;
  isPreviewable: boolean;
  fileKind: 'image' | 'text' | 'other';
  thumbnails?: FileThumbnail[];
}

export interface FileListResult {
  items: FileView[];
  total: number;
  page: number;
  pageSize: number;
}

/** 历史版本摘要(组件侧语义,由 kvV1 的 version_no/value_len/replaced_at 映射)。 */
export interface KvVersionView {
  versionNo: number;
  valueLen: number;
  replacedAt: string;
}

export interface KvEditorPayload {
  key: string;
  value: string;
  tags: string[];
  /** 秒;0=永久 */
  ttl: number;
}

/** 三视图模式:only one of Overview / Members / Invitations / Inventory / Files */
export type ViewMode = 'overview' | 'members' | 'invitations' | 'inventory' | 'files';

/** createUserSpaceStore 返回给组件的统一句柄 */
export interface UserSpaceStore {
  // ── 列表 / 详情 ─────────────────────────────────
  listGroups(): Promise<GroupSummary[]>;
  getGroupDetail(id: number): Promise<GroupSummary>;
  /** 拉一次当前默认组 id;不存在返回 null */
  getDefaultGroupId(): Promise<number | null>;
  /** 拉一次当前默认组 {groupId, name, myRole};失败降级到 groupId=0 占位。供 UI 顶部徽章展示。 */
  getDefaultGroupInfo(): Promise<DefaultGroupInfo>;

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

  // ── KV ────────────────────────────────────────────
  createKv(groupId: number, args: KvEditorPayload): Promise<void>;
  updateKv(groupId: number, args: KvEditorPayload): Promise<void>;
  deleteKv(groupId: number, key: string): Promise<void>;
  getKvDetail(groupId: number, key: string): Promise<KvView>;
  listKvs(groupId: number, opts: { page: number; pageSize: number; tags?: string[] }): Promise<KvListResult>;
  listKvTags(groupId: number): Promise<KvTagCount[]>;
  /** 历史版本摘要列表(不回 value 全文),用于编辑框里的版本选择器。read+。 */
  listKvVersions(groupId: number, key: string): Promise<KvVersionView[]>;
  /** 回滚到指定版本。write+;恢复后需重新拉详情刷新当前值。 */
  restoreKv(groupId: number, key: string, version: number): Promise<void>;
  /** 跨组复制 KV(source read+ → target write+)。targetGroupId 必须 ≥ 1。 */
  duplicateKv(args: KvDuplicateArgs): Promise<KvDuplicateResponse>;

  // ── 文件(本期为公开图床) ─────────────────────────
  // upload 固定 accessLevel='public';tags replace 语义。displayName 由后端
  // fileId[:8] 派生,见 FileView.comment 解释。
  uploadFile(groupId: number, args: { file: Blob; tags?: string[] }): Promise<FileView>;
  listFiles(
    groupId: number,
    opts: { page: number; pageSize: number; tags?: string[] },
  ): Promise<FileListResult>;
  /** 行内改 accessLevel / tags。accessLevel 永远发完整值(后端 PATCH pointer 字段)。 */
  updateFileMeta(
    groupId: number,
    fileId: string,
    args: { accessLevel?: FileAccessLevel; tags?: string[] },
  ): Promise<FileView>;
  /** 删除文件。后端 owner/admin only;reader/writer 调用会 403。 */
  deleteFile(groupId: number, fileId: string): Promise<void>;
  /** 跨组复制文件(source read+ → target write+)。新 fileId 由后端生成。 */
  duplicateFile(args: FileDuplicateArgs): Promise<FileDuplicateResponse>;

  // ── 组件业务封装(per-component contract)──────────────────────
  // shortcut-library 的整个库作为单个 KV 整体存取,内部固定 key='shortcuts'。
  // shortcut-library 不知道 KV 协议,也不直接接触 kvV1Service。
  getShortcuts(): Promise<ShortcutsBlob>;
  setShortcuts(groups: ShortcutsBlob): Promise<void>;
}

// ─── shortcut-library 业务类型(per-component contract)────────────────────
//
// getShortcuts / setShortcuts 读写的"整库"形态:一个 Group[] 数组。
// 这里定义成 user-space 的域类型(供 shortcut-library 组件 import 使用),
// 但 getShortcuts 内部把这个数组 JSON.stringify 存进一个 KV key='shortcuts'。
// Shortcut / Group 字段与 shortcut-library 的组件语义完全一致(同一份类型)
// —— 是为了避免 component 侧再 import 一份。

export interface Shortcut {
  id: string;
  combo: Array<{ code: string; label: string; isModifier: boolean }>;
  description: string;
  condition?: string;
  createdAt: number;
}

export interface ShortcutGroup {
  id: string;
  name: string;
  shortcuts: Shortcut[];
  createdAt: number;
  updatedAt: number;
}

/** shortcut-library 整体库的形态 —— 一个 Group[] 数组,直接 JSON 序列化进 KV。 */
export type ShortcutsBlob = ShortcutGroup[];
