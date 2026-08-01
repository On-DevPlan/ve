// userKvClient.ts —— 后端 kv API 的 HTTP wrapper(/api/v1/kv/*)
//
// 用途:存用户私有 / 公开配置。shortcut-library 把整个 groups[] JSON 序列化进
// 单个 key `shortcuts`(visibility=private, ttl=0)。
//
// 响应信封 `{code, message, data}` 跟 authClient 一致:成功 code=0,业务 code=50/51。

import type { ApiError, Result } from './authClient';
// 复用 authClient 的 call() / unwrap pattern。但 authClient 没导出 call(),
// 所以这里独立实现(避免循环依赖);模式完全一致。

export interface UserKvClientOptions {
  baseUrl: string;
  getAuthToken: () => string | null;
}

interface KvEnvelope<T> {
  code: number;
  message?: string;
  data?: T;
}

async function kvCall<T>(
  fn: () => Promise<Response>,
  unwrap: (env: KvEnvelope<T>) => T,
): Promise<Result<T, ApiError>> {
  let res: Response;
  try {
    res = await fn();
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: e instanceof Error ? e.message : String(e),
        status: 0,
      },
    };
  }

  if (res.status === 401) {
    let body: KvEnvelope<T> | null = null;
    try { body = (await res.json()) as KvEnvelope<T>; } catch { /* ignore */ }
    return {
      ok: false,
      error: {
        code: body?.code ?? 401,
        message: body?.message ?? 'unauthorized',
        status: 401,
      },
    };
  }

  // kv 没有专门的 404 端点 — 找不到的 key 是 HTTP 200 + code=50(message: "key not found")
  // 所以走统一的非 0 code 路径,不单独处理 404。

  let env: KvEnvelope<T>;
  try {
    env = (await res.json()) as KvEnvelope<T>;
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'PARSE_ERROR',
        message: e instanceof Error ? e.message : String(e),
        status: res.status,
      },
    };
  }

  if (env.code !== 0) {
    return {
      ok: false,
      error: {
        code: env.code,
        message: env.message ?? '',
        status: res.status,
      },
    };
  }

  return { ok: true, value: unwrap(env) };
}

function bearerHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---- Types --------------------------------------------------------------

export type Visibility = 'private' | 'public';

export interface KvItem {
  key: string;
  value: string;
  visibility: Visibility;
  expires_at: string; // 空串 = 永不过期
}

export interface KvListResponse {
  items: KvItem[];
  total: number;
}

export interface KvSetArgs {
  key: string;
  value: string;
  visibility?: Visibility;
  ttl?: number; // 秒,0 = 不过期
}

export interface KvGetArgs {
  key: string;
  ownerId?: number; // 0 或缺省 = 自己;>0 = 他人(仅 public)
}

// ---- Factory ------------------------------------------------------------

export interface UserKvClient {
  set(args: KvSetArgs): Promise<Result<{ message: string }, ApiError>>;
  get(args: KvGetArgs): Promise<Result<KvItem, ApiError>>;
  delete(args: { key: string }): Promise<Result<{ message: string }, ApiError>>;
  list(args?: { limit?: number; offset?: number }): Promise<Result<KvListResponse, ApiError>>;
}

export function createUserKvClient(opts: UserKvClientOptions): UserKvClient {
  const base = opts.baseUrl.replace(/\/+$/, '');

  return {
    async set(args) {
      const body = {
        key: args.key,
        value: args.value,
        visibility: args.visibility ?? 'private',
        ttl: args.ttl ?? 0,
      };
      return kvCall(
        () =>
          fetch(`${base}/api/v1/kv`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...bearerHeader(opts.getAuthToken()) },
            body: JSON.stringify(body),
          }),
        (env) => ({ message: env.message ?? 'ok' }),
      );
    },

    async get(args) {
      const qs = args.ownerId && args.ownerId > 0 ? `?ownerId=${args.ownerId}` : '';
      return kvCall(
        () =>
          fetch(`${base}/api/v1/kv/${encodeURIComponent(args.key)}${qs}`, {
            headers: { ...bearerHeader(opts.getAuthToken()) },
          }),
        (env) => env.data as KvItem,
      );
    },

    async delete(args) {
      return kvCall(
        () =>
          fetch(`${base}/api/v1/kv/${encodeURIComponent(args.key)}`, {
            method: 'DELETE',
            headers: { ...bearerHeader(opts.getAuthToken()) },
          }),
        (env) => ({ message: env.message ?? 'ok' }),
      );
    },

    async list(args = {}) {
      const qs = new URLSearchParams();
      if (args.limit !== undefined) qs.set('limit', String(args.limit));
      if (args.offset !== undefined) qs.set('offset', String(args.offset));
      const path = `/api/v1/kv${qs.toString() ? `?${qs}` : ''}`;
      return kvCall(
        () =>
          fetch(`${base}${path}`, {
            headers: { ...bearerHeader(opts.getAuthToken()) },
          }),
        (env) => env.data as KvListResponse,
      );
    },
  };
}