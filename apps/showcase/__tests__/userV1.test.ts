// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { userV1Service } from '../src/api/services/userV1';

describe('userV1 service (throw model)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setBearerProvider(() => 'jwt');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('sendCode POSTs to /api/v1/user/send-code', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: '验证码已发送' }));
    global.fetch = mockFetch;

    await userV1Service.sendCode('a@b.com');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/user/send-code');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', purpose: 'register' });
  });

  it('sendCode accepts purpose: reset (password recovery)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: '验证码已发送' }));
    global.fetch = mockFetch;

    await userV1Service.sendCode('a@b.com', 'reset');

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'a@b.com', purpose: 'reset' });
  });

  it('login returns token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { token: 'jwt-xyz', userId: 42 } }),
    );
    global.fetch = mockFetch;

    const result = await userV1Service.login({ email: 'a@b.com', password: 'pw' });
    expect(result).toEqual({ token: 'jwt-xyz', userId: 42 });
  });

  it('info attaches Bearer header from provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { id: 1, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' },
      }),
    );
    global.fetch = mockFetch;

    await userV1Service.info();

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt' });
  });

  it('throws ApiError on business code !== 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 51, data: null, message: '参数错误' }));
    global.fetch = mockFetch;

    await expect(userV1Service.sendCode('bad')).rejects.toMatchObject({ code: 51 });
  });

  it('throws ApiError(401) on unauthorized (info)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'unauthorized' }),
    );
    global.fetch = mockFetch;

    await expect(userV1Service.info()).rejects.toMatchObject({ code: 401 });
  });

  it('login throws on 401 without requiring a prior token (pre-auth path)', async () => {
    // Pre-auth: no token, but a 401 (bad password) must NOT fire markRequiresLogin
    // (login uses skipUnauthorized: true). The fact that the call reaches fetch
    // and the 401 propagates as an ApiError proves the request was sent and the
    // suppression path works. The markRequiresLogin side-effect is asserted in
    // auth-store.test.ts at the store-level boundary.
    setBearerProvider(() => null);
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'bad password' }),
    );
    global.fetch = mockFetch;

    await expect(
      userV1Service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 401 });
  });
});
