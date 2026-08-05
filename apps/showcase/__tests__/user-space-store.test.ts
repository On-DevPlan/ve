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
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'alice', invitationCode: 'X' },
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

describe('user-space store KV CRUD', () => {
  beforeEach(() => loggedIn());

  it('createKv POSTs set with groupId and no visibility', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.createKv(42, { key: 'api_url', value: 'https://x', tags: ['prod'], ttl: 0 });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"groupId":42'),
    }));
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).not.toContain('"visibility"');
  });

  it('updateKv also sets with groupId (upsert by key)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.updateKv(42, { key: 'api_url', value: 'v2', tags: [], ttl: 0 });
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain('"key":"api_url"');
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain('"value":"v2"');
  });

  it('deleteKv DELETE with groupId query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.deleteKv(42, 'api_url');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/api_url?groupId=42', expect.objectContaining({ method: 'DELETE' }));
  });

  it('getKvDetail GETs with groupId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ key: 'k', value: 'v', expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: ['t'] }),
    );
    const store = createUserSpaceStore();
    const view = await store.getKvDetail(42, 'k');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/k?groupId=42', expect.objectContaining({ method: 'GET' }));
    expect(view).toMatchObject({ key: 'k', value: 'v', groupId: 42, groupName: 'g', myRole: 'writer' });
  });

  it('listKvs maps pagination + groupId and truncates preview', async () => {
    const long = 'x'.repeat(120);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({
        items: [
          { key: 'k1', value: long, expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: ['t'] },
          { key: 'k2', value: 'short', expires_at: '', groupId: 42, groupName: 'g', myRole: 'reader', tags: [] },
        ],
        total: 2,
      }),
    );
    const store = createUserSpaceStore();
    const result = await store.listKvs(42, { page: 2, pageSize: 10, tags: ['prod'] });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv?limit=10&offset=10&groupId=42&tags=prod', expect.objectContaining({ method: 'GET' }));
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items[0].valuePreview.endsWith('…')).toBe(true);
    expect(result.items[1].valuePreview).toBe('short');
  });

  it('throws not logged in when token missing', async () => {
    const store = createUserSpaceStore();
    // 覆盖 loggedIn mock,切回 logged-out
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
    await expect(store.createKv(1, { key: 'k', value: 'v', tags: [], ttl: 0 })).rejects.toThrow('not logged in');
  });
});
