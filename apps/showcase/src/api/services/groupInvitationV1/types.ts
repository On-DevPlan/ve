// services/groupInvitationV1/types.ts —— /api/v1/group-invitations/* 后端
// 请求 / 响应类型(只覆盖本 service 用到的字段;创建邀请的字段在 groupV1/types.ts
// 已经在创建时返回 —— 邀请对象的完整字段)。
//
// **不 re-export** groupV1 的类型:groupV1 与 groupInvitationV1 都从 services/index.ts
// barrel 出去,若两边都导出同名类型(如 InvitationRole)会产生 export collision
// (TS2308)。本文件只定义本 service 独有的请求 / 响应 DTO,公共类型由 groupV1 出。

import type { GroupRole } from '../groupV1/types';

/** 接受邀请后的组对象(与 Group 同构,这里独立声明避免循环 import groupV1/index) */
export interface AcceptedGroup {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  myRole: GroupRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptInvitationArgs {
  code: string;
}

export interface AcceptInvitationResponse {
  group: AcceptedGroup;
  message: string;
}

