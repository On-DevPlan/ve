// chunked-upload.test.ts —— 分片上传编排器单测(vi.spyOn mock fileV1Service)。
//
// 覆盖(py 模拟器四流程的 web 版):
//   1) new:hash 遍算 manifest(对拍 node:crypto)→ init → 全片 PUT → complete
//   2) instant:秒传命中 0 次 PUT / 0 次 complete
//   3) resume:跳过 receivedChunks,只 PUT 缺片
//   4) 单片失败退避重试后成功
//   5) signal abort:软取消 —— 抛 AbortError,不调 complete / abortUpload
//   6) store.uploadFileChunked:auth 闸门 + FileInfo → FileView 映射
//
// chunkSize 注入 8 字节小片驱动多片路径(免造 16MB 文件);生产默认 8MB
// 在 fileV1.initUpload 的服务端校验(64KB~64MB)里,测试 mock 掉了服务端。

// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileV1Service } from '../src/api/services/fileV1';
import {
  CHUNKED_UPLOAD_MIN_SIZE,
  DEFAULT_CHUNK_SIZE,
  uploadFileInChunks,
} from '../src/api/components/user-space/chunked-upload';
import { jwtAuth } from '../src/api/http/auth-store';
import { createUserSpaceStore } from '../src/api/components/user-space';

function nodeSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** 20 字节文件 @chunkSize=8 → 3 片(8+8+4)。 */
const BYTES = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
const CHUNK_SIZE = 8;
const CHUNK_COUNT = 3;

function demoFile(): File {
  return new File([BYTES], 'demo.bin', { type: 'application/octet-stream' });
}

function chunkSlice(i: number): Uint8Array {
  return BYTES.subarray(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, BYTES.length));
}

const FILE_INFO = {
  fileId: 'abc12345deadbeef',
  url: 'https://cdn.example.com/files/abc12345',
  accessLevel: 'public' as const,
  size: BYTES.length,
  contentType: 'application/octet-stream',
  groupId: 42,
  groupName: 'g42',
  myRole: 'writer' as const,
  tags: ['demo'],
  md5: '',
  sha256: nodeSha256(BYTES),
  createdAt: '2026-08-16T12:00:00+08:00',
  expireAt: '',
};

function initResp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'new',
    uploadId: 'u1',
    chunkSize: CHUNK_SIZE,
    chunkCount: CHUNK_COUNT,
    receivedChunks: [],
    uploadedBytes: 0,
    fileSize: BYTES.length,
    progress: 0,
    ...overrides,
  };
}

/** spy 快照:拦截 5 个 service 方法(不碰 global.fetch,编排器单测边界就在 service)。 */
function mockService() {
  const spies = {
    initUpload: vi.spyOn(fileV1Service, 'initUpload'),
    putChunk: vi.spyOn(fileV1Service, 'putChunk'),
    getUploadProgress: vi.spyOn(fileV1Service, 'getUploadProgress'),
    completeUpload: vi.spyOn(fileV1Service, 'completeUpload'),
    abortUpload: vi.spyOn(fileV1Service, 'abortUpload'),
  };
  spies.putChunk.mockResolvedValue(undefined);
  spies.completeUpload.mockResolvedValue({ file: FILE_INFO });
  return spies;
}

const putIndices = (spies: ReturnType<typeof mockService>): number[] =>
  spies.putChunk.mock.calls.map((c) => c[0].index).sort((a, b) => a - b);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadFileInChunks — new(全新会话全传)', () => {
  it('hash 遍算 manifest → init → 全片 PUT → complete,进度事件覆盖三阶段', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp() as never);

    const events: Array<{ phase: string; ratio: number }> = [];
    const res = await uploadFileInChunks(
      { file: demoFile(), groupId: 42, tags: ['demo'] },
      { onProgress: (p) => events.push({ phase: p.phase, ratio: p.ratio }), chunkSize: CHUNK_SIZE },
    );

    // init manifest 对拍 node:crypto(整文件 + 每片)
    const initArgs = spies.initUpload.mock.calls[0][0];
    expect(initArgs.fileSha256).toBe(nodeSha256(BYTES));
    expect(initArgs.chunkHashes).toEqual([0, 1, 2].map((i) => nodeSha256(chunkSlice(i))));
    expect(initArgs.chunkSize).toBe(CHUNK_SIZE);
    expect(initArgs.originalName).toBe('demo.bin');
    expect(initArgs.groupId).toBe(42);

    // 全片 PUT(乱序并发,只断言集合)+ complete 收尾
    expect(putIndices(spies)).toEqual([0, 1, 2]);
    expect(spies.completeUpload).toHaveBeenCalledWith('u1');

    expect(res.instant).toBe(false);
    expect(res.uploadedChunks).toBe(3);
    expect(res.skippedChunks).toBe(0);
    expect(res.file.fileId).toBe('abc12345deadbeef');

    // 进度:hashing×3(ratio 递增到 1)→ uploading(到 1)→ completing
    const phases = events.map((e) => e.phase);
    expect(phases.filter((p) => p === 'hashing')).toHaveLength(3);
    expect(phases[phases.length - 1]).toBe('completing');
    const lastUploading = [...events].reverse().find((e) => e.phase === 'uploading');
    expect(lastUploading?.ratio).toBe(1);
  });

  it('单片 PUT 的 data 是正确的切片 Blob', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp() as never);

    await uploadFileInChunks(
      { file: demoFile(), groupId: 42 },
      { chunkSize: CHUNK_SIZE },
    );

    const c0 = spies.putChunk.mock.calls.find((c) => c[0].index === 0)![0];
    expect(c0.uploadId).toBe('u1');
    const text = await (c0.data as Blob).text();
    expect(text).toBe(String.fromCharCode(...chunkSlice(0)));
  });
});

