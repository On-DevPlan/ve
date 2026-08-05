// services/groupInvitationV1/index.ts —— /api/v1/group-invitations/* 后端接口
// (邀请撤销 / 接受)。
//
// 同一后端(http://47.110.80.47:8988)但路由前缀不同(/api/v1/group-invitations
// 而非 /api/v1/groups),按 SPEC §types 注册两个 backend entry 而不是数组 route,
// 避免 dev/prod 行为分叉。
//
// 接受邀请前必须先登录(MustAuth);接受返回的 group 对象里 myRole 反映
// 加入后的身份(已是成员则返回已有 group 不重复入组)。

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type {
  AcceptInvitationArgs,
  AcceptInvitationResponse,
} from './types';

export { ApiError } from '../base';
export type {
  AcceptInvitationArgs,
  AcceptInvitationResponse,
} from './types';

export class GroupInvitationV1Service extends HttpService {
  readonly BASE = apiPaths.groupInvitationV1;

  /** 撤销组内邀请(admin+);id 是邀请记录 id,非 group id */
  revoke(id: number): Promise<{ message: string }> {
    return this.reqPost<{ message: string }>(`/${id}/revoke`);
  }

  /** 用 20 字符邀请码入组。已是成员 → 直接返回组信息 */
  accept(args: AcceptInvitationArgs): Promise<AcceptInvitationResponse> {
    return this.reqPost<AcceptInvitationResponse>('/accept', args);
  }
}

export const groupInvitationV1Service = new GroupInvitationV1Service();
