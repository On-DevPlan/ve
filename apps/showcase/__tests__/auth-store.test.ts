// auth-store.test.ts —— JWT 会话状态机(OIDC 统一身份登录版)。
//
// 覆盖:
//   1) 初始态 / init 恢复(LS token 验活)/ 401 清场
//   2) beginOidcLogin:拉 config → sessionStorage 落 attempt → 整页跳认证中心
//   3) completeOidcLogin:换 JWT → 落 LS / Bearer / 拉用户信息 → logged-in
//   4) 登录失败(state 不匹配 / 换票失败)→ logged-out + lastError
//   5) 401 静默降级 / 订阅通知

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jwtAuth, getJwtAuthSnapshot, subscribeJwtAuth, TOKEN_KEY } from '../src/api/http/auth-store';
import type { JwtAuthStatus } from '../src/api/http/auth-store';
import { setBearerProvider } from '../src/api/http/request';

describe('jwtAuth (OIDC unified identity)', () => {
  beforeEach(() => {
    setBearerProvider(() => null);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const USER = { id: 42, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' };

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  /**
   * 通过 OIDC 回调路径建立登录态(替代旧密码登录的测试基建):
   * 先在 sessionStorage 落一份 attempt,再 mock 两次 fetch ——
   *   ① POST /api/v1/user/oidc/callback → { token }
   *   ② GET  /api/v1/user/info          → { user }
   */
  async function loginViaOidc(token = 'jwt-xyz') {
    sessionStorage.setItem('sl-oidc:v1:state', 'ok-state');
    sessionStorage.setItem('sl-oidc:v1:verifier', 'ok-verifier');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockJSON(200, {
          code: 0,
          data: {
            token, userId: 42, email: USER.email, username: USER.username,
            nickname: USER.nickname, sub: 's', idpIssuer: 'http://idp.test',
            provisioned: false, identityBound: true, rebound: false,
          },
        }),
      )
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: USER }));
    await jwtAuth.completeOidcLogin('auth-code', 'ok-state');
  }

  it('initial state is logged-out with no token', () => {
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.token).toBeNull();
    expect(jwtAuth.state.jwtUser).toBeNull();
  });

  it('completeOidcLogin stores token, loads user, switches to logged-in', async () => {
    await loginViaOidc('jwt-oidc');
    expect(jwtAuth.state.jwtAuthState).toBe('logged-in');
    expect(jwtAuth.state.token).toBe('jwt-oidc');
    expect(jwtAuth.state.jwtUser?.email).toBe(USER.email);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-oidc');
  });

  it('completeOidcLogin failure (state mismatch) downgrades and records lastError', async () => {
    // 没有发起记录 → exchangeOidcCode 抛"本地没有本次登录的发起记录"
    global.fetch = vi.fn();

    await expect(jwtAuth.completeOidcLogin('code', 'bad-state')).rejects.toThrow();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.lastError).toBeTruthy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('beginOidcLogin fetches config, persists attempt, and navigates to the IdP', async () => {
    // jsdom 的 location 不可伪造 → 走 auth-store 的导航注入点
    const assign = vi.fn();
    const { setPageNavigator } = await import('../src/api/http/auth-store');
    setPageNavigator(assign);
    global.fetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: {
          enabled: true,
          issuer: 'http://idp.test',
          clientId: 'dev-ctr-hello',
          redirectUri: 'http://backend.test/static/oidc-login.html',
          scopes: ['openid', 'profile', 'email'],
          authorizationEndpoint: 'http://idp.test/oauth2/auth',
          endSessionEndpoint: 'http://idp.test/oauth2/logout',
          idpAvailable: true,
        },
      }),
    );

    await jwtAuth.beginOidcLogin('/somewhere');

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('http://idp.test/oauth2/auth');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/oidc/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(sessionStorage.getItem('sl-oidc:v1:state')).toBe(url.searchParams.get('state'));
    expect(sessionStorage.getItem('sl-oidc:v1:return-to')).toBe('/somewhere');
  });

  it('beginOidcLogin failure (IdP unreachable) downgrades with lastError and rethrows', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: {
          enabled: true, issuer: '', clientId: '', redirectUri: '', scopes: [],
          authorizationEndpoint: '', endSessionEndpoint: '',
          idpAvailable: false, idpError: 'connection refused',
        },
      }),
    );

    await expect(jwtAuth.beginOidcLogin()).rejects.toThrow('认证中心不可达');
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.lastError).toBeTruthy();
  });

  it('logout clears token and resets state', async () => {
    await loginViaOidc('jwt');
    jwtAuth.logout();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('init restores session from LS token', async () => {
    localStorage.setItem(TOKEN_KEY, 'restored-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));

    const result = await jwtAuth.init();
    expect(result?.mode).toBe('login');
    expect(jwtAuth.state.jwtAuthState).toBe('logged-in');
    expect(jwtAuth.state.token).toBe('restored-jwt');
  });

  it('init with no token returns null', async () => {
    const result = await jwtAuth.init();
    expect(result).toBeNull();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
  });

  it('init with invalid 401 clears LS', async () => {
    localStorage.setItem(TOKEN_KEY, 'bad-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'unauthorized' }));

    const result = await jwtAuth.init();
    expect(result).toBeNull();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('subscribe delivers initial value then updates on logout', async () => {
    const received: JwtAuthStatus[] = [];
    const unsub = subscribeJwtAuth((s) => received.push(s));
    expect(received.length).toBe(1);
    expect(received[0].jwtAuthState).toBe('logged-out');

    await loginViaOidc('jwt');
    expect(received[received.length - 1].jwtAuthState).toBe('logged-in');

    jwtAuth.logout();
    expect(received[received.length - 1].jwtAuthState).toBe('logged-out');

    unsub();
  });

  it('getJwtAuthSnapshot returns a plain copy', async () => {
    await loginViaOidc('jwt');

    const snap = getJwtAuthSnapshot();
    expect(snap.token).toBe('jwt');
    expect(snap).not.toBe(jwtAuth.state);
  });

  it('after login, Bearer provider returns the live token', async () => {
    await loginViaOidc('jwt-live');

    const infoFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));
    global.fetch = infoFetch;
    const { userV1Service } = await import('../src/api/services/userV1');
    await userV1Service.info();

    const init = infoFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-live' });
  });

  it('JWT-authenticated 401 downgrades jwtAuth silently', async () => {
    await loginViaOidc('jwt');
    expect(jwtAuth.state.jwtAuthState).toBe('logged-in');
    expect(jwtAuth.state.token).toBe('jwt');

    // token 过期/吊销:JWT 请求(info)返回 401
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'unauthorized' }));
    const { userV1Service } = await import('../src/api/services/userV1');
    await expect(userV1Service.info()).rejects.toMatchObject({ code: 401 });

    // jwtAuth 被静默降级:清 token + LS,状态回 logged-out
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.token).toBeNull();
    expect(jwtAuth.state.jwtUser).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