describe('uploadFileInChunks — instant(秒传)', () => {
  it('init 命中即返回:0 次 PUT、0 次 complete', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp({ status: 'instant', uploadId: '', file: FILE_INFO }) as never);

    const events: Array<{ phase: string; instant?: boolean }> = [];
    const res = await uploadFileInChunks(
      { file: demoFile(), groupId: 42 },
      { onProgress: (p) => events.push({ phase: p.phase, instant: p.instant }), chunkSize: CHUNK_SIZE },
    );

    expect(spies.putChunk).not.toHaveBeenCalled();
    expect(spies.completeUpload).not.toHaveBeenCalled();
    expect(res.instant).toBe(true);
    expect(res.uploadedChunks).toBe(0);
    expect(events.some((e) => e.phase === 'uploading' && e.instant === true)).toBe(true);
  });
});

describe('uploadFileInChunks — resume(断点续传)', () => {
  it('跳过 receivedChunks,只 PUT 缺片,skippedChunks 计数', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(
      initResp({ status: 'resume', receivedChunks: [0, 2] }) as never,
    );

    const res = await uploadFileInChunks(
      { file: demoFile(), groupId: 42 },
      { chunkSize: CHUNK_SIZE },
    );

    expect(putIndices(spies)).toEqual([1]);
    expect(res.skippedChunks).toBe(2);
    expect(res.uploadedChunks).toBe(1);
    expect(spies.completeUpload).toHaveBeenCalledWith('u1');
  });

  it('resume 基线进度先回报(receivedChunks 含跳过片)', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp({ status: 'resume', receivedChunks: [0] }) as never);

    const uploading: number[] = [];
    await uploadFileInChunks(
      { file: demoFile(), groupId: 42 },
      { onProgress: (p) => { if (p.phase === 'uploading') uploading.push(p.receivedChunks ?? -1); }, chunkSize: CHUNK_SIZE },
    );

    // 第一个 uploading 事件即基线 1(跳过片 0),之后 2、3
    expect(uploading).toEqual([1, 2, 3]);
  });
});

describe('uploadFileInChunks — 重试与取消', () => {
  it('单片失败退避重试后成功(服务端片校验幂等)', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp() as never);
    let calls = 0;
    spies.putChunk.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new (await import('../src/api/services/base')).ApiError(51, 'chunk sha256 mismatch');
    });

    const res = await uploadFileInChunks(
      { file: demoFile(), groupId: 42 },
      { chunkSize: CHUNK_SIZE },
    );

    expect(calls).toBe(CHUNK_COUNT + 1); // 1 次失败 + 3 片
    expect(res.file.fileId).toBe('abc12345deadbeef');
  }, 10_000);

  it('signal abort:抛 AbortError,软取消不碰 complete / abortUpload', async () => {
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp() as never);
    const controller = new AbortController();
    spies.putChunk.mockImplementation(async () => {
      controller.abort();
      const e = new Error('The user aborted a request.');
      e.name = 'AbortError';
      throw e;
    });

    await expect(
      uploadFileInChunks(
        { file: demoFile(), groupId: 42 },
        { signal: controller.signal, chunkSize: CHUNK_SIZE },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    // 软取消:会话留在服务端,等用户重传同文件 resume;不调 complete/abort
    expect(spies.completeUpload).not.toHaveBeenCalled();
    expect(spies.abortUpload).not.toHaveBeenCalled();
  });

  it('hash 遍中 abort:立即抛,不发 init', async () => {
    const spies = mockService();
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadFileInChunks(
        { file: demoFile(), groupId: 42 },
        { signal: controller.signal, chunkSize: CHUNK_SIZE },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(spies.initUpload).not.toHaveBeenCalled();
  });
});

describe('store.uploadFileChunked — auth 闸门 + FileView 映射', () => {
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
    Object.defineProperty(jwtAuth, 'state', { configurable: true, get: () => originalState });
  });

  it('未登录直接抛(不碰 service)', async () => {
    const spies = mockService();
    const store = createUserSpaceStore();
    await expect(store.uploadFileChunked(42, { file: demoFile() }, { chunkSize: CHUNK_SIZE })).rejects.toThrow(
      'not logged in',
    );
    expect(spies.initUpload).not.toHaveBeenCalled();
  });

  it('登录后映射 FileView(url 走 resolveFileUrl 同源改写)', async () => {
    loggedIn();
    const spies = mockService();
    spies.initUpload.mockResolvedValue(initResp() as never);

    const store = createUserSpaceStore();
    const res = await store.uploadFileChunked(42, { file: demoFile(), tags: ['demo'] }, { chunkSize: CHUNK_SIZE });

    expect(res.file.fileId).toBe('abc12345deadbeef');
    expect(res.file.url).toBe('/files/abc12345');
    expect(res.file.displayName).toBe('abc12345');
    expect(res.instant).toBe(false);
  });
});

describe('常量', () => {
  it('阈值 10MB / 默认片 8MB(与后端契约 64KB~64MB、>10MB 建议一致)', () => {
    expect(CHUNKED_UPLOAD_MIN_SIZE).toBe(10 * 1024 * 1024);
    expect(DEFAULT_CHUNK_SIZE).toBe(8 * 1024 * 1024);
  });
});
