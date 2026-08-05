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

describe('createShortcutStore', () => {
  beforeEach(() => loggedOut());

  it('returns an empty list when logged out', async () => {
    await expect(createShortcutStore().load()).resolves.toEqual([]);
  });

  it('loads and parses a logged-in KV value', async () => {
    loggedIn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0, data: { key: 'shortcuts', value: JSON.stringify([{ id: 'g1', name: 'VSCode', shortcuts: [], createdAt: 0, updatedAt: 0 }],), visibility: 'private', expires_at: '' } }), { status: 200 }));
    await expect(createShortcutStore().load()).resolves.toMatchObject([{ name: 'VSCode' }]);
  });

  it('returns an empty list when KV key is missing', async () => {
    loggedIn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 50, data: null }), { status: 200 }),
    );
    await expect(createShortcutStore().load()).resolves.toEqual([]);
  });

  it('throws when saving while logged out', async () => {
    await expect(createShortcutStore().save([])).rejects.toThrow('not logged in');
  });

  it('saves private groups while logged in, tagged shortcut-library', async () => {
    loggedIn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }));
    await createShortcutStore().save([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({ body: expect.stringContaining('"visibility":"private"') }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/kv', expect.objectContaining({ body: expect.stringContaining('"tags":["shortcut-library"]') }));
  });

  it('imports appended and new groups with stats', async () => {
    loggedIn();
    const existing = [{ id: 'g1', name: 'VSCode', shortcuts: [], createdAt: 0, updatedAt: 0 }];
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { key: 'shortcuts', value: JSON.stringify(existing), visibility: 'private', expires_at: '' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }));
    await expect(createShortcutStore().importGroups({ groups: [{ name: 'vscode', shortcuts: [{ combo: [], description: 'x' }] }, { name: 'Browser', shortcuts: [] }], errors: ['bad'] })).resolves.toMatchObject({ groupsAdded: 1, groupsAppended: 1, shortcutsAdded: 1, errors: ['bad'] });
  });
});
