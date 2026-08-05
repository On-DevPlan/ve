// services/userV1/index.ts —— /api/v1/user/* 后端接口(SPEC §3 D1)。
//
// 继承 HttpService 基类(../../base.ts),共享 BASE 派路径 + api.get/post/delete
// 转发 + ApiError 透传。端点定义集中在子类,业务语义清晰。
//
// 薄包装 api/http/request.ts 的 api.post/api.get(THROW 模型):
//   - 自有后端统一信封 {code, data, message} 由 request.ts 自动解包/抛 ApiError
//   - 鉴权(Bearer JWT)由 setBearerProvider 注入,call() 自动带 Authorization 头
//   - sendCode/register/login 尚无 token,且密码错误会返回 401;
//     用 skipUnauthorized:true 跳过全局 markRequiresLogin(logout 信号),
//     由调用方(jwtAuth.login)自行 catch ApiError 决定如何处理

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type { UserInfo, RegisterArgs } from './types';

export { ApiError } from '../base';
export type { UserInfo, RegisterArgs } from './types';

export class UserV1Service extends HttpService {
  readonly BASE = apiPaths.userV1;

  /** 发邮箱验证码。purpose 默认 'register';'reset' 用于密码找回(后端 email_codes.purpose 已支持)。 */
  sendCode(email: string, purpose: 'register' | 'reset' = 'register'): Promise<void> {
    return this.reqPost('/send-code', { email, purpose }, { skipUnauthorized: true });
  }

  register(args: RegisterArgs): Promise<{ userId: number }> {
    return this.reqPost<{ userId: number }>('/register', args, { skipUnauthorized: true });
  }

  login(args: { email: string; password: string }): Promise<{ token: string; userId: number }> {
    return this.reqPost<{ token: string; userId: number }>('/login', args, { skipUnauthorized: true });
  }

  info(): Promise<UserInfo> {
    return this.reqGet<UserInfo>('/info');
  }

  regenerateInvitation(): Promise<{ invitationCode: string }> {
    return this.reqPost<{ invitationCode: string }>('/invitation/regenerate');
  }
}

export const userV1Service = new UserV1Service();
