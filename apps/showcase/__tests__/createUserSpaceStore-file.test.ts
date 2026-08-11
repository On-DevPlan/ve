// createUserSpaceStore-file.test.ts —— store 层 5 文件方法单测。
//
// 覆盖:
//   1) uploadFile:requireAuth 守卫 + 透传到 fileV1Service.upload + toFileView 映射
//   2) listFiles:page/pageSize → limit/offset + tags 透传 + 列表项 toFileView
//   3) updateFileMeta:accessLevel + tags 透传 + toFileView 映射
//   4) deleteFile:DELETE 路径 + groupId 透传
//   5) duplicateFile:跨组复制 + sourceGroupId 透传
//
// 关键映射规则验证:
//   - displayName = fileId.slice(0, 8)
//   - isPreviewable = accessLevel==='public' && contentType.startsWith('image/')
//   - fileKind: image/text/other

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
      jwtUser: { id: 8, email: 'a@b.com', username: '', nickname: 'alice', invitationCode: 'X', defaultGroupId: 23 },
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

const FILE_FULL = {
  fileId: 'abc12345deadbeef',
  url: 'https://cdn.example.com/files/abc12345',
  accessLevel: 'public',
  size: 1024,
  contentType: 'image/png',
  groupId: 42,
  groupName: 'g42',
  myRole: 'writer',
  tags: ['prod', 'banner'],
  md5: 'md5hex',
  sha256: 'sha256hex',
  createdAt: '2026-08-01T12:00:00+08:00',
  expireAt: '',
  thumbnails: [
    { level: 'sm', width: 300, height: 200, size: 1234, contentType: 'image/jpeg', url: 'https://cdn.example.com/files/abc12345?level=sm' },
    { level: 'md', width: 800, height: 533, size: 5678, contentType: 'image/jpeg', url: 'https://cdn.example.com/files/abc12345?level=md' },
  ],
};

