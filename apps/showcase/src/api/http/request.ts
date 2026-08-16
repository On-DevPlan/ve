// api/http/request.ts —— 统一的 fetch 客户端(API 传输层)。
//
// 位置说明:在 api/http/ 而不是 shared/。
//   shared/ 的定位是"框架无关的共享状态"(auth-store / window-bus / adapters);
//   request 做的是 API 协议与传输 —— 解包络 / raw / Bearer 注入 / 401 信号,
//   属于 api 层的内部实现。放 shared/ 会让 shared 反向依赖 api(见下),
//   现在收进 api/ 内部,shared → api 单向依赖。
//
// 依赖注入(不 import 业务状态):
//   request 不知道 jwtAuth / authStore 长什么样,只认两个注入点:
//     setBearerProvider(fn)            —— auth 侧把 token 塞进来
//     setBearerUnauthorizedHandler(fn) —— Bearer 401 时通知 auth 侧静默降级
//   这样 api/ 完全不依赖 shared/,无循环依赖,且 request 可独立测试。
//
// 设计决策(对应 brainstorm 五项决策):
//   ① 不在 service 里塞转换层 —— 全局转换(包络、命名风格、日期)在此处,
//      领域映射留 service 内做。
//   ② 不做跨框架共享缓存 —— TanStack Query 各框架自治,本模块只暴露请求本身。
//   ③ 鉴权 —— 自有后端走 Bearer JWT(token 经 setBearerProvider 注入),
//      credentials:'include' 保留(后端可选 cookie)。
//   ④ 响应包络 —— 默认解 {code, data, message};第三方走 api.raw.* 不解。
//      "形态不对"的 JSON 宽容回退原值,防止后端 5xx HTML 误解析。
//   ⑤ SSR 同构 —— 不在模块顶层碰 window/localStorage,可被 Node import。
//
// 不变式(invariants):
//   - 不暴露 fetch。所有 service 必须走 api / api.raw,杜绝 raw fetch 直通。
//   - 401 仅发信号,不动路由。Bearer 请求 401 → 注入的 handler(auth 侧清 JWT
//     态);skipUnauthorized 端点(login/register/sendCode)跳过。
//   - body 默认 JSON.stringify;FormData(multipart)与二进制 raw body
//     (Blob / ArrayBuffer / TypedArray,分片上传单片)透传,不 stringify。
//
// **不通过 api/index.ts 导出**。组件不该直接碰 api.get —— 必须走 service 层
// (services/*/index.ts),那里有 BASE 锁定与类型。想裸发请求的唯一方式是
// 显式 `import { api } from '@api/http/request'`,grep 可审计。

// ───── Bearer JWT provider ─────────────────────────────────────────
// jwtAuth 在 init/login 后调 setBearerProvider(() => token) 激活。
// 默认返回 null,无 Bearer 注入。
type BearerProvider = () => string | null;
let bearerProvider: BearerProvider = () => null;

export function setBearerProvider(fn: BearerProvider): void {
  bearerProvider = fn;
}

function bearerHeader(): Record<string, string> {
  const token = bearerProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ───── Bearer 401 handler(注入点,解环用) ──────────────────────────
// 曾经 request 直接 import jwtAuth 调 handleUnauthorized,那会让
//   api/http/request → api/http/auth-store → api/services → api/http/base → request
// 形成循环。改成注入:auth-store 在 init 时注册 handler,request 只调函数。
type UnauthorizedHandler = () => void;
let onBearerUnauthorized: UnauthorizedHandler = () => {};

export function setBearerUnauthorizedHandler(fn: UnauthorizedHandler): void {
  onBearerUnauthorized = fn;
}

// ───── 类型:包络 / 错误 ──────────────────────────────────────────

/** 自有后端统一响应包络(decision ④)。模块内部使用,不导出。 */
interface ApiEnvelope<T> {
  code: number;
  data: T;
  message?: string;
}

/**
 * 业务错误(包络 code !== 0,或 HTTP 非 2xx,或 401)。
 * 重要:401 也抛 ApiError,同时发对应的登出信号——Bearer 请求清 JWT 态,
 * cookie 请求发 requires-login;调用方不 catch 也行,会被外层 error boundary 兜住。
 */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    msg?: string,
  ) {
    super(msg ?? `api error ${code}`);
    this.name = 'ApiError';
  }
}

// ───── 内部 call() ──────────────────────────────────────────────

/** 第三方后端专用:不解包络。默认 false(自有后端统一解)。模块内部使用。 */
interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  headers?: Record<string, string>;
  body?: unknown;
  raw?: boolean;
  /**
   * 显式跳过 401 处理。给登录端点(/api/auth/login 自己可能返回 401)用,
   * 默认 false —— 几乎所有调用都用不到。
   */
  skipUnauthorized?: boolean;
  signal?: AbortSignal;
}

