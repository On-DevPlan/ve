import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { kvV1Service } from '../src/api/services/kvV1';

describe('kvV1 service (throw model)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setBearerProvider(() => 'jwt-xyz');
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

  it('set POSTs to /api/v1/kv with Bearer header + tags + no visibility', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await kvV1Service.set({
      key: 'shortcuts',
      value: '{}',
      tags: ['prod', 'cache'],
      groupId: 42,
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-xyz' });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ key: 'shortcuts', value: '{}', ttl: 0, tags: ['prod', 'cache'], groupId: 42 });
    expect(body).not.toHaveProperty('visibility');
  });

  it('set defaults tags to [] (replace semantics = clear)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await kvV1Service.set({ key: 'k', value: 'v' });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.tags).toEqual([]);
  });

  it('get GETs /api/v1/kv/:key', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { key: 'shortcuts', value: '{}', visibility: 'private', expires_at: '' },
      }),
    );
    global.fetch = mockFetch;

    const item = await kvV1Service.get({ key: 'shortcuts' });
    expect(item.key).toBe('shortcuts');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv/shortcuts');
  });

  it('get appends groupId query when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { key: 'k', value: 'v', expires_at: '', groupId: 42, groupName: 'g', myRole: 'writer', tags: [] },
      }),
    );
    global.fetch = mockFetch;

    await kvV1Service.get({ key: 'k', groupId: 42 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv/k?groupId=42');
  });

  it('delete sends DELETE with groupId query', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await kvV1Service.delete({ key: 'shortcuts', groupId: 42 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv/shortcuts?groupId=42');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('list with pagination appends query string', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { items: [], total: 0 } }),
    );
    global.fetch = mockFetch;

    await kvV1Service.list({ limit: 10, offset: 20 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv?limit=10&offset=20');
  });

  it('list passes tags as repeated params + match', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { items: [], total: 0 } }),
    );
    global.fetch = mockFetch;

    await kvV1Service.list({ tags: ['prod', 'cache'], match: 'all' });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv?tags=prod&tags=cache&match=all');
  });

  it('tags() GETs the facet endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: [{ tag: 'prod', count: 3 }, { tag: 'cache', count: 1 }] }),
    );
    global.fetch = mockFetch;

    const out = await kvV1Service.tags();
    expect(out).toEqual([{ tag: 'prod', count: 3 }, { tag: 'cache', count: 1 }]);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/kv/tags');
  });

  it('throws ApiError on business code 50 (key not found)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 50, data: null, message: 'key not found' }),
    );
    global.fetch = mockFetch;

    await expect(kvV1Service.get({ key: 'missing' })).rejects.toMatchObject({ code: 50 });
  });
});
