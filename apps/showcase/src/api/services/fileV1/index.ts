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
  FileUploadArgs,
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
}

export const fileV1Service = new FileV1Service();
