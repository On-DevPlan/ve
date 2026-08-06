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
  KvDeleteArgs,
  KvTagCount,
  KvVersionInfo,
} from './types';

export { ApiError } from '../base';
export type {
  KvItem,
  KvListResponse,
  KvListArgs,
  KvSetArgs,
  KvGetArgs,
  KvDeleteArgs,
  KvTagCount,
  KvVersionInfo,
} from './types';

export class KvV1Service extends HttpService {
  readonly BASE = apiPaths.kvV1;

  async set(args: KvSetArgs): Promise<void> {
    const body: { key: string; value: string; ttl: number; tags: string[]; groupId?: number } = {
      key: args.key,
      value: args.value,
      ttl: args.ttl ?? 0,
      // replace 语义:传了就用,没传默认 [] = 清空
      tags: args.tags ?? [],
    };
    if (args.groupId !== undefined && args.groupId > 0) body.groupId = args.groupId;
    await this.reqPost('', body);
  }

  async get(args: KvGetArgs): Promise<KvItem> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    return this.reqGet<KvItem>(`/${encodeURIComponent(args.key)}${qs}`);
  }

  async delete(args: KvDeleteArgs): Promise<void> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    await this.reqDelete(`/${encodeURIComponent(args.key)}${qs}`);
  }

  async list(args: KvListArgs = {}): Promise<KvListResponse> {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set('limit', String(args.limit));
    if (args.offset !== undefined) qs.set('offset', String(args.offset));
    if (args.groupId !== undefined && args.groupId > 0) qs.set('groupId', String(args.groupId));
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

  /** GET /kv/:key/versions —— 历史版本摘要(version_no / value_len / replaced_at,不回 value 全文)。read+。 */
  async versions(args: { key: string; groupId?: number }): Promise<KvVersionInfo[]> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    const res = await this.reqGet<{ versions: KvVersionInfo[] }>(`/${encodeURIComponent(args.key)}/versions${qs}`);
    return res.versions;
  }

  /** POST /kv/:key/restore —— 回滚到指定版本(write+)。本质是 Set:快照当前值 + set/restore 双审计。 */
  async restore(args: { key: string; version: number; groupId?: number }): Promise<void> {
    const body: { version: number; groupId?: number } = { version: args.version };
    if (args.groupId !== undefined && args.groupId > 0) body.groupId = args.groupId;
    await this.reqPost(`/${encodeURIComponent(args.key)}/restore`, body);
  }
}

export const kvV1Service = new KvV1Service();

