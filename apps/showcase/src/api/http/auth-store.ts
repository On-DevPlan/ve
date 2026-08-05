// api/http/auth-store.ts —— JWT/Bearer 认证单例(shortcut-library 云同步用)。
//
// 为什么在这里(而不是 shared/):JWT token 管理 / bearer 注入 / 401 降级
// 都是 API 传输层的事,和 request.ts 是同一层。shared/ 只保留跨框架共享的
// UI 桥接(登录弹窗 useLoginModal 等),不装 API 状态。
//
// 曾经这里还有一个 cookie-auth 的 5 态 authStore + SSR AsyncLocalStorage,已在
// cookie 路径移除时砍掉(登录/会话全走 JWT,见下)。只保留 userV1/kvV1 需要的
// Bearer JWT 状态机。
//
// 设计要点:
//   - token 只落 localStorage('sl-userkv:v1:token');JWT 是 bearer 不是零知识
//     secret,XSS 风险与一般 API token 同级。
//   - 启动时 jwtAuth.init() 用 LS token 调 /user/info 验活 → logged-in / logged-out。
//   - setBearerProvider(() => token) 注入 request.ts 的 Authorization 头。
//   - 401(request.ts 分流):Bearer 请求 → jwtAuth.handleUnauthorized() 静默降级。
//   - React 端跨框架订阅:useJwtAuth()(force-rerender,见文件尾)。
//
// 状态机:
//   logged-out → init/login/register → logged-in
//   logged-in  → logout / 401 → logged-out
//   任意操作中 → syncing → logged-in / error / logged-out

import { ref } from 'vue';
// 目录内部一律走相对路径,不 import '@api'(barrel)——
// '@api' 会经 index → components → createShortcutStore → 本文件 形成循环。
// 见 api/services/README.md「目录内部 import 规则」。
import { userV1Service, type UserInfo } from '../services';
import { setBearerProvider, setBearerUnauthorizedHandler } from './request';

export const TOKEN_KEY = 'sl-userkv:v1:token';
const EMAIL_KEY = 'sl-userkv:v1:email';

export type JwtAuthState = 'logged-out' | 'logged-in' | 'syncing' | 'error';

export interface JwtAuthStatus {
  jwtAuthState: JwtAuthState;
  jwtUser: UserInfo | null;
  token: string | null;
  lastError: string | null;
}

const tokenRef = ref<string | null>(null);
const jwtUserRef = ref<UserInfo | null>(null);
const jwtAuthStateRef = ref<JwtAuthState>('logged-out');
const lastErrorRef = ref<string | null>(null);

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota
  }
}

