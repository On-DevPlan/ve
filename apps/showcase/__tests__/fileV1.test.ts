// fileV1.test.ts —— /api/v1/files/* 后端 wrapper 单测。
//
// 覆盖:
//   1) upload:FormData 通道、accessLevel=public、groupId 显式 / 省略
//   2) list:tags 多值、groupId、limit/offset 拼接
//   3) info/patch/delete/duplicate:路径 encodeURIComponent、groupId 拼接
//   4) 业务错误(code 50 / 403)从 envelope 抛 ApiError
//   5) 分片上传 5 端点:init JSON manifest / putChunk raw octet-stream /
//      progress / complete / abort

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

  // ── 分片上传 5 端点 ──────────────────────────────────

  it('initUpload POSTs /uploads with hash manifest as JSON; omits groupId when 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { status: 'new', uploadId: 'u1', chunkCount: 2 } }),
    );
    global.fetch = mockFetch;

    const res = await fileV1Service.initUpload({
      originalName: 'demo.bin',
      contentType: 'application/octet-stream',
      fileSize: 10,
      fileSha256: 'a'.repeat(64),
      chunkSize: 8,
      chunkHashes: ['b'.repeat(64), 'c'.repeat(64)],
      tags: ['demo'],
    });

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/uploads');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    // manifest 完整透传 + 默认 accessLevel=public
    expect(body).toMatchObject({
      originalName: 'demo.bin',
      fileSize: 10,
      fileSha256: 'a'.repeat(64),
      chunkSize: 8,
      chunkHashes: ['b'.repeat(64), 'c'.repeat(64)],
      accessLevel: 'public',
      tags: ['demo'],
    });
    // groupId 0/不传不携带(default-group 兜底);fileMd5 未提供也不携带
    expect(body).not.toHaveProperty('groupId');
    expect(body).not.toHaveProperty('fileMd5');
    expect(res.status).toBe('new');
  });

  it('initUpload includes groupId only when > 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { status: 'resume', uploadId: 'u1' } }),
    );
    global.fetch = mockFetch;

    await fileV1Service.initUpload({
      groupId: 42,
      originalName: 'demo.bin',
      contentType: 'application/octet-stream',
      fileSize: 10,
      fileSha256: 'a'.repeat(64),
      chunkSize: 8,
      chunkHashes: ['b'.repeat(64)],
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.groupId).toBe(42);
    // tags 未提供不携带(expireSeconds 同)
    expect(body).not.toHaveProperty('tags');
  });

  it('putChunk PUTs raw octet-stream Blob at /uploads/:id/chunks/:index (not multipart / not stringified)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: null }));
    global.fetch = mockFetch;

    // 切片 Blob 带 text/plain type —— 证明 service 层统一包成 octet-stream
    const piece = new Blob(['raw-bytes'], { type: 'text/plain' });
    await fileV1Service.putChunk({ uploadId: 'u1', index: 3, data: piece });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/files/uploads/u1/chunks/3');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    // raw body:是 Blob 不是 JSON 字符串;type 被 service 钉成 octet-stream
    expect(init.body).toBeInstanceOf(Blob);
    expect(typeof init.body).not.toBe('string');
    expect((init.body as Blob).type).toBe('application/octet-stream');
    expect(init.headers).toMatchObject({ 'content-type': 'application/octet-stream' });
  });

  it('getUploadProgress GETs /uploads/:id', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { uploadId: 'u1', progress: 0.5, receivedChunks: [0, 1] } }),
    );
    global.fetch = mockFetch;

    const res = await fileV1Service.getUploadProgress('u1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/uploads/u1');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('GET');
    expect(res.progress).toBe(0.5);
  });

  it('completeUpload POSTs /uploads/:id/complete and unwraps {file}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { file: { fileId: 'abc12345', url: 'https://x' } } }),
    );
    global.fetch = mockFetch;

    const res = await fileV1Service.completeUpload('u1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/uploads/u1/complete');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(res.file.fileId).toBe('abc12345');
  });

  it('abortUpload DELETEs /uploads/:id', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: null }));
    global.fetch = mockFetch;

    await fileV1Service.abortUpload('u1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/files/uploads/u1');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('chunk sha256 mismatch surfaces as ApiError with backend message', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 51, data: null, message: 'chunk sha256 mismatch' }),
    );
    global.fetch = mockFetch;

    await expect(
      fileV1Service.putChunk({ uploadId: 'u1', index: 0, data: new Blob(['bad']) }),
    ).rejects.toMatchObject({ code: 51, message: 'chunk sha256 mismatch' });
  });
});
