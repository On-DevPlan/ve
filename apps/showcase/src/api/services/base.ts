// api/services/base.ts —— 所有 HTTP 服务的基类(SPEC §3 throw 模型)。
//
// 子类用法示例:
//   class UserV1Service extends HttpService {
//     readonly BASE = apiPaths.userV1;
//     sendCode(email: string) {
//       return this.reqPost('/user/send-code', { email, purpose: 'register' }, { skipUnauthorized: true });
//     }
//   }
//   export const userV1Service = new UserV1Service();
//
// 基类只承担三件事:BASE 派路径、reqGet/reqPost/reqPut/reqDelete 转发到
// api/http/request、ApiError 透传。端点定义(endpoint path / body 形态 /
// skipUnauthorized)保留在子类 —— 业务语义不同,模板化反而模糊责任。

import { api, ApiError } from '../http/request';
import type { ApiPathLiteral } from '../registry';

export { ApiError };

/**
 * api/http/request.ts 的 RequestOptions 子集 —— 排除掉 body / method。
 * headers 在这里开放:子类(如 kvV1)需要在每次请求上挂载 per-request header
 * (例如 X-Secret-Password),不必新建第二层 wrapper。
 */
export interface RequestOptions {
  skipUnauthorized?: boolean;
  signal?: AbortSignal;
  /** 附加到该次请求的 header(覆盖调用方已有同名键)。 */
  headers?: Record<string, string>;
}

/**
 * HTTP 服务基类。
 *
 * 设计说明:
 *   - 类(static + 继承)而非纯函数:因为抛 throw vs 路由分流需要承载 *this* 状态
 *     (BASE 字段),继承让每个端点定义只写一次 BASE。
 *   - BASE 用 `ApiPathLiteral` 约束(来自 registry.apiPaths):registry 路径
 *     字面量才能赋,加新 backend 后编译期就提醒。
 *   - protected 方法:子类用 `this.reqGet/reqPost/reqPut/reqDelete` 调,不允许外部
 *     直接 new 后调(服务必须先 `new XxxService()` 暴露一个实例给消费者)。
 */
export abstract class HttpService {
  /** 子类必须提供:registry 路径字面量(来自 registry.apiPaths.<id>)。 */
  abstract readonly BASE: string & ApiPathLiteral;

  protected reqGet<T>(path: string, opts?: RequestOptions): Promise<T> {
    return api.get<T>(`${this.BASE}${path}`, opts as Parameters<typeof api.get>[1]);
  }

  protected reqPost<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return api.post<T>(`${this.BASE}${path}`, body, opts as Parameters<typeof api.post>[2]);
  }

  protected reqPut<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return api.put<T>(`${this.BASE}${path}`, body, opts as Parameters<typeof api.put>[2]);
  }

  protected reqPatch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return api.patch<T>(`${this.BASE}${path}`, body, opts as Parameters<typeof api.patch>[2]);
  }

  protected reqDelete(path: string, opts?: RequestOptions): Promise<void> {
    return api.delete(`${this.BASE}${path}`, opts as Parameters<typeof api.delete>[1]);
  }
}
