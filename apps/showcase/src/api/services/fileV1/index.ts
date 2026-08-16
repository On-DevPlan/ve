// services/fileV1/index.ts —— /api/v1/files/* 后端接口(SPEC §files)。
//
// 继承 HttpService 基类(../../base.ts),与 kvV1 / groupV1 同构。
// 鉴权(Bearer JWT)由 setBearerProvider 注入;401 由 request.ts 全局处理。
//
// 上传走 multipart/form-data(浏览器自动加 boundary);accessLevel 固定为
// public(本期只做公开图床,见 [[client-api]] §files)。tag facet 后端未提供
// (YAGNI),UI 由列表内收集 tag,与 KV 库存 tab 一致。
//
// request.ts 已对 FormData 通道做了特殊处理:不 JSON.stringify、不主动设
// content-type 头(浏览器会附 multipart boundary)。所以 upload 只需 build
// FormData 再 reqPost 即可。

import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type {
  FileDeleteArgs,
  FileDuplicateArgs,
  FileDuplicateResponse,
  FileGetArgs,
  FileInfo,
  FileListArgs,
  FileListResponse,
  FilePatchArgs,
  FilePutChunkArgs,
  FileUploadArgs,
  FileUploadCompleteResponse,
  FileUploadInitArgs,
  FileUploadInitResponse,
  FileUploadProgressInfo,
} from './types';

export { ApiError } from '../base';
export type {
  FileInfo,
  FileListResponse,
  FileListArgs,
  FileGetArgs,
  FileDeleteArgs,
  FilePatchArgs,
  FileUploadArgs,
  FileDuplicateArgs,
  FileDuplicateResponse,
  FileThumbnail,
  FileUploadSessionStatus,
  FileUploadInitArgs,
  FileUploadInitResponse,
  FilePutChunkArgs,
  FileUploadProgressInfo,
  FileUploadCompleteResponse,
} from './types';

export class FileV1Service extends HttpService {
  readonly BASE = apiPaths.fileV1;

  /**
   * POST /files —— multipart/form-data 上传文件。
   * 字段:
   *   - file:        Blob
   *   - tags[]:      重复参数(与 KV list 保持一致)
   *   - accessLevel: 固定 public(本期不做私有限制)
   *   - groupId:     ≥ 1;0/不传走 caller default group
   */
  async upload(args: FileUploadArgs): Promise<FileInfo> {
    const fd = new FormData();
    // 不传 filename(后端当前没补 originalName,见 [[client-api]] §files);
    // 第三个参数会作为 filename,但后端忽略,无副作用。
    fd.append('file', args.file, 'file');
    for (const t of args.tags ?? []) fd.append('tags[]', t);
    fd.append('accessLevel', 'public');
    if (args.groupId !== undefined && args.groupId > 0) fd.append('groupId', String(args.groupId));
    return this.reqPost<FileInfo>('', fd);
  }

  async list(args: FileListArgs = {}): Promise<FileListResponse> {
    const qs = new URLSearchParams();
    if (args.groupId !== undefined && args.groupId > 0) qs.set('groupId', String(args.groupId));
    // tags 是重复参数(tags=a&tags=b = 含 a 或 b);match=all 表示全部命中
    for (const tag of args.tags ?? []) qs.append('tags', tag);
    if (args.match) qs.set('match', args.match);
    if (args.key) qs.set('key', args.key);
    if (args.accessLevel) qs.set('accessLevel', args.accessLevel);
    if (args.limit !== undefined) qs.set('limit', String(args.limit));
    if (args.offset !== undefined) qs.set('offset', String(args.offset));
    const path = `${qs.toString() ? `?${qs}` : ''}`;
    return this.reqGet<FileListResponse>(path);
  }