async function call<T>(
  method: string,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    headers = {},
    body,
    raw = false,
    skipUnauthorized = false,
    signal,
    ...rest
  } = options;

  const isFormData = body instanceof FormData;
  // 二进制 raw body 通道(分片上传 PUT 单片用):Blob / ArrayBuffer / TypedArray
  // 原样透传,不 JSON.stringify;content-type 显式 octet-stream(后端分片契约,
  // 不依赖 blob.type —— File 切片会带原文件 MIME)。
  // ArrayBuffer 用 toStringTag 判而不是 instanceof:测试环境(jsdom + Node
  // TextEncoder)里 body 可能来自另一个 realm,跨 realm instanceof 为 false。
  const isBinary =
    !isFormData &&
    (body instanceof Blob ||
      ArrayBuffer.isView(body) ||
      (body !== null && Object.prototype.toString.call(body) === '[object ArrayBuffer]'));
  const init: RequestInit = {
    method,
    credentials: 'include', // 自有后端:httpOnly cookie 由浏览器自动带
    headers: {
      Accept: 'application/json',
      // FormData 时不设 content-type,浏览器自动加 multipart boundary;
      // 二进制 raw body 显式 octet-stream,JSON 默认
      ...(body !== undefined && !isFormData
        ? { 'content-type': isBinary ? 'application/octet-stream' : 'application/json' }
        : {}),
      ...bearerHeader(),
      ...headers,
    },
    body:
      body !== undefined
        ? isFormData || isBinary
          ? body
          : JSON.stringify(body)
        : undefined,
    signal,
    ...rest,
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // 网络层异常(断网/DNS/CORS),重新抛出一个统一的 ApiError,
    // 不让 fetch 原生错误(TypeError)泄露到 service 调用方。
    throw new ApiError(0, `network: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 401 信号(decision ④ 钉法 A:只发信号,不动路由)
  // Bearer 请求的 401 = JWT token 过期/吊销 → 注入的 handler 静默降级。
  if (res.status === 401 && !skipUnauthorized) {
    if (bearerProvider()) {
      onBearerUnauthorized();
    }
    throw new ApiError(401, 'unauthorized');
  }

  // 其他非 2xx
  if (!res.ok) {
    let msg = '';
    try {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        msg =
          j && typeof j === 'object' && 'message' in j
            ? String((j as { message?: unknown }).message)
            : text;
      } catch {
        msg = text; // 非 JSON 错误体(nginx 5xx HTML 等)
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg.slice(0, 500));
  }

  // 解析 JSON;第三方 / 后端偶尔返回空体,允许 undefined
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    // 非 JSON 响应(成功但空体)
    return undefined as T;
  }

  // 第三方后端:原样返回
  if (raw) return json as T;

  // 自有后端:解包络。
  // 防御:响应形态不对(eg. nginx 5xx HTML、第三方混入)——宽容回退,
  // 否则一个第三方恰好返回 {code:0} 就误判为自家结构,反而把数据当包络吃掉。
  if (
    !json ||
    typeof json !== 'object' ||
    !('code' in json) ||
    !('data' in json)
  ) {
    return json as T;
  }

  const env = json as ApiEnvelope<T>;
  if (env.code !== 0) throw new ApiError(env.code, env.message);
  return env.data;
}

// ───── 公开 API:解包络默认 ──────────────────────────────────────

export const api = {
  get: <T>(url: string, opts?: RequestOptions): Promise<T> =>
    call<T>('GET', url, opts),

  post: <T, B = unknown>(
    url: string,
    body?: B,
    opts?: RequestOptions,
  ): Promise<T> => call<T>('POST', url, { ...opts, body }),

  put: <T, B = unknown>(
    url: string,
    body?: B,
    opts?: RequestOptions,
  ): Promise<T> => call<T>('PUT', url, { ...opts, body }),

  patch: <T, B = unknown>(
    url: string,
    body?: B,
    opts?: RequestOptions,
  ): Promise<T> => call<T>('PATCH', url, { ...opts, body }),

  delete: <T>(url: string, opts?: RequestOptions): Promise<T> =>
    call<T>('DELETE', url, opts),

  /**
   * 第三方后端专用入口:不解 `{code,data}` 包络。
   * 通过 raw:true 显式开关,grep 即可审计"哪些 service 走了第三方"。
   */
  raw: {
    get: <T>(url: string, opts?: Omit<RequestOptions, 'raw'>): Promise<T> =>
      call<T>('GET', url, { ...opts, raw: true }),
    post: <T, B = unknown>(
      url: string,
      body?: B,
      opts?: Omit<RequestOptions, 'raw'>,
    ): Promise<T> => call<T>('POST', url, { ...opts, body, raw: true }),
    put: <T, B = unknown>(
      url: string,
      body?: B,
      opts?: Omit<RequestOptions, 'raw'>,
    ): Promise<T> => call<T>('PUT', url, { ...opts, body, raw: true }),
    patch: <T, B = unknown>(
      url: string,
      body?: B,
      opts?: Omit<RequestOptions, 'raw'>,
    ): Promise<T> => call<T>('PATCH', url, { ...opts, body, raw: true }),
    delete: <T>(url: string, opts?: Omit<RequestOptions, 'raw'>): Promise<T> =>
      call<T>('DELETE', url, { ...opts, raw: true }),
  },
};