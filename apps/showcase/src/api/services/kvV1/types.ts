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
