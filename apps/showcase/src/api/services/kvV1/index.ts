// services/kvV1/index.ts —— /api/v1/kv/* 后端接口(SPEC §3 D1)。
//
// 继承 HttpService 基类(../../base.ts),与 userV1 同构。
//
// 鉴权(Bearer JWT)由 setBearerProvider 注入。
// 401 由 request.ts 处理:有 Bearer → jwtAuth.handleUnauthorized(静默降级 JWT 态)。
//
// tag 契约(与后端对齐):Set 带 tags(replace 语义),List 支持 tags=重复参数 +
// match=any|all 过滤,GET /kv/tags 返回 facet。见 dev_ctr_hello
// user-kv-invitecode skill 的 [[client-api]] / [[kv-multi-tag]]。

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type {
  KvItem,
  KvListArgs,
  KvListResponse,
  KvSetArgs,
  KvGetArgs,
  KvTagCount,
} from './types';

export { ApiError } from '../base';
export type {
  KvItem,
  KvListResponse,
  KvListArgs,
  KvSetArgs,
  KvGetArgs,
  KvTagCount,
  Visibility,
} from './types';

export class KvV1Service extends HttpService {
  readonly BASE = apiPaths.kvV1;

  async set(args: KvSetArgs): Promise<void> {
    await this.reqPost('', {
      key: args.key,
      value: args.value,
      visibility: args.visibility ?? 'private',
      ttl: args.ttl ?? 0,
      // replace 语义:传了就用,没传默认 [] = 清空
      tags: args.tags ?? [],
    });
  }

  async get(args: KvGetArgs): Promise<KvItem> {
    const qs = args.ownerId && args.ownerId > 0 ? `?ownerId=${args.ownerId}` : '';
    return this.reqGet<KvItem>(`/${encodeURIComponent(args.key)}${qs}`);
  }

  async delete(args: { key: string }): Promise<void> {
    await this.reqDelete(`/${encodeURIComponent(args.key)}`);
  }

  async list(args: KvListArgs = {}): Promise<KvListResponse> {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set('limit', String(args.limit));
    if (args.offset !== undefined) qs.set('offset', String(args.offset));
    // tags 是重复参数(tags=a&tags=b = 含 a 或 b);match=all 表示全部命中
    for (const tag of args.tags ?? []) qs.append('tags', tag);
    if (args.match) qs.set('match', args.match);
    const path = `${qs.toString() ? `?${qs}` : ''}`;
    return this.reqGet<KvListResponse>(path);
  }

  /** GET /kv/tags —— 当前用户非过期 KV 的 {tag, count} facet(按 count desc / tag asc)。 */
  async tags(): Promise<KvTagCount[]> {
    return this.reqGet<KvTagCount[]>('/tags');
  }
}

export const kvV1Service = new KvV1Service();

