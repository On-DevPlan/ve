// api/http/oidc.ts —— 统一身份登录(OIDC 授权码 + PKCE)的浏览器侧流程。
//
// 登录/注册已迁到认证中心 go-ah(auth-hub)。本模块是 ve 侧的协议客户端,
// 对应后端 go-co 的两个公开端点(SPEC: docs/oidc-sso.md):
//   GET  /api/v1/user/oidc/config     —— 下发 issuer / clientId / authorize 地址
//   POST /api/v1/user/oidc/callback   —— 授权码 + verifier 换本系统 JWT
//
// 流程(与后端随包发布的参考页 manifest/static/oidc-login.html 一致):
//   1. startOidcLogin      拉 config → 生成 state + verifier(S256 challenge)
//                          存 sessionStorage → 返回 authorize URL(调用方 assign 跳走)
//   2. 认证中心完成登录/注册 → 302 回 /oidc/callback?code=&state=
//   3. exchangeOidcCode    校验 state(防 CSRF,后端不校验)→ 用 verifier 换本系统 JWT
//
// 为什么不用 crypto.subtle:subtle 只在 secure context(https/localhost)可用,
// ve dev 绑 0.0.0.0,局域网 http 访问会拿不到;复用仓库内唯一的纯 TS SHA-256
// (api/tools/sha256.ts,分片上传同款)保证 http / https / vitest 行为一致。
//
// 本模块不持有登录态:token 的存续与 Bearer 注入在 auth-store.ts。
// 跳转(window.location.assign)由调用方执行,便于测试与 SSR 隔离。

import { Sha256 } from '../tools/sha256';
import { userV1Service, type OidcConfig, type OidcCallbackResult } from '../services';

// ───── sessionStorage 键(命名对齐 auth-store 的 'sl-userkv:v1:*' 风格) ─────

const STATE_KEY = 'sl-oidc:v1:state';
const VERIFIER_KEY = 'sl-oidc:v1:verifier';
const RETURN_TO_KEY = 'sl-oidc:v1:return-to';

/** SPA 回调路由 —— router/index.ts 里 /oidc/callback;redirect_uri 的 path 部分。 */
export const OIDC_CALLBACK_PATH = '/oidc/callback';

/** OAuth 应用与会话的 localStorage 隔离前缀(auth-store TOKEN_KEY 同款)。 */
export const TOKEN_KEY = 'sl-userkv:v1:token';

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // quota / 隐私模式 —— 丢失后 state 校验会失败,用户重试即可
  }
}

function clearSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ───── redirect_uri ──────────────────────────────────────────────

// 本应用自己的回调地址(origin + /oidc/callback)。
//
// 不能用后端 config.redirectUri —— 那是 go-co 自带参考页
// (47.110.80.47:8988/static/oidc-login.html)的地址。认证中心按 redirect_uri
// 逐字匹配白名单,本应用必须在认证中心 dev-ctr-hello 客户端的 redirect_uris
// 里登记 origin + 本路由;dev 侧登记回环通配条目(http://localhost: 通配端口
// 再接本路由 —— 该字面量内含块注释终结符,此处只能以行注释转述)。
export function oidcRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${OIDC_CALLBACK_PATH}`;
}

// ───── PKCE(S256)原语 ────────────────────────────────────────────

/** RFC 7636 §4.1 unreserved 字符集。 */
const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * 生成 code_verifier(43~128 个 unreserved 字符,默认 64 位)。
 * crypto.getRandomValues 不要求 secure context,非 https 下同样可用。
 */
export function randomVerifier(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += VERIFIER_ALPHABET[bytes[i] % VERIFIER_ALPHABET.length];
  }
  return out;
}

/** 生成 state(16 字节随机 hex,进 URL query,只留 URL 安全字符)。 */
export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) {
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function base64UrlFromHex(hex: string): string {
  // hex → bytes → btoa → base64url(无填充,RFC 7636 要求)
  let bin = '';
  for (let i = 0; i < hex.length; i += 2) {
    bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 challenge = BASE64URL(SHA256(ASCII(verifier))) —— IdP VerifyPKCE 同算法。 */
export function codeChallengeS256(verifier: string): string {
  const digest = new Sha256().update(new TextEncoder().encode(verifier)).digestHex();
  return base64UrlFromHex(digest);
}

// ───── authorize URL ─────────────────────────────────────────────

export interface AuthorizeUrlParams {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

/** 拼授权端点 URL —— 参数与 IdP Authorize controller 的 DTO 逐字对齐。 */
export function buildAuthorizeUrl(config: OidcConfig, params: AuthorizeUrlParams): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    scope: config.scopes.join(' '),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${config.authorizationEndpoint}?${q.toString()}`;
}

// ───── 流程:发起 / 完成 ──────────────────────────────────────────

export interface OidcAttempt {
  state: string;
  verifier: string;
  /** 登录完成后回跳的目标页(登录前的 from 路径,全站跳转会丢 query,存这里)。 */
  returnTo: string;
}

function readAttempt(): OidcAttempt | null {
  const state = readSession(STATE_KEY);
  const verifier = readSession(VERIFIER_KEY);
  if (!state || !verifier) return null;
  return { state, verifier, returnTo: readSession(RETURN_TO_KEY) ?? '/' };
}

export function clearOidcAttempt(): void {
  clearSession(STATE_KEY);
  clearSession(VERIFIER_KEY);
  clearSession(RETURN_TO_KEY);
}

/** 读回跳目标(回调页登录成功后用;未发起过流程时为 '/')。 */
export function readOidcReturnTo(): string {
  return readSession(RETURN_TO_KEY) ?? '/';
}

/**
 * 发起统一身份登录:拉 config → 生成 PKCE → 存 sessionStorage → 返回 authorize URL。
 * 不做跳转 —— 调用方(auth-store)拿 URL 执行 window.location.assign。
 *
 * @throws config.enabled=false / 认证中心不可达 / 网络错误时抛 Error
 */
export async function startOidcLogin(opts?: { returnTo?: string }): Promise<string> {
  const config = await userV1Service.oidcConfig();
  if (!config.enabled) {
    throw new Error('服务端未启用统一身份登录');
  }
  if (!config.idpAvailable) {
    throw new Error(`认证中心不可达：${config.idpError || '未知原因'}`);
  }

  const state = randomState();
  const verifier = randomVerifier(64);
  writeSession(STATE_KEY, state);
  writeSession(VERIFIER_KEY, verifier);
  writeSession(RETURN_TO_KEY, opts?.returnTo || '/');

  return buildAuthorizeUrl(config, {
    state,
    codeChallenge: codeChallengeS256(verifier),
    redirectUri: oidcRedirectUri(),
  });
}

/**
 * 授权码换本系统 JWT(回调页用)。
 * 先校验 state 与发起时存的一致(防 CSRF / 授权码被捡走),再交后端换 token。
 *
 * @throws state 缺失或不匹配 / 后端换票失败时抛 Error
 */
export async function exchangeOidcCode(code: string, state: string): Promise<OidcCallbackResult> {
  const attempt = readAttempt();
  clearOidcAttempt(); // 授权码与 state 都是一次性的,无论成败用后即焚
  if (!attempt) {
    throw new Error('本地没有本次登录的发起记录（可能是直接打开回调页），请重新登录');
  }
  if (attempt.state !== state) {
    throw new Error('state 校验失败，拒绝该授权码（可能被 CSRF）');
  }
  return userV1Service.oidcCallback({
    code,
    codeVerifier: attempt.verifier,
    redirectUri: oidcRedirectUri(),
  });
}
