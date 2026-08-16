// fileV1 types —— /api/v1/files/* 后端 DTO。
//
// 与后端对齐:filed backend (dev_ctr_hello file module) 字段命名见
// dev_ctr_hello user-kv-invitecode skill 的 [[client-api]] §files。
// accessLevel 三态 public / private / protected;owner 删 / 跨组 dup 由
// 后端按 groupId + role 校验。

export type FileAccessLevel = 'public' | 'private' | 'protected';

/** dev_ctr_hello 后端 2026-08-10 起的缩略图档位元数据。
 *  见 dev_ctr_hello user-file-invitecode [[client-api]] §3.1。 */
export interface FileThumbnail {
  level: 'sm' | 'md' | 'lg';
  width: number;
  height: number;
  size: number;
  contentType: string;
  /** 已拼好的绝对 URL;前端 <img src> 直接用;`?level=<level>` 复用父文件路由。 */
  url: string;
}

/** GET /files?groupId=...&tags=... 接口的单条文件元数据。 */
export interface FileInfo {
  fileId: string;
  url: string;
  accessLevel: FileAccessLevel;
  /** RFC3339 过期时间;空串表示永久。 */
  expireAt: string;
  /** 字节 */
  size: number;
  /** MIME,如 image/png */
  contentType: string;
  groupId: number;
  groupName: string;
  myRole: 'owner' | 'admin' | 'writer' | 'reader';
  /** 文件 tags(replace 语义);空数组 = 无 tag */
  tags: string[];
  md5: string;
  sha256: string;
  createdAt: string;
  /** 后端 2026-08-10 起返回的缩略图档位列表。
   *  老文件 / 非图片 / md5 dedup 命中 → undefined。 */
  thumbnails?: FileThumbnail[];
}

export interface FileListResponse {
  items: FileInfo[];
  total: number;
}

export interface FileListArgs {
  groupId?: number;
  /** 多值,重复参数;GET /files?tags=a&tags=b */
  tags?: string[];
  /** any|all;默认 backend 处理 */
  match?: 'any' | 'all';
  key?: string;
  accessLevel?: FileAccessLevel;
  limit?: number;
  offset?: number;
}

export interface FileGetArgs {
  fileId: string;
  groupId?: number;
}

export interface FileDeleteArgs {
  fileId: string;
  groupId?: number;
}

/**
 * PATCH /files/:fileId —— 后端 PATCH 接受 pointer 字段,nil=不改。
 * 前端这里总是传完整对象(UI 行内 select 永远发完整值);
 * tags 是 replace 语义(空数组 = 清空)。
 */
export interface FilePatchArgs {
  fileId: string;
  groupId?: number;
  accessLevel?: FileAccessLevel;
  tags?: string[];
  expireSeconds?: number;
  category?: string;
}

/** POST /files —— multipart/form-data 上传文件。 */
export interface FileUploadArgs {
  file: Blob;
  groupId?: number;
  tags?: string[];
}

/**
 * POST /files/:fileId/duplicate —— 跨组复制文件(source read+ → target write+)。
 * 后端会生成新 fileId(32 hex);调用方拿到的是新文件 ID。sourceGroupId 0/不传
 * → 走 caller default group(与 KV duplicate 行为一致)。
 */
export interface FileDuplicateArgs {
  fileId: string;
  sourceGroupId?: number;
  targetGroupId: number;
}

export interface FileDuplicateResponse {
  fileId: string;
  targetGroupId: number;
  url: string;
}

// ── 分片上传(2026-08-15 后端)─────────────────────────────────
// 契约见 dev_ctr_hello user-file-invitecode skill 的 [[chunked-upload]]:
//   POST /files/uploads init 返回 instant(秒传)|new|resume(断点续传)
//   → 逐片 PUT raw body(服务端逐片 sha256 校验,幂等,可乱序)
//   → POST complete 合并(整体 sha256+size 校验,CAS 抢占)
// 客户端必须先算整文件 sha256 + 每片 sha256 manifest(init 就要提交)。
// fileMd5 可选 —— WebCrypto 无 MD5,前端不发,complete 走 sha256+size 校验。

/** init 三态:new=全新会话;resume=同 (uploader,group,sha256) 有 uploading 会话(断点续传);instant=秒传命中 */
export type FileUploadSessionStatus = 'new' | 'resume' | 'instant';

/** POST /files/uploads —— 分片上传初始化(同时做秒传预检 + 续传定位)。 */
export interface FileUploadInitArgs {
  /** 0/不传 → caller default group(与单发 upload 一致) */
  groupId?: number;
  originalName: string;
  contentType: string;
  fileSize: number;
  /** 整文件 SHA-256(64 hex)—— 秒传/续传定位指纹 */
  fileSha256: string;
  /** 可选,complete 时校验;前端不发(WebCrypto 无 MD5) */
  fileMd5?: string;
  /** 64KB ~ 64MB(服务端校验越界拒) */
  chunkSize: number;
  /** 各片 SHA-256(64 hex),长度必须 == ceil(fileSize / chunkSize) */
  chunkHashes: string[];
  accessLevel?: FileAccessLevel;
  tags?: string[];
  expireSeconds?: number;
}

export interface FileUploadInitResponse {
  status: FileUploadSessionStatus;
  /** instant 时为空串(无会话) */
  uploadId: string;
  chunkSize: number;
  chunkCount: number;
  /** resume 时非空 —— 已落盘分片 index,客户端跳过 */
  receivedChunks: number[];
  uploadedBytes: number;
  fileSize: number;
  progress: number;
  /** 仅 status=instant 时存在;与 POST /files 响应同构 */
  file?: FileInfo;
}

/** PUT /files/uploads/:uploadId/chunks/:index —— 单片。 */
export interface FilePutChunkArgs {
  uploadId: string;
  index: number;
  /** 单片字节;服务端 raw body 读取并校验该片 sha256 == init manifest[index] */
  data: Blob;
}

/** GET /files/uploads/:uploadId —— 进度查询。 */
export interface FileUploadProgressInfo {
  uploadId: string;
  status: 'uploading' | 'completed' | 'expired' | 'aborted';
  chunkSize: number;
  chunkCount: number;
  receivedCount: number;
  receivedChunks: number[];
  uploadedBytes: number;
  fileSize: number;
  progress: number;
}

/** POST /files/uploads/:uploadId/complete —— 合并收尾响应。 */
export interface FileUploadCompleteResponse {
  file: FileInfo;
}
