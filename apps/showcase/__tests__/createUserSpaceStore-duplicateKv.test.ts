// createUserSpaceStore.duplicateKv 单测:store 层只做透传 + 鉴权守卫,关键
// 约束是「sourceGroupId 必须 ≥ 1」+「透传后端返回的 newKey/targetGroupId」。
//
// 鉴权走 jwtAuth.requireAuth():未登录应 throw「not logged in」(跟 createKv
// / restoreKv 行为一致)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtAuth } from '../src/api/http/auth-store';
import { createUserSpaceStore } from '../src/api/components/user-space';

const originalState = jwtAuth.state;

function loggedIn(): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({
      ...originalState,
      token: 'jwt-abc',
      jwtAuthState: 'logged-in',
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'alice', invitationCode: 'X', defaultGroupId: 23 },
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
});

function okBody(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
}

describe('user-space store duplicateKv', () => {
  beforeEach(() => loggedIn());

  it('POSTs duplicate endpoint with sourceGroupId + targetGroupId + returns newKey', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ newKey: 'api_url_copy', targetGroupId: 7 }),
    );
    const store = createUserSpaceStore();
    const res = await store.duplicateKv({ key: 'api_url', sourceGroupId: 3, targetGroupId: 7 });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/api_url/duplicate', expect.objectContaining({
      method: 'POST',
    }));
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({ sourceGroupId: 3, targetGroupId: 7 });
    expect(res).toEqual({ newKey: 'api_url_copy', targetGroupId: 7 });
  });

  it('encodes key in path (e.g. slash) so route never hits 404', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ newKey: 'a/b_copy', targetGroupId: 7 }),
    );
    const store = createUserSpaceStore();
    await store.duplicateKv({ key: 'a/b', sourceGroupId: 3, targetGroupId: 7 });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/kv/a%2Fb/duplicate');
  });

  it('omits sourceGroupId when caller only passes target (backend default-group fallback)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ newKey: 'k', targetGroupId: 7 }),
    );
    const store = createUserSpaceStore();
    await store.duplicateKv({ key: 'k', targetGroupId: 7 });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sourceGroupId');
    expect(body.targetGroupId).toBe(7);
  });

  it('throws when not logged in (consistent with other KV CRUD)', async () => {
    const store = createUserSpaceStore();
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
    await expect(store.duplicateKv({ key: 'k', sourceGroupId: 3, targetGroupId: 7 })).rejects.toThrow('not logged in');
  });

  it('propagates backend errors (e.g. read+/write+ failure) so caller can surface toast', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 31, data: null, message: 'permission denied' }), { status: 200 }),
    );
    const store = createUserSpaceStore();
    await expect(store.duplicateKv({ key: 'k', sourceGroupId: 3, targetGroupId: 7 })).rejects.toMatchObject({ code: 31 });
  });
});