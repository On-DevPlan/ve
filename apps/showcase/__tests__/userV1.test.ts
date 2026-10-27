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

  it('oidcConfig GETs /api/v1/user/oidc/config (public, no Bearer)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: {
          enabled: true,
          issuer: 'http://idp.test',
          clientId: 'dev-ctr-hello',
          redirectUri: 'http://backend/static/oidc-login.html',
          scopes: ['openid', 'profile', 'email'],
          authorizationEndpoint: 'http://idp.test/oauth2/auth',
          endSessionEndpoint: 'http://idp.test/oauth2/logout',
          idpAvailable: true,
        },
      }),
    );
    global.fetch = mockFetch;

    const config = await userV1Service.oidcConfig();

    expect(config.enabled).toBe(true);
    expect(config.clientId).toBe('dev-ctr-hello');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/user/oidc/config');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
  });

  it('oidcCallback POSTs code/codeVerifier/redirectUri to /api/v1/user/oidc/callback', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: {
          token: 'jwt-xyz',
          userId: 42,
          email: 'a@b.com',
          username: 'u',
          nickname: 'n',
          sub: 'sub-1',
          idpIssuer: 'http://idp.test',
          provisioned: true,
          identityBound: false,
          rebound: false,
        },
      }),
    );
    global.fetch = mockFetch;

    const result = await userV1Service.oidcCallback({
      code: 'auth-code',
      codeVerifier: 'verifier-xyz',
      redirectUri: 'http://localhost:5173/oidc/callback',
    });

    expect(result.token).toBe('jwt-xyz');
    expect(result.provisioned).toBe(true);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/user/oidc/callback');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      code: 'auth-code',
      codeVerifier: 'verifier-xyz',
      redirectUri: 'http://localhost:5173/oidc/callback',
    });
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

    await expect(userV1Service.oidcConfig()).rejects.toMatchObject({ code: 51 });
  });

  it('throws ApiError(401) on unauthorized (info)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'unauthorized' }),
    );
    global.fetch = mockFetch;

    await expect(userV1Service.info()).rejects.toMatchObject({ code: 401 });
  });

  it('oidcCallback 401 does not fire global logout signal (skipUnauthorized)', async () => {
    // Pre-auth: no token, and the exchange endpoint must not trigger
    // markRequiresLogin on 401. Reaching fetch + ApiError propagation proves it.
    setBearerProvider(() => null);
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'unauthorized' }),
    );
    global.fetch = mockFetch;

    await expect(
      userV1Service.oidcCallback({ code: 'c', codeVerifier: 'v', redirectUri: 'http://x/cb' }),
    ).rejects.toMatchObject({ code: 401 });
  });

  it('getDefaultGroup GETs /api/v1/user/default-group and unwraps {groupId, name, myRole}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { groupId: 42, name: 'project-x', myRole: 'owner' },
      }),
    );
    global.fetch = mockFetch;

    const result = await userV1Service.getDefaultGroup();
    expect(result).toEqual({ groupId: 42, name: 'project-x', myRole: 'owner' });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/user/default-group');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt' });
  });

  it('getDefaultGroup returns {groupId:0,...} when caller has not set a default', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { groupId: 0, name: '', myRole: 'reader' },
      }),
    );
    global.fetch = mockFetch;
    await expect(userV1Service.getDefaultGroup()).resolves.toEqual({
      groupId: 0,
      name: '',
      myRole: 'reader',
    });
  });

  it('getDefaultGroup propagates 401 as ApiError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'unauthorized' }),
    );
    global.fetch = mockFetch;
    await expect(userV1Service.getDefaultGroup()).rejects.toMatchObject({ code: 401 });
  });
});
