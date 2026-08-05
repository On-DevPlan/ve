// services/groupV1/index.ts —— /api/v1/groups/* 后端接口(工作空间 CRUD +
// 成员 + 组内邀请)。
//
// 继承 HttpService 基类(../../base.ts),与 userV1 / kvV1 同构。
// 鉴权(Bearer JWT)由 setBearerProvider 注入;401 由 request.ts 全局处理。
//
// 邀请的撤销 / 接受端点在另一前缀(/api/v1/group-invitations/*),见
// groupInvitationV1 service —— spec 钉法:同一后端不同前缀要注册两个
// backend entry(避免 dev 与 prod 行为分叉)。
//
// 路径 helper:后端 path 形如 /{id} / {id}/members / {id}/invitations,
// 拼接由 reqPost/reqPatch/reqGet/reqDelete 内部完成,服务只负责"路径段"
// 语义编码(如 id 直接插值——id 是后端返回的数字,无需 encodeURIComponent)。

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type {
  CreateGroupArgs,
  CreateInvitationArgs,
  CreateInvitationResponse,
  GroupDetailResponse,
  GroupListResponse,
  GroupMember,
  InvitationListResponse,
  MemberListResponse,
  UpdateGroupArgs,
} from './types';

export { ApiError } from '../base';
// 注意:不把 `Group` / `GroupRole` 透传到 services/index.ts barrel ——
// shortcut-library 组件层也导出了同名 `Group`(api/components/shortcut-library/types.ts),
// 两者都汇到 api/index.ts 的 `export *` 会触发 TS2308 export collision。
// 后端 DTO 仍可经深路径 import:'@api/services/groupV1/types' 或相对路径。
// createUserSpaceStore 只用 GroupDetailResponse / MemberListResponse 等唯一名响应类型,
// 不直接 import 裸 `Group`,所以这里去掉它是安全的。
export type {
  GroupMember,
  GroupInvitation,
  InvitationRole,
  CreateGroupArgs,
  UpdateGroupArgs,
  CreateInvitationArgs,
  GroupListResponse,
  GroupDetailResponse,
  MemberListResponse,
  InvitationListResponse,
  CreateInvitationResponse,
} from './types';
export { hasMinRole, ROLE_RANK } from './types';

export class GroupV1Service extends HttpService {
  readonly BASE = apiPaths.groupV1;

  /** 列 caller 创建 + 加入的组。 */
  list(): Promise<GroupListResponse> {
    return this.reqGet<GroupListResponse>('');
  }

  detail(id: number): Promise<GroupDetailResponse> {
    return this.reqGet<GroupDetailResponse>(`/${id}`);
  }

  create(args: CreateGroupArgs): Promise<GroupDetailResponse> {
    return this.reqPost<GroupDetailResponse>('', args);
  }

  update(id: number, args: UpdateGroupArgs): Promise<GroupDetailResponse> {
    return this.reqPatch<GroupDetailResponse>(`/${id}`, args);
  }

  /** 解散组(owner 唯一)。后端预检:组内无 KV + 无人 default_group 引用。 */
  dissolve(id: number): Promise<void> {
    return this.reqDelete(`/${id}`);
  }

  members(id: number): Promise<MemberListResponse> {
    return this.reqGet<MemberListResponse>(`/${id}/members`);
  }

  /** 改成员 role(admin+);owner 不能改;admin 不能新增 owner */
  changeMemberRole(id: number, userId: number, role: GroupMember['role']): Promise<{ message: string }> {
    return this.reqPatch<{ message: string }>(`/${id}/members/${userId}`, { role });
  }

  /** 踢人 / 退组。admin+;owner 不能被踢;admin 退自己用 /leave */
  removeMember(id: number, userId: number): Promise<void> {
    return this.reqDelete(`/${id}/members/${userId}`);
  }

  /** 主动退组(owner 不可退 —— 后端拒绝) */
  leave(id: number): Promise<{ message: string }> {
    return this.reqPost<{ message: string }>(`/${id}/leave`);
  }

  /** 组内产生邀请码。admin+;role 限 admin / writer / reader */
  createInvitation(id: number, args: CreateInvitationArgs): Promise<CreateInvitationResponse> {
    return this.reqPost<CreateInvitationResponse>(`/${id}/invitations`, args);
  }

  /** 列组内**活跃**邀请（status=1） */
  invitations(id: number): Promise<InvitationListResponse> {
    return this.reqGet<InvitationListResponse>(`/${id}/invitations`);
  }
}

export const groupV1Service = new GroupV1Service();
