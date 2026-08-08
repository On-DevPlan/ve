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

  describe('default group resolution', () => {
    it('resolveDefaultGroupId prefers /user/default-group (no listGroups fallback)', async () => {
      loggedIn(0);
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(okBody({ groupId: 99, name: 'p', myRole: 'owner' }))
        // 任何进一步 fetch 都让它抛,这样万一 store 兜底再调 listGroups,会暴露
        .mockImplementation(() => { throw new Error('unexpected fetch'); });

      const store = createUserSpaceStore();
      const id = await store.getDefaultGroupId();
      expect(id).toBe(99);
      // 只发了 /default-group 一次,没碰 listGroups
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe('/api/v1/user/default-group');
    });

    it('resolveDefaultGroupId falls back to listGroups when /default-group fails', async () => {
      loggedIn(0);
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        // 1) /default-group → 500
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 500, message: 'boom' }), { status: 500 }))
        // 2) listGroups → 第一个组的 id
        .mockResolvedValueOnce(okBody({
          groups: [{ id: 7, name: 'fallback', description: '', ownerId: 1, myRole: 'owner', memberCount: 1, createdAt: '', updatedAt: '' }],
        }));

      const store = createUserSpaceStore();
      const id = await store.getDefaultGroupId();
      expect(id).toBe(7);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toBe('/api/v1/groups');
    });

    it('resolveDefaultGroupId returns null when default is unset (groupId=0), no listGroups fallback', async () => {
      loggedIn(0);
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(okBody({ groupId: 0, name: '', myRole: 'reader' }))
        .mockImplementation(() => { throw new Error('unexpected fetch — should not listGroups'); });

      const store = createUserSpaceStore();
      const id = await store.getDefaultGroupId();
      expect(id).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('getDefaultGroupInfo returns {groupId, name, myRole} from the new endpoint', async () => {
      loggedIn(0);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        okBody({ groupId: 42, name: 'project-x', myRole: 'owner' }),
      );
      const store = createUserSpaceStore();
      const info = await store.getDefaultGroupInfo();
      expect(info).toEqual({ groupId: 42, name: 'project-x', myRole: 'owner' });
    });

    it('getDefaultGroupInfo returns a safe placeholder when the endpoint fails', async () => {
      loggedIn(0);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));
      const store = createUserSpaceStore();
      const info = await store.getDefaultGroupInfo();
      expect(info).toEqual({ groupId: 0, name: '', myRole: 'reader' });
    });
  });

  describe('getShortcuts lazy migration', () => {
    it('consolidates legacy sl-group-* / sl-shortcut-* rows into the new blob on first read', async () => {
      loggedIn(23);
      const g1 = { id: 'gx1', name: 'VSCode', order: 1, createdAt: 1000, updatedAt: 1500 };
      const s1 = { id: 'sx1', groupId: 'gx1', order: 1, combo: [{ code: 'KeyR', label: 'R', isModifier: false }], description: 'd1', createdAt: 1100, updatedAt: 1200 };
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        // 1) GET /kv/shortcut-library (不传 groupId,后端走 default) -> 404 (code 50)
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 50, data: null }), { status: 200 }))
        // 2) GET /kv?tags=shortcut-library (不传 groupId) -> legacy rows
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
      // 3) POST /kv (set 'shortcut-library' blob) + 4) DELETE for each legacy key
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }));

      const store = createUserSpaceStore();
      const result = await store.getShortcuts();
      expect(result).toEqual([{
        id: 'gx1', name: 'VSCode', createdAt: 1000, updatedAt: 1500,
        shortcuts: [{ id: 'sx1', combo: s1.combo, description: 'd1', condition: undefined, createdAt: 1100 }],
      }]);
      // 1) GET 'shortcut-library' (not found, no groupId)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/kv/shortcut-library');
      // 2) listByTag (no groupId)
      expect(String(fetchMock.mock.calls[1][0])).toContain('tags=shortcut-library');
      expect(String(fetchMock.mock.calls[1][0])).not.toContain('groupId=');
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
        new Response(JSON.stringify({ code: 0, data: { key: 'shortcut-library', value: JSON.stringify(groups), groupId: 23, groupName: 'g', myRole: 'owner', expires_at: '', tags: ['shortcut-library'] } }), { status: 200 }),
      );
      const store = createUserSpaceStore();
      await expect(store.getShortcuts()).resolves.toEqual(groups);
    });

    it('omits groupId from KV calls (backend resolves default)', async () => {
      // 新契约:getShortcuts / setShortcuts 不传 groupId,后端 KV 端点自己用
      // caller 的 default_group_id(见 dev_ctr_hello user-kv-invitecode 技能
      // [[client-api]] §6:「groupId 0 或不传 → 回退到 default_group_id」)。
      // 前端不用解析 / 缓存 groupId —— 切默认组后所有组件自动命中。
      loggedIn(23);
      const groups = [{ id: 'g1', name: 'Browser', shortcuts: [], createdAt: 0, updatedAt: 0 }];
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: { key: 'shortcut-library', value: JSON.stringify(groups), groupId: 23, groupName: 'g', myRole: 'owner', expires_at: '', tags: ['shortcut-library'] } }), { status: 200 }),
      );
      const store = createUserSpaceStore();
      await store.getShortcuts();
      // 不传 groupId —— URL 应该是 /api/v1/kv/shortcut-library 末尾,没 groupId query
      expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/kv/shortcut-library');
      expect(String(fetchMock.mock.calls[0][0])).not.toContain('groupId=');
    });

    it('saves the blob without groupId (backend resolves default)', async () => {
      loggedIn(23);
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }),
      );
      const store = createUserSpaceStore();
      await store.setShortcuts([{ id: 'g1', name: 'X', shortcuts: [], createdAt: 0, updatedAt: 0 }]);
      const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(body.key).toBe('shortcut-library');
      expect(body.tags).toEqual(['shortcut-library']);
      // 不传 groupId —— 后端用 default_group_id
      expect(body.groupId).toBeUndefined();
    });
  });
});
