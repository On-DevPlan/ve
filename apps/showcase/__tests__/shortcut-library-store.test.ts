import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtAuth } from '../src/api/http/auth-store';
import { createShortcutStore } from '../src/api/components/shortcut-library/createShortcutStore';

const originalState = jwtAuth.state;

function loggedIn(defaultGroupId = 42): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({
      ...originalState,
      token: 'jwt-abc',
      jwtAuthState: 'logged-in',
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'a', invitationCode: 'X', defaultGroupId },
    }),
  });
}

function loggedOut(): void {
  Object.defineProperty(jwtAuth, 'state', {
    configurable: true,
    get: () => ({ ...originalState, token: null, jwtAuthState: 'logged-out', jwtUser: null }),
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

describe('createShortcutStore (delegates to user-space getShortcuts/setShortcuts)', () => {
  beforeEach(() => loggedOut());

  it('returns an empty list when logged out', async () => {
    await expect(createShortcutStore().load()).resolves.toEqual([]);
  });

  it('throws when saving while logged out', async () => {
    await expect(createShortcutStore().save([])).rejects.toThrow('not logged in');
  });

  it('loads the entire shortcuts blob without groupId (backend resolves default)', async () => {
    loggedIn(42);
    const groups = [
      { id: 'g1', name: 'VSCode', shortcuts: [
        { id: 's1', combo: [{ code: 'KeyR', label: 'R', isModifier: false }], description: 'run', createdAt: 1 },
      ], createdAt: 0, updatedAt: 0 },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      ok({ key: 'shortcut-library', value: JSON.stringify(groups), groupId: 42, groupName: 'personal', myRole: 'owner', expires_at: '' }),
    );
    const result = await createShortcutStore().load();
    expect(result).toEqual(groups);
    // load = GET /api/v1/kv/shortcut-library (不传 groupId,后端走 default)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/kv/shortcut-library'),
      expect.anything(),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('groupId=');
  });

  it('returns an empty list when the shortcuts KV is missing (code 50)', async () => {
    loggedIn(42);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(bizErr(50));
    await expect(createShortcutStore().load()).resolves.toEqual([]);
  });

  it('saves the entire shortcuts blob without groupId (backend resolves default)', async () => {
    loggedIn(42);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(null));
    const groups = [{ id: 'g1', name: 'VSCode', shortcuts: [], createdAt: 0, updatedAt: 0 }];
    await createShortcutStore().save(groups);
    // save = POST /api/v1/kv with key='shortcut-library', tags=['shortcut-library'],
    // 不传 groupId(后端用 caller 的 default_group_id)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/kv',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const callArgs = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(callArgs?.body));
    expect(body.key).toBe('shortcut-library');
    expect(body.tags).toEqual(['shortcut-library']);
    expect(body.groupId).toBeUndefined();
    expect(JSON.parse(body.value)).toEqual(groups);
  });
});
