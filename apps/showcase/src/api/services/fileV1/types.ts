// fileV1 types —— /api/v1/files/* 后端 DTO。
//
// 与后端对齐:filed backend (dev_ctr_hello file module) 字段命名见
// dev_ctr_hello user-kv-invitecode skill 的 [[client-api]] §files。
// accessLevel 三态 public / private / protected;owner 删 / 跨组 dup 由
// 后端按 groupId + role 校验。

export type FileAccessLevel = 'public' | 'private' | 'protected';

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
