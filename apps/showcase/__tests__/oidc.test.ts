// oidc.test.ts —— 统一身份登录(OIDC 授权码 + PKCE)浏览器侧流程。
//
// 覆盖:
//   1) PKCE S256 challenge 对拍 node:crypto + RFC 7636 附录 B 标准向量
//   2) verifier / state 的形态约束(长度、字符集)
//   3) startOidcLogin:config 校验(enabled / idpAvailable)、sessionStorage 落盘、URL 形态
//   4) exchangeOidcCode:state 校验(防 CSRF)、verifier 透传、用后即焚

// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  randomVerifier,
  randomState,
  codeChallengeS256,
  buildAuthorizeUrl,
  startOidcLogin,
  exchangeOidcCode,
  clearOidcAttempt,
  readOidcReturnTo,
  oidcRedirectUri,
} from '../src/api/http/oidc';
import type { OidcConfig } from '../src/api/services/userV1';

function nodeS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

const CONFIG: OidcConfig = {
  enabled: true,
  issuer: 'http://idp.test',
  clientId: 'dev-ctr-hello',
  redirectUri: 'http://backend.test/static/oidc-login.html',
  scopes: ['openid', 'profile', 'email'],
  authorizationEndpoint: 'http://idp.test/oauth2/auth',
  endSessionEndpoint: 'http://idp.test/oauth2/logout',
  idpAvailable: true,
};

const originalFetch = global.fetch;

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('PKCE primitives', () => {
  it('verifier: 64 chars, RFC 7636 unreserved charset', () => {
    const v = randomVerifier(64);
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('verifier default length is 64', () => {
    expect(randomVerifier()).toHaveLength(64);
  });

  it('state: 32 hex chars', () => {
    expect(randomState()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('S256 challenge matches node:crypto base64url(sha256(verifier))', () => {
    const v = randomVerifier(64);
    expect(codeChallengeS256(v)).toBe(nodeS256(v));
  });

  it('S256 challenge matches RFC 7636 appendix B vector', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(codeChallengeS256(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('buildAuthorizeUrl', () => {
  it('carries response_type/client_id/redirect_uri/scope/state/PKCE S256', () => {
    const url = new URL(
      buildAuthorizeUrl(CONFIG, {
        state: 'st-123',
        codeChallenge: 'ch-456',
        redirectUri: 'http://localhost:5173/oidc/callback',
      }),
    );
    expect(url.origin + url.pathname).toBe('http://idp.test/oauth2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('dev-ctr-hello');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/oidc/callback');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('state')).toBe('st-123');
    expect(url.searchParams.get('code_challenge')).toBe('ch-456');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('oidcRedirectUri', () => {
  it('is origin + /oidc/callback (NOT the backend config redirectUri)', () => {
    expect(oidcRedirectUri()).toBe('http://localhost:3000/oidc/callback');
  });
});

describe('startOidcLogin', () => {
  function mockConfigFetch(overrides: Partial<OidcConfig> = {}) {
    return vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { ...CONFIG, ...overrides } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  it('builds authorize URL and persists state/verifier/returnTo', async () => {
    global.fetch = mockConfigFetch();

    const url = await startOidcLogin({ returnTo: '/components/x' });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://idp.test/oauth2/auth');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/oidc/callback');
    expect(parsed.searchParams.get('client_id')).toBe('dev-ctr-hello');

    const state = parsed.searchParams.get('state') as string;
    const challenge = parsed.searchParams.get('code_challenge') as string;
    const verifier = sessionStorage.getItem('sl-oidc:v1:verifier');
    expect(sessionStorage.getItem('sl-oidc:v1:state')).toBe(state);
    expect(verifier).not.toBeNull();
    expect(codeChallengeS256(verifier as string)).toBe(challenge);
    expect(readOidcReturnTo()).toBe('/components/x');
  });

  it('throws when the backend disabled unified login', async () => {
    global.fetch = mockConfigFetch({ enabled: false });
    await expect(startOidcLogin()).rejects.toThrow('未启用');
  });

  it('throws when the IdP is unreachable', async () => {
    global.fetch = mockConfigFetch({ idpAvailable: false, idpError: 'timeout' });
    await expect(startOidcLogin()).rejects.toThrow('认证中心不可达：timeout');
  });
});

describe('exchangeOidcCode', () => {
  it('rejects when state does not match the stored attempt (CSRF)', async () => {
    global.fetch = vi.fn(); // 不应发起任何请求
    sessionStorage.setItem('sl-oidc:v1:state', 'stored-state');
    sessionStorage.setItem('sl-oidc:v1:verifier', 'stored-verifier');

    await expect(exchangeOidcCode('code', 'forged-state')).rejects.toThrow('state 校验失败');
    expect(global.fetch).not.toHaveBeenCalled();
    // 用后即焚:一次失败也要清掉,不留半份 attempt
    expect(sessionStorage.getItem('sl-oidc:v1:state')).toBeNull();
  });

  it('rejects when no attempt was stored (direct callback visit)', async () => {
    global.fetch = vi.fn();
    await expect(exchangeOidcCode('code', 'any')).rejects.toThrow('请重新登录');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('exchanges code with the stored verifier and clears the attempt', async () => {
    sessionStorage.setItem('sl-oidc:v1:state', 'ok-state');
    sessionStorage.setItem('sl-oidc:v1:verifier', 'ok-verifier');
    sessionStorage.setItem('sl-oidc:v1:return-to', '/somewhere');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            token: 'jwt-1',
            userId: 1,
            email: 'a@b.com',
            username: '',
            nickname: '',
            sub: 's',
            idpIssuer: 'http://idp.test',
            provisioned: false,
            identityBound: true,
            rebound: false,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = mockFetch;

    const result = await exchangeOidcCode('the-code', 'ok-state');

    expect(result.token).toBe('jwt-1');
    expect(result.identityBound).toBe(true);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      code: 'the-code',
      codeVerifier: 'ok-verifier',
      redirectUri: 'http://localhost:3000/oidc/callback',
    });
    // 用后即焚:verifier 一次性,换完就清
    expect(sessionStorage.getItem('sl-oidc:v1:verifier')).toBeNull();
  });

  it('clearOidcAttempt wipes all three keys', () => {
    sessionStorage.setItem('sl-oidc:v1:state', 's');
    sessionStorage.setItem('sl-oidc:v1:verifier', 'v');
    sessionStorage.setItem('sl-oidc:v1:return-to', '/r');
    clearOidcAttempt();
    expect(sessionStorage.getItem('sl-oidc:v1:state')).toBeNull();
    expect(sessionStorage.getItem('sl-oidc:v1:verifier')).toBeNull();
    expect(sessionStorage.getItem('sl-oidc:v1:return-to')).toBeNull();
  });
});
