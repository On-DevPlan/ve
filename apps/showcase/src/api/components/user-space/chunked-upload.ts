// api/components/user-space/chunked-upload.ts —— 分片上传编排器(套件核心)。
//
// 移植 dev_ctr_hello .tool/upload-client/scripts/upload_client.py 的客户端流程:
//   ① hash 遍:逐片读文件 → 每片 sha256 + 整文件流式 sha256(一遍算完)
//   ② init:instant(同组同 sha256 秒传)/ resume(断点续传,跳过 receivedChunks)/ new
//   ③ 3 并发逐片 PUT(后端支持乱序,服务端逐片 sha256 校验)
//   ④ complete 合并收尾
// 内存安全:不整读文件,逐片 file.slice().arrayBuffer();上传阶段按需重切,
// 不缓存全部分片(并发 3 × 8MB 常驻即够)。
//
// 取消语义(软取消):signal 触发即停,**不调 abortUpload** —— 会话留在服务端
// uploading,重新上传同文件 init 即 resume 续传;TTL(fileServer.uploadSessionTtlHours,
// 默认 24h)GC 兜底清理。complete 失败(缺片/整体校验不符)也不自动重试:
// 会话服务端保留,用户重传同文件 → resume 天然恢复。
//
// 进度真源是本地计数(init 响应已带 resume 基线),不做逐片 GET 轮询 ——
// py 模拟器每片拉一次 progress 只是演示用途,web 端会双倍请求。
//
// 目录内部相对路径 import(不走 '@api',self-cycle 规则见 createUserSpaceStore.ts 头注释)。

import { fileV1Service } from '../../services';
import type { FileInfo } from '../../services/fileV1/types';
import { Sha256 } from './sha256';
import type { FileUploadProgress } from './types';

/** 大于此值走分片(后端 [[chunked-upload]] 建议 >10MB;小文件单发直传更省往返) */
export const CHUNKED_UPLOAD_MIN_SIZE = 10 * 1024 * 1024;
/** 默认片大小(服务端约束 64KB~64MB,init 校验越界拒) */
export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
/** 并发 PUT 数(后端分片可乱序) */
const CHUNK_CONCURRENCY = 3;
/** 单片失败重试次数(退避 500ms × attempt;AbortError 不重试) */
const CHUNK_RETRY_LIMIT = 2;
const RETRY_BASE_DELAY_MS = 500;

export interface UploadFileInChunksArgs {
  file: File;
  groupId: number;
  tags?: string[];
}

export interface UploadFileInChunksOpts {
  onProgress?: (p: FileUploadProgress) => void;
  signal?: AbortSignal;
  /** 覆盖片大小(仍须在服务端 64KB~64MB 约束内);测试注入小片驱动多片路径用 */
  chunkSize?: number;
}

/** service 层结果(FileInfo 域);store 层负责映射成 FileView。 */
export interface UploadFileInChunksResult {
  file: FileInfo;
  instant: boolean;
  /** 本次客户端实传片数 */
  uploadedChunks: number;
  /** resume 跳过的片数 */
  skippedChunks: number;
}

// ── abort 小工具(fetch 的 DOMException 与 Node/jdom 的 Error 统一按 name 识别) ──

function abortError(): Error {
  const e = new Error('upload aborted');
  e.name = 'AbortError';
  return e;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** 可中断 sleep:退避等待中被 abort 立即抛。 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(t);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function uploadFileInChunks(
  args: UploadFileInChunksArgs,
  opts: UploadFileInChunksOpts = {},
): Promise<UploadFileInChunksResult> {
  const { file, groupId, tags } = args;
  const { onProgress, signal } = opts;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkCount = Math.max(1, Math.ceil(file.size / chunkSize));

  // ── ① hash 遍:每片 sha256 + 整文件流式 sha256,同一遍读盘算完 ──
  const chunkHashes: string[] = [];
  const fileHash = new Sha256();
  for (let i = 0; i < chunkCount; i++) {
    throwIfAborted(signal);
    const start = i * chunkSize;
    const buf = new Uint8Array(await file.slice(start, Math.min(start + chunkSize, file.size)).arrayBuffer());
    const pieceHash = new Sha256();
    pieceHash.update(buf);
    chunkHashes.push(pieceHash.digestHex());
    fileHash.update(buf);
    onProgress?.({ phase: 'hashing', ratio: (i + 1) / chunkCount, fileSize: file.size });
  }
  const fileSha256 = fileHash.digestHex();

  // ── ② init:秒传预检 + 续传定位 + 建会话 ──
  const init = await fileV1Service.initUpload({
    groupId,
    originalName: file.name || 'file',
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
    fileSha256,
    chunkSize,
    chunkHashes,
    accessLevel: 'public',
    tags: tags ?? [],
    expireSeconds: 0,
  });

  if (init.status === 'instant' && init.file) {
    onProgress?.({ phase: 'uploading', ratio: 1, fileSize: file.size, instant: true });
    return { file: init.file, instant: true, uploadedChunks: 0, skippedChunks: 0 };
  }

  const uploadId = init.uploadId;
  const received = new Set(init.receivedChunks ?? []);
  const skippedChunks = received.size;
  const resumed = init.status === 'resume';

  const report = (done: number): void => {
    onProgress?.({
      phase: 'uploading',
      ratio: done / chunkCount,
      fileSize: file.size,
      uploadedBytes: Math.min(done * chunkSize, file.size),
      chunkCount,
      receivedChunks: done,
      resumed,
    });
  };
  // resume 先报基线,UI 能立刻显示「续传:跳过 N 片」
  if (resumed) report(skippedChunks);

  // ── ③ 3 worker 抢单片池,乱序并发 PUT;单片失败退避重试 ──
  let done = skippedChunks;
  let next = 0;

  async function putChunkWithRetry(i: number): Promise<void> {
    const start = i * chunkSize;
    const data = file.slice(start, Math.min(start + chunkSize, file.size));
    let lastErr: unknown;
    for (let attempt = 0; attempt <= CHUNK_RETRY_LIMIT; attempt++) {
      throwIfAborted(signal);
      try {
        await fileV1Service.putChunk({ uploadId, index: i, data }, { signal });
        return;
      } catch (err) {
        lastErr = err;
        if (isAbortError(err)) throw err;
        // 网络 / 5xx / 片校验失败 → 退避后重试(服务端逐片校验幂等,重发安全)
        if (attempt < CHUNK_RETRY_LIMIT) await delay(RETRY_BASE_DELAY_MS * (attempt + 1), signal);
      }
    }
    throw lastErr;
  }

  async function worker(): Promise<void> {
    for (;;) {
      throwIfAborted(signal);
      const i = next++;
      if (i >= chunkCount) return;
      if (received.has(i)) continue; // resume 已落盘的片
      await putChunkWithRetry(i);
      done++;
      report(done);
    }
  }

  const workers: Array<Promise<void>> = [];
  for (let n = 0; n < CHUNK_CONCURRENCY; n++) workers.push(worker());
  await Promise.all(workers);

  // ── ④ 合并收尾(不传 signal:合并不可中断,abort 会留下半合并状态) ──
  onProgress?.({
    phase: 'completing',
    ratio: 1,
    fileSize: file.size,
    chunkCount,
    receivedChunks: chunkCount,
    resumed,
  });
  const complete = await fileV1Service.completeUpload(uploadId);
  return {
    file: complete.file,
    instant: false,
    uploadedChunks: chunkCount - skippedChunks,
    skippedChunks,
  };
}
