import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtAuth } from '../src/api/http/auth-store';
import { createUserSpaceStore } from '../src/api/components/user-space';

const originalState = jwtAuth.state;

function loggedIn(defaultGroupId = 0): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({
      ...originalState,
      token: 'jwt-abc',
      jwtAuthState: 'logged-in',
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'alice', invitationCode: 'X', defaultGroupId },
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

  it('listKvVersions GETs versions endpoint and maps snake_case → camelCase', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({
        versions: [
          { version_no: 2, value_len: 42, replaced_at: '2026-08-01T12:00:00+08:00' },
          { version_no: 1, value_len: 7, replaced_at: '2026-07-30T09:00:00+08:00' },
        ],
      }),
    );
    const store = createUserSpaceStore();
    const vers = await store.listKvVersions(42, 'api_url');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/api_url/versions?groupId=42', expect.objectContaining({ method: 'GET' }));
    expect(vers).toEqual([
      { versionNo: 2, valueLen: 42, replacedAt: '2026-08-01T12:00:00+08:00' },
      { versionNo: 1, valueLen: 7, replacedAt: '2026-07-30T09:00:00+08:00' },
    ]);
  });

  it('restoreKv POSTs restore with version + groupId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();
    await store.restoreKv(42, 'api_url', 2);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv/api_url/restore', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"version":2'),
    }));
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain('"groupId":42');
  });

  it('throws not logged in when token missing', async () => {
    const store = createUserSpaceStore();
    // 覆盖 loggedIn mock,切回 logged-out
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
    await expect(store.createKv(1, { key: 'k', value: 'v', tags: [], ttl: 0 })).rejects.toThrow('not logged in');
  });

  describe('getShortcuts lazy migration', () => {
    it('consolidates legacy sl-group-* / sl-shortcut-* rows into the new blob on first read', async () => {
      loggedIn(23);
      const g1 = { id: 'gx1', name: 'VSCode', order: 1, createdAt: 1000, updatedAt: 1500 };
      const s1 = { id: 'sx1', groupId: 'gx1', order: 1, combo: [{ code: 'KeyR', label: 'R', isModifier: false }], description: 'd1', createdAt: 1100, updatedAt: 1200 };
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        // 1) GET /kv/shortcuts?groupId=23 -> 404 (code 50)
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 50, data: null }), { status: 200 }))
        // 2) GET /kv?tags=shortcut-library&groupId=23&limit=200 -> legacy rows
        .mockResolvedValueOnce(new Response(JSON.stringify({
          code: 0,
          data: {
            items: [
              { key: 'sl-group-gx1', value: JSON.stringify(g1), groupId: 23, groupName: 'g', myRole: 'owner', expires_at: '', tags: ['shortcut-library'] },
              { key: 'sl-shortcut-sx1', value: JSON.stringify(s1), groupId: 23, groupName: 'g', myRole: 'owner', expires_at: '', tags: ['shortcut-library'] },
            ],
            total: 2,
          },
        }), { status: 200 }));
      // 3) POST /kv (set 'shortcuts' blob) + 4) DELETE for each legacy key
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }));

      const store = createUserSpaceStore();
      const result = await store.getShortcuts();
      expect(result).toEqual([{
        id: 'gx1', name: 'VSCode', createdAt: 1000, updatedAt: 1500,
        shortcuts: [{ id: 'sx1', combo: s1.combo, description: 'd1', condition: undefined, createdAt: 1100 }],
      }]);
      // 1) GET 'shortcuts' (not found)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/kv/shortcuts?groupId=23');
      // 2) listByTag
      expect(String(fetchMock.mock.calls[1][0])).toContain('tags=shortcut-library');
      expect(String(fetchMock.mock.calls[1][0])).toContain('groupId=23');
    });

    it('returns [] when shortcuts blob is missing and tag list is empty (fresh user)', async () => {
      loggedIn(23);
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 50, data: null }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { items: [], total: 0 } }), { status: 200 }));
      const store = createUserSpaceStore();
      await expect(store.getShortcuts()).resolves.toEqual([]);
    });

    it('parses a present shortcuts blob directly (no migration)', async () => {
      loggedIn(23);
      const groups = [{ id: 'g1', name: 'Browser', shortcuts: [], createdAt: 0, updatedAt: 0 }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: { key: 'shortcuts', value: JSON.stringify(groups), groupId: 23, groupName: 'g', myRole: 'owner', expires_at: '', tags: ['shortcut-library'] } }), { status: 200 }),
      );
      const store = createUserSpaceStore();
      await expect(store.getShortcuts()).resolves.toEqual(groups);
    });
  });
});
