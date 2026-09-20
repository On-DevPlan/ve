export interface KvItem {
  key: string;
  value: string;
  groupId: number;
  groupName: string;
  myRole: 'owner' | 'admin' | 'writer' | 'reader';
  expires_at: string;
  /** 按字母序返回;空数组表示无 tag */
  tags?: string[];
  /**
   * 可见性。`'public'` 允许匿名经 `/api/v1/kv/public/:key?groupId=` 直读;
   * 后端默认 `'private'`。UI 拿来判定是否出「复制公开链接」按钮。
   * 老后端可能不返回 → 视为 `'private'`(降级到原行为)。
   */
  visibility?: 'public' | 'private';
  /**
   * 是否 secret 加密 KV。value 在 DB 是 `enc1.<base64>` 密文;只有当 ctx 中
   * 有 KEK(用户解锁过二级密码)时,后端才会尝试解密并把明文放进 value 字段。
   * 老后端可能不返回 → 视为 `false`(降级到原行为)。
   */
  secret?: boolean;
  /**
   * 是否当前为「locked」状态。true 表示 secret=true 但用户未解锁 / 解密失败,
   * 此时 value 字段是密文占位,UI 应展示锁图标 + 提示用户解锁。
   * 老后端可能不返回 → 视为 `false`。
   */
  locked?: boolean;
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
  /**
   * 可见性。不传则后端沿用已有值 / 新建默认 private。
   * fr 客户端走匿名 `/kv/public/*`，皮肤/封面/表情索引必须显式 `'public'`。
   */
  visibility?: 'public' | 'private';
  /**
   * 是否用二级密码加密 value(列内 `enc1.` 密文)。true 时后端要求 ctx 中
   * 有 KEK(由 X-Secret-Password header 或 POST /kv/unlock 提供),否则报错。
   * 不传 = false(明文写入,默认行为不变)。
   */
  secret?: boolean;
}

/** POST /kv/:key/visibility —— 切换可见性(需组内 write 角色,审计 set_public/set_private)。
 *  独立于 Set:避免普通覆盖写把 public key 悄悄打回 private(后端 Set 的
 *  visibility *string 行为是省略=保留,显式='private' 才覆盖),所以想改
 *  可见性请走专用端点。 */
export interface KvSetVisibilityArgs {
  key: string;
  groupId?: number;
  visibility: 'public' | 'private';
}

/** GET /kv/public/:key?groupId=<必填> —— 匿名公开读(无需 JWT)。
 *  后端契约:仅放行 `visibility='public'` 且未过期;否则统一 404(key not found,
 *  不泄露存在性)。`groupId` 必填是因为 key 只在组内唯一(`UNIQUE(group_id, key)`)。 */
export interface KvPublicGetArgs {
  key: string;
  /** ≥ 1;必填 */
  groupId: number;
}

/** 公开读响应 —— 不含 myRole(无身份);不含 callerId(匿名)。 */
export interface KvPublicItem {
  key: string;
  value: string;
  expires_at: string;
  tags?: string[];
  groupId: number;
  groupName: string;
  /** 永远 'public'(后端只在 public 时放行) */
  visibility: 'public' | 'private';
  currentVersion: number;
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

// ── KV Secret 二级密码(2026-09-19 后端新增)──────────────────────────────

/** POST /kv/unlock —— 派生 KEK 入 LRU + ctx,后续 secret KV 请求无需带 header。 */
export interface KvUnlockSecretArgs {
  /** 二级密码(用于派生 KEK;首次设置时若 salt 不存在则生成新 salt) */
  password: string;
}

/** POST /kv/reset-secret —— 验证旧密码 + 事务内全表重加密 + 写新 salt。 */
export interface KvResetSecretArgs {
  oldPassword: string;
  newPassword: string;
}

/** POST /kv/reset-secret 响应 —— reEncrypted = 重加密的 secret KV 主行数。 */
export interface KvResetSecretResponse {
  message: string;
  reEncrypted: number;
}

/** GET /kv/secret-status —— 仅 MustAuth,查询「当前用户是否已设置过二级密码」。
 * 不返回密码 / 不返回 KEK / 不返回任何 secret 内容。 */
export interface KvSecretStatusResponse {
  hasPassword: boolean;
}