function removeLS(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type JwtListener = (s: JwtAuthStatus) => void;
let jwtListeners: JwtListener[] = [];

function readJwtSnapshot(): JwtAuthStatus {
  return {
    jwtAuthState: jwtAuthStateRef.value,
    jwtUser: jwtUserRef.value,
    token: tokenRef.value,
    lastError: lastErrorRef.value,
  };
}

function notifyJwt(): void {
  const snapshot = readJwtSnapshot();
  for (const listener of jwtListeners) {
    try {
      listener(snapshot);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function subscribeJwtAuth(listener: JwtListener): () => void {
  listener(readJwtSnapshot());
  jwtListeners.push(listener);
  return () => {
    jwtListeners = jwtListeners.filter((current) => current !== listener);
  };
}

export function getJwtAuthSnapshot(): JwtAuthStatus {
  return { ...readJwtSnapshot() };
}

export const jwtAuth = {
  get state(): JwtAuthStatus {
    return readJwtSnapshot();
  },

  async init(): Promise<{ mode: 'login' } | null> {
    const token = readLS(TOKEN_KEY);
    if (!token) {
      jwtAuthStateRef.value = 'logged-out';
      notifyJwt();
      return null;
    }
    tokenRef.value = token;
    setBearerProvider(() => tokenRef.value);
    try {
      const info = await userV1Service.info();
      jwtUserRef.value = info;
      writeLS(EMAIL_KEY, info.email);
      jwtAuthStateRef.value = 'logged-in';
      notifyJwt();
      return { mode: 'login' };
    } catch {
      removeLS(TOKEN_KEY);
      tokenRef.value = null;
      jwtUserRef.value = null;
      jwtAuthStateRef.value = 'logged-out';
      setBearerProvider(() => null);
      notifyJwt();
      return null;
    }
  },

  async login(email: string, password: string): Promise<void> {
    jwtAuthStateRef.value = 'syncing';
    lastErrorRef.value = null;
    notifyJwt();
    try {
      const result = await userV1Service.login({ email, password });
      tokenRef.value = result.token;
      writeLS(TOKEN_KEY, result.token);
      writeLS(EMAIL_KEY, email);
      setBearerProvider(() => tokenRef.value);
      try {
        jwtUserRef.value = await userV1Service.info();
      } catch {
        jwtUserRef.value = null;
      }
      jwtAuthStateRef.value = 'logged-in';
      notifyJwt();
    } catch (error) {
      jwtAuthStateRef.value = 'logged-out';
      lastErrorRef.value = error instanceof Error ? error.message : 'login failed';
      tokenRef.value = null;
      jwtUserRef.value = null;
      notifyJwt();
      throw error;
    }
  },

  async register(args: {
    email: string;
    password: string;
    code: string;
    invitationCode: string;
    nickname?: string;
  }): Promise<void> {
    jwtAuthStateRef.value = 'syncing';
    lastErrorRef.value = null;
    notifyJwt();
    try {
      await userV1Service.register(args);
      await this.login(args.email, args.password);
    } catch (error) {
      jwtAuthStateRef.value = 'logged-out';
      lastErrorRef.value = error instanceof Error ? error.message : 'register failed';
      notifyJwt();
      throw error;
    }
  },

  async sendCode(email: string): Promise<void> {
    await userV1Service.sendCode(email);
  },

  logout(): void {
    // 显式退出:只清 JWT 态。不跳 /login、不碰任何 cookie。
    this.handleUnauthorized();
  },

  /** JWT 401(token 过期/吊销)时静默降级:清 token/LS/bearer,置 logged-out。 */
  handleUnauthorized(): void {
    tokenRef.value = null;
    jwtUserRef.value = null;
    lastErrorRef.value = null;
    removeLS(TOKEN_KEY);
    removeLS(EMAIL_KEY);
    setBearerProvider(() => null);
    jwtAuthStateRef.value = 'logged-out';
    notifyJwt();
  },

  async regenerateInvitation(): Promise<string> {
    jwtAuthStateRef.value = 'syncing';
    try {
      const result = await userV1Service.regenerateInvitation();
      if (jwtUserRef.value) {
        jwtUserRef.value = { ...jwtUserRef.value, invitationCode: result.invitationCode };
      }
      jwtAuthStateRef.value = 'logged-in';
      notifyJwt();
      return result.invitationCode;
    } catch (error) {
      jwtAuthStateRef.value = 'error';
      lastErrorRef.value = error instanceof Error ? error.message : 'regenerate failed';
      notifyJwt();
      throw error;
    }
  },
};

// ───── 注入 Bearer 401 处理器(解环) ────────────────────────────────
// request 不再 import 本文件,而是接受注入:
//   Bearer 请求 401 → 这里注册的 handler → jwtAuth.handleUnauthorized()
// 必须在 jwtAuth 定义之后注册(避免 const 提升 TDZ)。
// 副作用:handleUnauthorized 会 setBearerProvider(() => null) 清掉 token 注入,
// 这正是 401 后"下次请求不再带失效 Bearer"的期望行为。
setBearerUnauthorizedHandler(() => jwtAuth.handleUnauthorized());

// ───── React 跨框架 hook ─────────────────────────────────────────
// 不能用 useSyncExternalStore + ref 代理:代理原地修改,快照引用不变 → React
// 不重渲染。用 useReducer 强制 rerender + subscribeJwtAuth 监听。

import { useReducer, useEffect } from 'react';

export function useJwtAuth(): JwtAuthStatus {
  const [, force] = useReducer((value: number) => value + 1, 0);
  useEffect(() => subscribeJwtAuth(() => force()), []);
  return jwtAuth.state;
}
