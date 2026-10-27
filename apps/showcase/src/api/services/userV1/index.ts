// services/userV1/index.ts —— /api/v1/user/* 后端接口(SPEC §3 D1)。
//
// 继承 HttpService 基类(../../base.ts),共享 BASE 派路径 + api.get/post/delete
// 转发 + ApiError 透传。端点定义集中在子类,业务语义清晰。
//
// 薄包装 api/http/request.ts 的 api.post/api.get(THROW 模型):
//   - 自有后端统一信封 {code, data, message} 由 request.ts 自动解包/抛 ApiError
//   - 鉴权(Bearer JWT)由 setBearerProvider 注入,call() 自动带 Authorization 头
//   - OIDC 回调端点尚无 token;401 走 skipUnauthorized:true 跳过全局登出信号,
//     由调用方(jwtAuth.completeOidcLogin)自行 catch ApiError 决定如何处理
//
// 登录/注册已迁到统一身份认证中心(go-ah auth-hub / OIDC):
//   - ve 前端不再走 /user/login 邮箱密码,也不再有 /user/send-code + /user/register
//   - 认证协议封装在 api/http/oidc.ts(PKCE / state / authorize URL)
//   - 邮箱密码端点后端仍保留(其他客户端 fr-app 等在用),ve 不再封装

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type { UserInfo, OidcConfig, OidcCallbackArgs, OidcCallbackResult, DefaultGroupInfo } from './types';

export { ApiError } from '../base';
export type { UserInfo, OidcConfig, OidcCallbackArgs, OidcCallbackResult, DefaultGroupInfo } from './types';

export class UserV1Service extends HttpService {
  readonly BASE = apiPaths.userV1;

  /** GET /oidc/config —— 统一身份登录公开参数(无需登录)。 */
  oidcConfig(): Promise<OidcConfig> {
    return this.reqGet<OidcConfig>('/oidc/config');
  }

  /** POST /oidc/callback —— OIDC 授权码换本系统 JWT(公开端点)。 */
  oidcCallback(args: OidcCallbackArgs): Promise<OidcCallbackResult> {
    return this.reqPost<OidcCallbackResult>('/oidc/callback', args, { skipUnauthorized: true });
  }

  info(): Promise<UserInfo> {
    return this.reqGet<UserInfo>('/info');
  }

  /** GET /default-group —— 当前默认工作空间 {groupId, name, myRole};未设置返回 groupId=0。 */
  getDefaultGroup(): Promise<DefaultGroupInfo> {
    return this.reqGet<DefaultGroupInfo>('/default-group');
  }

  regenerateInvitation(): Promise<{ invitationCode: string }> {
    return this.reqPost<{ invitationCode: string }>('/invitation/regenerate');
  }

  /** 切换默认工作空间 —— 必须是目标组成员。 */
  setDefaultGroup(groupId: number): Promise<{ groupId: number; message: string }> {
    return this.reqPatch<{ groupId: number; message: string }>('/default-group', { groupId });
  }
}

export const userV1Service = new UserV1Service();
