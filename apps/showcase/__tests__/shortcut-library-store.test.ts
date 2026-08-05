import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtAuth } from '../src/api/http/auth-store';
import { createShortcutStore } from '../src/api/components/shortcut-library/createShortcutStore';

const originalState = jwtAuth.state;

function loggedIn(): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({ ...originalState, token: 'jwt-abc' }),
  });
}

function loggedOut(): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({ ...originalState, token: null }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
});

/** 自有后端统一信封响应(code=0 成功)。 */
function ok(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
}

/** 业务错误响应(如 key not found → code 50)。 */
function bizErr(code: number): Response {
  return new Response(JSON.stringify({ code, data: null }), { status: 200 });
}

describe('createShortcutStore (per-item CRUD)', () => {
  beforeEach(() => loggedOut());

  it('returns an empty list when logged out', async () => {
    await expect(createShortcutStore().pull()).resolves.toEqual([]);
  });

  it('throws when writing while logged out', async () => {
    const store = createShortcutStore();
    const g = { id: 'g', name: 'x', shortcuts: [], createdAt: 0, updatedAt: 0 };
    await expect(store.createGroup(g, 0)).rejects.toThrow('not logged in');
    await expect(store.updateShortcut('g', { id: 's', combo: [], description: 'x', createdAt: 0 }, 0)).rejects.toThrow('not logged in');
    await expect(store.deleteShortcut('s')).rejects.toThrow('not logged in');
  });

  it('reconstructs groups from tagged KV items on pull', async () => {
    loggedIn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      ok({
        items: [
          { key: 'sl-group-g1', value: JSON.stringify({ id: 'g1', name: 'VSCode', order: 0, createdAt: 1, updatedAt: 2 }) },
          { key: 'sl-group-g2', value: JSON.stringify({ id: 'g2', name: 'Chrome', order: 1, createdAt: 3, updatedAt: 4 }) },
          {
            key: 'sl-shortcut-s1',
            value: JSON.stringify({ id: 's1', groupId: 'g1', order: 0, combo: [{ code: 'KeyR', label: 'R', isModifier: false }], description: 'run', createdAt: 5, updatedAt: 6 }),
          },
          // 孤儿 shortcut(groupId 无对应 group)→ 应被丢弃
          {
            key: 'sl-shortcut-orphan',
            value: JSON.stringify({ id: 'orphan', groupId: 'nope', order: 0, combo: [], description: 'lost', createdAt: 5, updatedAt: 6 }),
          },
        ],
        total: 4,
      }),
    );

    const groups = await createShortcutStore().pull();

    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('VSCode');
    expect(groups[0].shortcuts).toHaveLength(1);
    expect(groups[0].shortcuts[0].description).toBe('run');
    expect(groups[1].name).toBe('Chrome');
    expect(groups[1].shortcuts).toHaveLength(0);
    // 拉取 = GET /kv?tags=shortcut-library
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('tags=shortcut-library'),
      expect.anything(),
    );
  });

  it('returns an empty list when no keys exist', async () => {
    loggedIn();
    // list 空 + 旧 blob 也不存在(not found) → 空库
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ items: [], total: 0 }))
      .mockResolvedValueOnce(bizErr(50));
    await expect(createShortcutStore().pull()).resolves.toEqual([]);
  });

  it('creates a group key tagged shortcut-library on createGroup', async () => {
    loggedIn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(null));
    const g = { id: 'g1', name: 'VSCode', shortcuts: [], createdAt: 1, updatedAt: 2 };
    await createShortcutStore().createGroup(g, 0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/kv',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('sl-group-g1'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/kv',
      expect.objectContaining({
        body: expect.stringContaining('"tags":["shortcut-library"]'),
      }),
    );
  });

  it('deletes the shortcut key on deleteShortcut', async () => {
    loggedIn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(null));
    await createShortcutStore().deleteShortcut('s1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/kv/sl-shortcut-s1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('migrates a legacy shortcuts blob to per-item keys on pull', async () => {
    loggedIn();
    const legacyGroups = [
      {
        id: 'g1',
        name: 'VSCode',
        shortcuts: [
          { id: 's1', combo: [{ code: 'KeyR', label: 'R', isModifier: false }], description: 'run', createdAt: 5 },
        ],
        createdAt: 1,
        updatedAt: 2,
      },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ items: [], total: 0 }))                                  // list → 无新 key
      .mockResolvedValueOnce(ok({ key: 'shortcuts', value: JSON.stringify(legacyGroups) })) // get 旧 blob
      .mockResolvedValueOnce(ok(null))                                                      // set sl-group-g1
      .mockResolvedValueOnce(ok(null))                                                      // set sl-shortcut-s1
      .mockResolvedValueOnce(ok(null));                                                     // delete 旧 key

    const groups = await createShortcutStore().pull();

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('VSCode');
    expect(groups[0].shortcuts[0].description).toBe('run');
    // 迁移:逐条写新 key + 删旧 key
    const calls = fetchMock.mock.calls;
    expect(calls.some((c) => c[0] === '/api/v1/kv' && String((c[1] as RequestInit).body).includes('sl-group-g1'))).toBe(true);
    expect(calls.some((c) => c[0] === '/api/v1/kv' && String((c[1] as RequestInit).body).includes('sl-shortcut-s1'))).toBe(true);
    expect(calls.some((c) => c[0] === '/api/v1/kv/shortcuts' && (c[1] as RequestInit).method === 'DELETE')).toBe(true);
  });
});
