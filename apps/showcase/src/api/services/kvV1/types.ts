// services/kvV1/types.ts —— /api/v1/kv/* 后端请求 / 响应类型。
//
// 与后端契约对齐(见 dev_ctr_hello skill [[user-kv-invitecode]]):
//   - tags 是 string[];Set 是 replace 语义(空数组 = 清空),Get/List 响应按字母序返回
//   - List 过滤用重复参数 tags=a&tags=b(match=any|all),不是逗号

export type Visibility = 'private' | 'public';

export interface KvItem {
  key: string;
  value: string;
  visibility: Visibility;
  expires_at: string;
  /** 按字母序返回;空数组表示无 tag */
  tags?: string[];
}

export interface KvListResponse {
  items: KvItem[];
  total: number;
}

export interface KvSetArgs {
  key: string;
  value: string;
  visibility?: Visibility;
  ttl?: number;
  /** replace 语义:会替换已有 tag;空数组 = 清空 */
  tags?: string[];
}

export interface KvGetArgs {
  key: string;
  ownerId?: number;
}

export interface KvListArgs {
  limit?: number;
  offset?: number;
  /** 重复参数语义(OR);与 match 组合 */
  tags?: string[];
  /** any = 任一命中(默认),all = 全部命中 */
  match?: 'any' | 'all';
}

/** GET /kv/tags facet 返回项 */
export interface KvTagCount {
  tag: string;
  count: number;
}
