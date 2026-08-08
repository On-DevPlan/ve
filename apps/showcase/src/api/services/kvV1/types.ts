export interface KvItem {
  key: string;
  value: string;
  groupId: number;
  groupName: string;
  myRole: 'owner' | 'admin' | 'writer' | 'reader';
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
  /** 秒;0=永不过期 */
  ttl?: number;
  /** replace 语义:会替换已有 tag;空数组 = 清空 */
  tags?: string[];
  /** 工作空间 id;0 或不传 = 默认组 */
  groupId?: number;
}

export interface KvGetArgs {
  key: string;
  groupId?: number;
}

export interface KvDeleteArgs {
  key: string;
  groupId?: number;
}

export interface KvListArgs {
  limit?: number;
  offset?: number;
  tags?: string[];
  match?: 'any' | 'all';
  groupId?: number;
}

export interface KvTagCount {
  tag: string;
  count: number;
}

/** GET /kv/:key/versions 返回的历史版本摘要。刻意不含 value 全文,只回长度,避免大 value 撑爆响应。 */
export interface KvVersionInfo {
  version_no: number;
  value_len: number;
  replaced_at: string;
}

/** POST /kv/:key/duplicate —— 跨组复制 KV(source → target;源 read+,目标 write+)。
 * 后端在源/目标都把 caller 的 default_group_id 作为 fallback(0 或不传)——这里
 * 显式传入实际 groupId,避免「我在 A 组复制,默认组是 B」时被默认组解析劫持。 */
export interface KvDuplicateArgs {
  key: string;
  /** ≥ 1;0 或不传=回退到 caller default group */
  sourceGroupId?: number;
  /** ≥ 1 */
  targetGroupId: number;
}

/** POST /kv/:key/duplicate 返回;newKey 即真实写入目标组的 key(冲突后自动加 _copy 后缀)。 */
export interface KvDuplicateResponse {
  newKey: string;
  targetGroupId: number;
}
