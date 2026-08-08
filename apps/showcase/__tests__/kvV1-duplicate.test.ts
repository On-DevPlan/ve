// kvV1 client 层 duplicate 单测。后端 POST /api/v1/kv/:key/duplicate 端点已
// 存在(SPEC 钉法),前端 client 只承担 URL/body 拼装,这里 stub fetch 校验
// 形态 + Bearer 注入 + groupId 契约(源/目标都显式传,0/不传省略)。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { kvV1Service } from '../src/api/services/kvV1';

describe('kvV1 duplicate', () => {
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

  it('POSTs /kv/:key/duplicate with sourceGroupId + targetGroupId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { newKey: 'api_url', targetGroupId: 7 } }),
    );
    global.fetch = mockFetch;

    const res = await kvV1Service.duplicate({ key: 'api_url', sourceGroupId: 3, targetGroupId: 7 });

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/kv/api_url/duplicate');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-xyz' });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ sourceGroupId: 3, targetGroupId: 7 });
    expect(res).toEqual({ newKey: 'api_url', targetGroupId: 7 });
  });

  it('encodes key with special characters in the path', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { newKey: 'weird key copy', targetGroupId: 7 } }),
    );
    global.fetch = mockFetch;

    await kvV1Service.duplicate({ key: 'weird key/with slash', sourceGroupId: 3, targetGroupId: 7 });

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/kv/weird%20key%2Fwith%20slash/duplicate');
  });

  it('omits sourceGroupId when 0 or undefined (lets backend default-group fallback kick in)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { newKey: 'k', targetGroupId: 7 } }),
    );
    global.fetch = mockFetch;

    await kvV1Service.duplicate({ key: 'k', targetGroupId: 7 });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sourceGroupId');
    expect(body.targetGroupId).toBe(7);
  });

  it('returns newKey from backend (with _copy suffix on conflict)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { newKey: 'api_url_copy', targetGroupId: 7 } }),
    );
    global.fetch = mockFetch;

    const res = await kvV1Service.duplicate({ key: 'api_url', sourceGroupId: 3, targetGroupId: 7 });

    expect(res.newKey).toBe('api_url_copy');
    expect(res.targetGroupId).toBe(7);
  });

  it('throws ApiError on backend business error (e.g. permission denied)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 31, data: null, message: 'permission denied' }),
    );
    global.fetch = mockFetch;

    await expect(
      kvV1Service.duplicate({ key: 'k', sourceGroupId: 3, targetGroupId: 7 }),
    ).rejects.toMatchObject({ code: 31 });
  });
});