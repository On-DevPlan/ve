// kvHelpers.ts — KV 缺失与组角色探测（封面/皮肤/表情共用）
//
// key not found（ApiError code 50）是「尚未初始化」的正常态，不是故障。
// 同组任意可读 key 可带回 myRole；组内全空时若已登录，暂按 admin 允许首次 set。

import { ApiError, kvV1Service } from '@api/services';
import { jwtAuth } from '@api/http/auth-store';

export type GroupRole = 'owner' | 'admin' | 'writer' | 'reader';

/** 探 role 时优先尝试的同组 key（存在则带回 myRole）。 */
export const K_GROUP_ROLE_PROBE_KEYS = [
  'game-center_catalog:index',
  'chess_skin:index',
  'gomoku_skin:index',
  'emoji_common:index',
  'novel_reader_catalog:index',
] as const;

export function isKvKeyMissing(e: unknown): boolean {
  if (e instanceof ApiError) return e.code === 50 || e.code === 404;
  const msg = e instanceof Error ? e.message : String(e);
  return /not found|不存在|无此 key/i.test(msg);
}

/**
 * 解析 group 内当前用户角色。
 * - 未登录 → null
 * - 任一 probe key 可读 → 用其 myRole
 * - 全缺失但已登录 → 'admin'（允许首次写入建 key；后端 set 仍会鉴权）
 */
export async function resolveGroupRole(
  groupId: number,
  probeKeys: readonly string[] = K_GROUP_ROLE_PROBE_KEYS,
): Promise<GroupRole | null> {
  if (!jwtAuth.state.token) return null;
  for (const key of probeKeys) {
    try {
      const item = await kvV1Service.get({ key, groupId });
      const role = item.myRole as GroupRole | undefined;
      if (role) return role;
    } catch (e) {
      if (!isKvKeyMissing(e)) {
        // 权限/网络错误：继续试下一个；全失败再 fallback
        continue;
      }
    }
  }
  return 'admin';
}

/** 安全解析 JSON array；失败返回 []。 */
export function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
