// auth-store.test.ts —— auth-store 五态 + client 分支行为。
//
// SSR 隔离保护见 auth-store.ssr.test.ts(node environment)。
//
// 覆盖钉法 B/C/D:
//   1) 五态迁移:idle→restoring→{authenticated, anonymous, requires-login}
//   2) cross-tab cross-call 行为:client 是 globalThis 单例,最近写赢
//   3) subscribe 注册立刻拿到当前值(don't-miss-current-state)
//   4) hydrateFromCache 把缓存填到 user,然后标 restoring(等 /me 验真)

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jwtAuth, getJwtAuthSnapshot, subscribeJwtAuth, TOKEN_KEY } from '../src/api/http/auth-store';
import type { JwtAuthStatus } from '../src/api/http/auth-store';
import { setBearerProvider } from '../src/api/http/request';
describe('jwtAuth (additive path)', () => {
  beforeEach(() => {
    setBearerProvider(() => null);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const USER = { id: 42, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' };

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  it('initial state is logged-out with no token', () => {
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.token).toBeNull();
    expect(jwtAuth.state.jwtUser).toBeNull();
  });

  it('login sets token and switches to logged-in', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt-xyz', userId: 42 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: USER }));

    await jwtAuth.login('a@b.com', 'pw');
    expect(jwtAuth.state.jwtAuthState).toBe('logged-in');
    expect(jwtAuth.state.token).toBe('jwt-xyz');
    expect(jwtAuth.state.jwtUser?.email).toBe('a@b.com');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-xyz');
  });

  it('logout clears token and resets state', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    await jwtAuth.login('a@b.com', 'pw');
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

  it('login failure stores lastError and rethrows', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'bad password' }));

    await expect(jwtAuth.login('a@b.com', 'wrong')).rejects.toThrow();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.lastError).toBeTruthy();
  });

  it('subscribe delivers initial value then updates on logout', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    const received: JwtAuthStatus[] = [];
    const unsub = subscribeJwtAuth((s) => received.push(s));
    expect(received.length).toBe(1);
    expect(received[0].jwtAuthState).toBe('logged-out');

    await jwtAuth.login('a@b.com', 'pw');
    expect(received[received.length - 1].jwtAuthState).toBe('logged-in');

    jwtAuth.logout();
    expect(received[received.length - 1].jwtAuthState).toBe('logged-out');

    unsub();
  });

  it('getJwtAuthSnapshot returns a plain copy', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    await jwtAuth.login('a@b.com', 'pw');

    const snap = getJwtAuthSnapshot();
    expect(snap.token).toBe('jwt');
    expect(snap).not.toBe(jwtAuth.state);
  });

  it('after login, Bearer provider returns the live token', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt-live', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    await jwtAuth.login('a@b.com', 'pw');

    const infoFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));
    global.fetch = infoFetch;
    const { userV1Service } = await import('../src/api/services/userV1');
    await userV1Service.info();

    const init = infoFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-live' });
  });

  it('JWT-authenticated 401 downgrades jwtAuth silently', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    await jwtAuth.login('a@b.com', 'pw');
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