describe('user-space store file CRUD', () => {
  beforeEach(() => loggedIn());

  it('uploadFile POSTs FormData with groupId + tags + returns FileView with displayName = fileId[:8]', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(FILE_FULL));
    const store = createUserSpaceStore();

    const blob = new Blob(['hello'], { type: 'image/png' });
    const view = await store.uploadFile(42, { file: blob, tags: ['prod', 'banner'] });

    // 路径正确
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    // body 必须是 FormData,不是 JSON 字符串
    expect(init.body).toBeInstanceOf(FormData);
    // content-type 由浏览器自动设,client 不应预设
    const headers = init.headers as Record<string, string> | undefined;
    expect(headers?.['content-type']).toBeUndefined();
    // view 映射
    expect(view.displayName).toBe('abc12345');
    expect(view.isPreviewable).toBe(true);
    expect(view.fileKind).toBe('image');
    expect(view.fileId).toBe('abc12345deadbeef');
    expect(view.tags).toEqual(['prod', 'banner']);
    // 父 url 经过 resolveFileUrl 改写为同源相对路径(后端返回的是绝对 url,
    // 带 /files/ 前缀 → 剥成 /files/abc12345,无 mixed-content 风险)
    expect(view.url).toBe('/files/abc12345');
  });

  it('uploadFile marks isPreviewable=false for non-image contentType even when public', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ ...FILE_FULL, contentType: 'application/pdf' }),
    );
    const store = createUserSpaceStore();

    const view = await store.uploadFile(42, { file: new Blob(['x']), tags: [] });
    expect(view.isPreviewable).toBe(false);
    expect(view.fileKind).toBe('other');
  });

  it('uploadFile marks isPreviewable=false for image but private accessLevel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ ...FILE_FULL, accessLevel: 'private' }),
    );
    const store = createUserSpaceStore();

    const view = await store.uploadFile(42, { file: new Blob(['x']), tags: [] });
    expect(view.isPreviewable).toBe(false);
    expect(view.fileKind).toBe('image');
  });

  it('listFiles translates page/pageSize → limit/offset + groupId + tags + maps items to FileView', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({
        items: [
          FILE_FULL,
          { ...FILE_FULL, fileId: 'fff99999cafe', contentType: 'text/plain', accessLevel: 'private' },
        ],
        total: 2,
      }),
    );
    const store = createUserSpaceStore();

    const result = await store.listFiles(42, { page: 2, pageSize: 10, tags: ['prod'] });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files?groupId=42&tags=prod&limit=10&offset=10');
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    // 映射校验
    expect(result.items[0].displayName).toBe('abc12345');
    expect(result.items[0].isPreviewable).toBe(true);
    expect(result.items[0].fileKind).toBe('image');
    // 第二项:text 类型 + private → isPreviewable=false + fileKind='text'
    expect(result.items[1].displayName).toBe('fff99999');
    expect(result.items[1].isPreviewable).toBe(false);
    expect(result.items[1].fileKind).toBe('text');
  });

  it('updateFileMeta PATCHes /files/:fileId with accessLevel + tags + groupId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ ...FILE_FULL, accessLevel: 'private' }),
    );
    const store = createUserSpaceStore();

    const view = await store.updateFileMeta(42, 'abc12345deadbeef', { accessLevel: 'private', tags: ['new'] });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files/abc12345deadbeef');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ accessLevel: 'private', tags: ['new'], groupId: 42 });
    // 映射
    expect(view.accessLevel).toBe('private');
    expect(view.isPreviewable).toBe(false);
  });

  it('deleteFile DELETEs /files/:fileId with groupId query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(null));
    const store = createUserSpaceStore();

    await store.deleteFile(42, 'abc12345deadbeef');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files/abc12345deadbeef?groupId=42');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('duplicateFile POSTs /files/:fileId/duplicate with sourceGroupId + targetGroupId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ fileId: 'xyz98765deadbeef', targetGroupId: 7, url: 'https://cdn.example.com/xyz98765' }),
    );
    const store = createUserSpaceStore();

    const res = await store.duplicateFile({ fileId: 'abc12345deadbeef', sourceGroupId: 3, targetGroupId: 7 });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files/abc12345deadbeef/duplicate');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ sourceGroupId: 3, targetGroupId: 7 });
    expect(res).toEqual({ fileId: 'xyz98765deadbeef', targetGroupId: 7, url: 'https://cdn.example.com/xyz98765' });
  });

  it('throws when not logged in (consistent with KV CRUD)', async () => {
    const store = createUserSpaceStore();
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });

    await expect(store.uploadFile(42, { file: new Blob(['x']) })).rejects.toThrow('not logged in');
    await expect(store.listFiles(42, { page: 1, pageSize: 10 })).rejects.toThrow('not logged in');
    await expect(store.updateFileMeta(42, 'abc12345', { accessLevel: 'private' })).rejects.toThrow('not logged in');
    await expect(store.deleteFile(42, 'abc12345')).rejects.toThrow('not logged in');
    await expect(store.duplicateFile({ fileId: 'abc12345', sourceGroupId: 3, targetGroupId: 7 })).rejects.toThrow('not logged in');
  });

  it('propagates backend errors (e.g. 403 permission denied) so caller can surface toast', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 31, data: null, message: 'permission denied' }), { status: 200 }),
    );
    const store = createUserSpaceStore();

    await expect(store.deleteFile(42, 'abc12345')).rejects.toMatchObject({ code: 31 });
  });

  it('listFiles preserves thumbnails in FileView', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ items: [FILE_FULL], total: 1 }),
    );
    const store = createUserSpaceStore();
    const result = await store.listFiles(42, { page: 1, pageSize: 10 });
    // Each thumbnail's metadata passes through; only `url` is rewritten
    // by resolveFileUrl (so we check shape rather than full deep-equal).
    expect(result.items[0].thumbnails).toHaveLength(FILE_FULL.thumbnails.length);
    expect(result.items[0].thumbnails?.[0].level).toBe('sm');
    expect(result.items[0].thumbnails?.[0].width).toBe(300);
    expect(result.items[0].thumbnails?.[0].height).toBe(200);
    expect(result.items[0].thumbnails?.[0].contentType).toBe('image/jpeg');
    expect(result.items[0].thumbnails?.[0].url).toMatch(/level=sm/);
  });

  it('listFiles routes each thumbnail url through resolveFileUrl (strip backend origin)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody({ items: [FILE_FULL], total: 1 }));
    const store = createUserSpaceStore();
    const result = await store.listFiles(42, { page: 1, pageSize: 10 });
    for (const t of result.items[0].thumbnails ?? []) {
      expect(t.url).not.toContain('cdn.example.com');
      expect(t.url).toMatch(/level=/);
    }
  });

  it('listFiles tolerates thumbnails undefined (old files / non-image)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { thumbnails: _omit, ...noThumbs } = FILE_FULL;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okBody({ items: [noThumbs], total: 1 }),
    );
    const store = createUserSpaceStore();
    const result = await store.listFiles(42, { page: 1, pageSize: 10 });
    expect(result.items[0].thumbnails).toBeUndefined();
  });
});
