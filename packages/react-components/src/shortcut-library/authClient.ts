// authClient.ts —— 后端 user API 的 HTTP wrapper(/api/v1/user/*)
//
// 跟 e2ekv client 的差异:
//   - 路径前缀 /api/v1(不是 /v1/e2ekv)
//   - 响应信封 `{code, message, data}`,**HTTP 状态大部分是 200**,仅未登录才是 401
//     业务错误码 50/参数错误 51 都走 HTTP 200,必须看 body.code
//   - 鉴权靠 Bearer JWT(由 store 注入 getAuthToken)
//
// 不存任何 secret:password 只在内存,从不写 localStorage。
// JWT 存 localStorage(不像 e2ekv AuthHash 必须 sessionStorage —— JWT 是 bearer
// token 不是零知识 secret,XSS 风险与一般 API token 同级)。

export interface AuthClientOptions {
  baseUrl: string;
  getAuthToken: () => string | null;
}

export interface ApiError {
  code: number | string;
  message: string;
  status: number;
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ---- Envelope -----------------------------------------------------------

interface Envelope<T> {
  code: number;
  message?: string;
  data?: T;
  // /user/info 等接口是平铺结构,有时 data 是 null
  // 兼容:解包时优先 data,否则用 envelope 本身(由 unwrap 控制)
  error?: string;
}

// 解包信封:HTTP 200 + body.code === 0 → 成功
// HTTP 401 单独映射为 code=401(即使 body 不是预期格式)
// 其他非 0 / 非 200 → 失败
async function call<T>(
  fn: () => Promise<Response>,
  unwrap: (env: Envelope<T>) => T,
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

  // 401 单独处理 —— 没 token 或过期
  if (res.status === 401) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const env = body as Envelope<T> | null;
    return {
      ok: false,
      error: {
        code: env?.code ?? 401,
        message: env?.message ?? env?.error ?? 'unauthorized',
        status: 401,
      },
    };
  }

  // 其他状态码非 2xx:也算失败
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const env = body as Envelope<T> | null;
    return {
      ok: false,
      error: {
        code: env?.code ?? `HTTP_${res.status}`,
        message: env?.message ?? env?.error ?? res.statusText,
        status: res.status,
      },
    };
  }

  let env: Envelope<T>;
  try {
    env = (await res.json()) as Envelope<T>;
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

export interface UserInfo {
  id: number;
  email: string;
  username: string;
  nickname: string;
  invitationCode: string;
}

export interface SendCodeResult { message: string }
export interface RegisterResult { userId: number }
export interface LoginResult { token: string; userId: number }
export interface RegenerateResult { invitationCode: string }

// ---- Factory ------------------------------------------------------------

export interface AuthClient {
  sendCode(email: string): Promise<Result<SendCodeResult, ApiError>>;
  register(args: {
    email: string;
    password: string;
    code: string;
    invitationCode: string;
    nickname?: string;
  }): Promise<Result<RegisterResult, ApiError>>;
  login(args: { email: string; password: string }): Promise<Result<LoginResult, ApiError>>;
  info(): Promise<Result<UserInfo, ApiError>>;
  regenerateInvitation(): Promise<Result<RegenerateResult, ApiError>>;
}

export function createAuthClient(opts: AuthClientOptions): AuthClient {
  const base = opts.baseUrl.replace(/\/+$/, '');

  return {
    async sendCode(email) {
      return call(
        () =>
          fetch(`${base}/api/v1/user/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, purpose: 'register' }),
          }),
        (env) => ({ message: env.message ?? '验证码已发送' }),
      );
    },

    async register(args) {
      return call(
        () =>
          fetch(`${base}/api/v1/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
          }),
        (env) => ({ userId: (env.data as RegisterResult)?.userId ?? 0 }),
      );
    },

    async login(args) {
      return call(
        () =>
          fetch(`${base}/api/v1/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
          }),
        (env) => env.data as LoginResult,
      );
    },

    async info() {
      return call(
        () =>
          fetch(`${base}/api/v1/user/info`, {
            headers: { ...bearerHeader(opts.getAuthToken()) },
          }),
        (env) => env.data as UserInfo,
      );
    },

    async regenerateInvitation() {
      return call(
        () =>
          fetch(`${base}/api/v1/user/invitation/regenerate`, {
            method: 'POST',
            headers: { ...bearerHeader(opts.getAuthToken()) },
          }),
        (env) => env.data as RegenerateResult,
      );
    },
  };
}