  /** GET /files/:fileId/info —— 单文件元数据。 */
  async info(args: FileGetArgs): Promise<FileInfo> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    return this.reqGet<FileInfo>(`/${encodeURIComponent(args.fileId)}/info${qs}`);
  }

  /** PATCH /files/:fileId —— 改 accessLevel / tags / expireSeconds / category。 */
  async patch(args: FilePatchArgs): Promise<FileInfo> {
    const body: { accessLevel?: string; tags?: string[]; expireSeconds?: number; category?: string; groupId?: number } = {};
    if (args.accessLevel !== undefined) body.accessLevel = args.accessLevel;
    if (args.tags !== undefined) body.tags = args.tags;
    if (args.expireSeconds !== undefined) body.expireSeconds = args.expireSeconds;
    if (args.category !== undefined) body.category = args.category;
    if (args.groupId !== undefined && args.groupId > 0) body.groupId = args.groupId;
    return this.reqPatch<FileInfo>(`/${encodeURIComponent(args.fileId)}`, body);
  }

  /** DELETE /files/:fileId —— owner/admin only。后端 403。 */
  async delete(args: FileDeleteArgs): Promise<void> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    await this.reqDelete(`/${encodeURIComponent(args.fileId)}${qs}`);
  }

  /** POST /files/:fileId/duplicate —— 跨组复制。新 fileId 由后端生成。 */
  async duplicate(args: FileDuplicateArgs): Promise<FileDuplicateResponse> {
    const body: { sourceGroupId?: number; targetGroupId: number } = {
      targetGroupId: args.targetGroupId,
    };
    if (args.sourceGroupId !== undefined && args.sourceGroupId > 0) body.sourceGroupId = args.sourceGroupId;
    return this.reqPost<FileDuplicateResponse>(
      `/${encodeURIComponent(args.fileId)}/duplicate`,
      body,
    );
  }

  // ── 分片上传(大文件;协议见 types.ts 分片段注释)────────────────
  // 单发 upload 继续服务小文件;分片 5 端点由 components/user-space 的
  // chunked-upload 编排器驱动,组件不单独调用。

  /**
   * POST /files/uploads —— 分片初始化(秒传预检 + 续传定位)。
   * 同 (uploader,group,sha256) 的 uploading 会话 → resume;同组同 sha256
   * 命中 active 文件且无 key → instant(响应带 file,零字节传输)。
   */
  async initUpload(args: FileUploadInitArgs): Promise<FileUploadInitResponse> {
    const body: Record<string, unknown> = {
      originalName: args.originalName,
      contentType: args.contentType,
      fileSize: args.fileSize,
      fileSha256: args.fileSha256,
      chunkSize: args.chunkSize,
      chunkHashes: args.chunkHashes,
      accessLevel: args.accessLevel ?? 'public',
    };
    if (args.fileMd5) body.fileMd5 = args.fileMd5;
    if (args.tags !== undefined) body.tags = args.tags;
    if (args.expireSeconds !== undefined) body.expireSeconds = args.expireSeconds;
    if (args.groupId !== undefined && args.groupId > 0) body.groupId = args.groupId;
    return this.reqPost<FileUploadInitResponse>('/uploads', body);
  }

  /**
   * PUT /files/uploads/:uploadId/chunks/:index —— 传单片。
   * raw body octet-stream(非 multipart);服务端逐片 sha256 校验,幂等可重发;
   * 分片可乱序。body 在这里统一包 octet-stream Blob(File 切片带原文件 MIME)。
   */
  async putChunk(args: FilePutChunkArgs, opts?: { signal?: AbortSignal }): Promise<void> {
    const data =
      args.data.type === 'application/octet-stream'
        ? args.data
        : new Blob([args.data], { type: 'application/octet-stream' });
    await this.reqPut(
      `/uploads/${encodeURIComponent(args.uploadId)}/chunks/${args.index}`,
      data,
      opts,
    );
  }

  /** GET /files/uploads/:uploadId —— 会话进度(receivedChunks/uploadedBytes)。 */
  async getUploadProgress(uploadId: string): Promise<FileUploadProgressInfo> {
    return this.reqGet<FileUploadProgressInfo>(`/uploads/${encodeURIComponent(uploadId)}`);
  }

  /** POST /files/uploads/:uploadId/complete —— 全片到齐后合并收尾(CAS + 整体校验)。 */
  async completeUpload(uploadId: string): Promise<FileUploadCompleteResponse> {
    return this.reqPost<FileUploadCompleteResponse>(
      `/uploads/${encodeURIComponent(uploadId)}/complete`,
      {},
    );
  }

  /** DELETE /files/uploads/:uploadId —— 放弃会话(aborted + 清分片目录;仅 uploader 本人)。 */
  async abortUpload(uploadId: string): Promise<void> {
    await this.reqDelete(`/uploads/${encodeURIComponent(uploadId)}`);
  }
}

export const fileV1Service = new FileV1Service();
