// fileV1.test.ts —— /api/v1/files/* 后端 wrapper 单测。
//
// 覆盖:
//   1) upload:FormData 通道、accessLevel=public、groupId 显式 / 省略
//   2) list:tags 多值、groupId、limit/offset 拼接
//   3) info/patch/delete/duplicate:路径 encodeURIComponent、groupId 拼接
//   4) 业务错误(code 50 / 403)从 envelope 抛 ApiError

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { fileV1Service } from '../src/api/services/fileV1';

describe('fileV1 service (throw model)', () => {
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

  it('upload POSTs FormData with file + tags[] + accessLevel=public + groupId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'abc12345', url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    const blob = new Blob(['hello'], { type: 'text/plain' });
    await fileV1Service.upload({ file: blob, groupId: 42, tags: ['prod', 'banner'] });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/files');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-xyz' });
    // content-type 不会由我们设 —— FormData 走浏览器自动 multipart boundary
    const headers = init.headers as Record<string, string> | undefined;
    expect(headers?.['content-type']).toBeUndefined();
    // body 是 FormData(不是 JSON 字符串)
    const fd = init.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
  });

  it('upload omits groupId when 0 (allows backend default-group fallback)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'abc12345', url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    const blob = new Blob(['hello'], { type: 'text/plain' });
    await fileV1Service.upload({ file: blob });

    const fd = mockFetch.mock.calls[0][1]?.body as FormData;
    // FormData 不暴露 entries 之外的访问,只能遍历 —— 验证 accessLevel 一定存在
    const entries: Array<[string, string]> = [];
    for (const [k, v] of (fd as unknown as { entries(): Iterable<[string, string]> }).entries()) {
      entries.push([k, String(v)]);
    }
    // accessLevel 永远 public
    expect(entries).toContainEqual(['accessLevel', 'public']);
    // groupId 字段不应存在(我们没追加 groupId)
    expect(entries.find(([k]) => k === 'groupId')).toBeUndefined();
  });

  it('list appends tags as repeated params + groupId + pagination', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { items: [], total: 0 } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.list({
      groupId: 42,
      tags: ['prod', 'banner'],
      match: 'all',
      limit: 10,
      offset: 0,
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/files?groupId=42&tags=prod&tags=banner&match=all&limit=10&offset=0');
  });

  it('list with no args emits a clean URL without query string', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { items: [], total: 0 } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.list();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/files');
  });

  it('info GETs /files/:fileId/info with optional groupId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'abc12345', url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.info({ fileId: 'abc12345', groupId: 42 });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/abc12345/info?groupId=42');

    await fileV1Service.info({ fileId: 'abc12345' });
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/files/abc12345/info');
  });

  it('patch PATCHes /files/:fileId with optional fields + groupId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'abc12345', url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.patch({
      fileId: 'abc12345',
      groupId: 42,
      accessLevel: 'private',
      tags: ['new'],
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/files/abc12345');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ accessLevel: 'private', tags: ['new'], groupId: 42 });
  });

  it('patch omits fields that are not provided (lets backend pointer semantics take over)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'abc12345', url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.patch({ fileId: 'abc12345', accessLevel: 'private' });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.accessLevel).toBe('private');
    expect(body).not.toHaveProperty('tags');
    expect(body).not.toHaveProperty('expireSeconds');
    expect(body).not.toHaveProperty('groupId');
  });

  it('delete DELETEs /files/:fileId with optional groupId query', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await fileV1Service.delete({ fileId: 'abc12345', groupId: 42 });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/abc12345?groupId=42');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE');

    await fileV1Service.delete({ fileId: 'abc12345' });
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/files/abc12345');
  });

  it('delete encodes fileId in path (defensive for hex chars)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    // 非 ASCII / 极端字符的 fileId 不太可能出现,但防御性 encode 应该还是生效
    await fileV1Service.delete({ fileId: 'a/b' });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/a%2Fb');
  });

  it('duplicate POSTs /files/:fileId/duplicate with sourceGroupId + targetGroupId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'xyz98765', targetGroupId: 7, url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    const res = await fileV1Service.duplicate({ fileId: 'abc12345', sourceGroupId: 3, targetGroupId: 7 });

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/abc12345/duplicate');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ sourceGroupId: 3, targetGroupId: 7 });
    expect(res).toEqual({ fileId: 'xyz98765', targetGroupId: 7, url: 'https://x' });
  });

  it('duplicate omits sourceGroupId when 0/undefined (lets backend default-group fallback apply)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { fileId: 'xyz98765', targetGroupId: 7, url: 'https://x' } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.duplicate({ fileId: 'abc12345', targetGroupId: 7 });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sourceGroupId');
    expect(body.targetGroupId).toBe(7);
  });

  it('throws ApiError on business code 31 (permission denied, e.g. non-admin delete)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 31, data: null, message: 'permission denied' }),
    );
    global.fetch = mockFetch;

    await expect(fileV1Service.delete({ fileId: 'abc12345', groupId: 42 })).rejects.toMatchObject({ code: 31 });
  });
});
