# user-space 文件 tab(上传 / 列表 / 删除 / tag / 复制)设计

> 日期:2026-08-08
> 状态:设计确认(方案 A + 跳过 originalName)
> 仓库:ve(前端主改动)+ dev_ctr_hello(后端补 1 字段)

## 目标

给 ve 前端 user-space 组件新增「文件」tab,让用户在当前选中的工作空间(group)内管理文件:上传(图床,固定 public)、列表(public 出图 / 其余出图标)、删除(仅 owner/admin)、tag 筛选、行内改 accessLevel、复制到其他工作空间。后端 file 域 12 个端点已在 dev_ctr_hello 就绪(2026-08-08),前端从零接入。

## 架构

- **后端 file 域**(`/api/v1/files`):`files` / `file_tags` / `file_shares` / `file_access_logs` 表,group 归属 + `group_members.role` 单一权限源。groupId 契约与 KV 完全一致(0 = caller default_group_id)。
- **前端分层**(复用 ve 现有 api 分层):
  - `request.ts` 传输层加 FormData 通道(现在只 JSON)
  - `registry.ts` 注册 `fileV1` backend
  - `services/fileV1/` HTTP wrapper(继承 `HttpService`)
  - `api/components/user-space/` 组件域类型 + `createUserSpaceStore` 业务方法
  - `packages/react-components/src/user-space/` UI:新 tab「文件」+ `Files.tsx` + `UploadFileModal` + `DuplicateFileModal`
- **UI 形态 = 镜像 KV 库存 tab**(方案 A):工具栏(上传 + tag 筛选 + 刷新)+ 表格 + 分页 + modal,全套复用 `.sl-us-*` 样式与 `withError`/`saving`/`hasMinRole` 模式。

## 范围

### 包含

- 上传(multipart,固定 `accessLevel=public`,可选 tags)
- 列表(public + image → `<img>` 出图;其余出文件类型图标)
- 删除(仅 owner/admin,confirm 二次确认)
- tag 筛选(`?tags[]=...&tags[]=...`)
- 行内改 accessLevel(select:public/private/protected → PATCH)
- 复制到其他工作空间(镜像 KV 的 DuplicateKvModal)
- **原文件名展示**(后端没补 `originalName`,列表显示 fileId 截断 + contentType 类型)

### 不包含(避免越界)

- 分享(share 短码)—— 本期不做,后端接口保留待后续
- 文件版本 / 恢复(file 域无 versions)
- 批量上传 / 批量操作
- 文件本体删除(后端软删,本体不删)
- 上传进度条(只 loading 态)
- `visibility` 字段(已废弃)

## 不做(避免越界)

- **后端补 `originalName` 字段**(原本 spec 设想)—— 用户明确决定跳过,降低跨仓库改动;列表显示 fileId 截断(前 8 位 hex)+ contentType 标签。后续真要做原文件名再说。

## 前端改动(ve)

### 1. 传输层:`apps/showcase/src/api/http/request.ts`

`call()` 的 body 处理加 FormData 分支:

```ts
const isFormData = body instanceof FormData;
headers: {
  Accept: 'application/json',
  ...(body !== undefined && !isFormData ? { 'content-type': 'application/json' } : {}),
  ...bearerHeader(),
  ...headers,
},
body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
```

- FormData 时**不设** `content-type`(浏览器自动带 multipart boundary)、**不** stringify
- 现有 JSON 路径不变

### 2. 路由:`apps/showcase/src/api/registry.ts`

```ts
apiPaths.fileV1 = '/api/v1/files';
// registry entry,target dev/prod 同 kvV1('http://47.110.80.47:8988')
```

### 3. client:`services/fileV1/`(新建)

`types.ts`:

```ts
export interface FileInfo {
  fileId: string; url: string;
  accessLevel: 'public' | 'private' | 'protected';
  expireAt: string; size: number; contentType: string;
  groupId: number; groupName: string; myRole: string;
  tags: string[]; md5: string; sha256: string; createdAt: string;
}
export interface FileUploadArgs { file: Blob; groupId?: number; tags?: string[]; accessLevel?: string; expireSeconds?: number }
export interface FileListArgs { groupId?: number; tags?: string[]; match?: 'any'|'all'; key?: string; accessLevel?: string; limit?: number; offset?: number }
export interface FileListResponse { items: FileInfo[]; total: number }
export interface FilePatchArgs { fileId: string; groupId?: number; accessLevel?: string; tags?: string[]; expireSeconds?: number; category?: string }
export interface FileDuplicateArgs { fileId: string; sourceGroupId?: number; targetGroupId: number }
export interface FileDuplicateResponse { fileId: string; targetGroupId: number; url: string }
```

`index.ts` — `FileV1Service extends HttpService`,`BASE = apiPaths.fileV1`:

```ts
async upload(args: FileUploadArgs): Promise<FileInfo> {
  const fd = new FormData();
  fd.append('file', args.file, 'file');   // 无 originalName,留 filename 默认
  for (const t of args.tags ?? []) fd.append('tags[]', t);
  fd.append('accessLevel', args.accessLevel ?? 'public');
  if (args.expireSeconds) fd.append('expireSeconds', String(args.expireSeconds));
  if (args.groupId && args.groupId > 0) fd.append('groupId', String(args.groupId));
  return this.reqPost<FileInfo>('', fd);   // reqPost 经 request.ts 识别 FormData
}

async list(args: FileListArgs = {}): Promise<FileListResponse> {
  const qs = new URLSearchParams();
  if (args.groupId && args.groupId > 0) qs.set('groupId', String(args.groupId));
  for (const t of args.tags ?? []) qs.append('tags', t);
  if (args.match) qs.set('match', args.match);
  if (args.key) qs.set('key', args.key);
  if (args.accessLevel) qs.set('accessLevel', args.accessLevel);
  if (args.limit !== undefined) qs.set('limit', String(args.limit));
  if (args.offset !== undefined) qs.set('offset', String(args.offset));
  return this.reqGet<FileListResponse>(`${qs.toString() ? `?${qs}` : ''}`);
}

async info(args: { fileId: string; groupId?: number }): Promise<FileInfo> { /* GET /:fileId/info */ }
async patch(args: FilePatchArgs): Promise<FileInfo> { /* PATCH /:fileId */ }
async delete(args: { fileId: string; groupId?: number }): Promise<void> { /* DELETE /:fileId */ }
async duplicate(args: FileDuplicateArgs): Promise<FileDuplicateResponse> { /* POST /:fileId/duplicate */ }
```

- `services/index.ts` 加 `export * from './fileV1';`
- `request.ts` 的 `reqPost` 传 `FormData` 不设 content-type,但 `HttpService.reqPost<T>(path, body)` 的 `body: unknown` 类型需放行 FormData —— 改 `body?: unknown` 即可(已是 unknown)

### 4. 组件域:`api/components/user-space/types.ts`

```ts
export interface FileView {
  fileId: string; url: string;
  /** 展示名 = fileId 截断前 8 hex;后端没补 originalName */
  displayName: string;
  accessLevel: FileInfo['accessLevel']; size: number; contentType: string;
  groupId: number; groupName: string; myRole: string;
  tags: string[]; md5: string; sha256: string; createdAt: string;
  /** public + image 才可 `<img src={url}>` 直出 */
  isPreviewable: boolean;
  /** 类型图标用:按 contentType 归类 text/image/other */
  fileKind: 'image' | 'text' | 'other';
}
export interface FileListResult { items: FileView[]; total: number; page: number; pageSize: number }
```

`ViewMode` 加 `| 'files'`。`UserSpaceStore` 加(5 个方法):

```ts
uploadFile(groupId: number, args: { file: Blob; tags?: string[] }): Promise<FileView>;
listFiles(groupId: number, opts: { page: number; pageSize: number; tags?: string[] }): Promise<FileListResult>;
updateFileMeta(groupId: number, fileId: string, args: { accessLevel?: FileInfo['accessLevel']; tags?: string[] }): Promise<FileView>;
deleteFile(groupId: number, fileId: string): Promise<void>;
duplicateFile(args: { fileId: string; sourceGroupId: number; targetGroupId: number }): Promise<FileDuplicateResponse>;
```

`createUserSpaceStore.ts` 实现 5 方法,风格对齐 `createKv/listKvs`:
- `uploadFile` 透传 `fileV1Service.upload`(groupId 显式传,`accessLevel` 固定 public)
- `listFiles` → `toFileView` 映射(`isPreviewable` = `accessLevel==='public' && contentType.startsWith('image/')`;`fileKind` 按 contentType 前缀归类)
- `updateFileMeta` → `fileV1Service.patch`
- `deleteFile` → `fileV1Service.delete`
- `duplicateFile` → `fileV1Service.duplicate`
- `api/components/user-space/index.ts` re-export `FileView`/`FileListResult`/`FileDuplicateArgs`/`FileDuplicateResponse`(组件域用到的类型)

> **YAGNI**:`fileV1Service.tags`(tag facet)本期不加 —— Files.tsx 的 tag 下拉从列表 `items` 收集(镜像 Inventory 的 KV 做法),不调后端 facet。后端 `/files/tags` 接口保留待后续。

### 5. UI:`packages/react-components/src/user-space/`

- `src/types.ts`:透传 `FileView`/`FileListResult`
- `index.tsx`:
  - `VIEW_TABS` 加 `{ key: 'files', label: '文件' }`
  - 状态:`files`/`filesLoading`/`filesError`/`filesPage`/`filesTag`/`uploadOpen`/`duplicateOpen`/`duplicateSource`/`fileToast`
  - `loadFiles(page, tag)` 镜像 `loadKv`;切换组时清空;`view==='files'` effect 触发
  - handlers:`handleUploadFile`(withError → reload + toast)、`handleDeleteFile`(confirm + 末页回退)、`handleAccessLevelChange`、`handleDuplicateFile`(toast「已复制」)
  - 渲染 `Files.tsx` + `UploadFileModal` + `DuplicateFileModal`
- **新建** `src/pages/Files.tsx`(镜像 Inventory):
  - 工具栏:tag `<select>`(从 `files.items` 收集,镜像 Inventory)+ spacer + 刷新 + 「+ 上传文件」(`canWrite`)
  - 表格列:预览(缩略图或图标)/ 文件名 / 类型 / 大小 / tag / 过期 / accessLevel / actions
  - accessLevel 列 = 行内 `<select>`,`onChange` → `onAccessLevelChange`(disabled 当 saving)
  - actions:⎘ 复制(canWrite)+ × 删除(仅 `hasMinRole(myRole,'admin')`,confirm)
  - 分页 foot,同 Inventory
- **新建** `src/pages/UploadFileModal.tsx`:
  - 复用 `.sl-us-modal*` 样式(`document.body` portal,同 KvEditorModal)
  - 文件 `<input type="file">` + tags `<input>`(逗号分隔)→ 提交按钮 disabled 当没选文件 / saving
  - 显示选中文件名 + 大小预览
- **新建** `src/pages/DuplicateFileModal.tsx`(镜像 DuplicateKvModal):
  - 源文件只读展示 + 目标组 `<select>`(排除源组 + `hasMinRole(g.myRole,'writer')`)
  - 确认 disabled:没选目标组
  - 成功 → toast「已复制为 <文件名>」+ reload
- `index.css`:少量新增 `.sl-us-file-thumb`(缩略图尺寸/圆角)、`.sl-us-file-icon`、`.sl-us-cell-size`(tabular-nums)

## 权限映射(与 KV 的关键区别)

| 操作 | 后端门槛 | UI 判断 |
|---|---|---|
| 上传 / 改 accessLevel / 复制 | write+ | `hasMinRole(myRole,'writer')` |
| **删除** | **仅 owner/admin**(file delete 比 KV 严格) | `hasMinRole(myRole,'admin')` |
| 列表 / tag 筛选 / info | read+ | 任意成员 |

## 数据流与错误处理

```
上传 → UploadFileModal → store.uploadFile → fileV1Service.upload(FormData)
      → reload 列表 + toast「已上传 <name>」
列表 → store.listFiles → FileListResult(public+image 直出图)
改 access → 行内 select → store.updateFileMeta → reload
删除 → confirm → store.deleteFile → reload(末页回退)
复制 → DuplicateFileModal → store.duplicateFile → toast + reload
```

- 全部走 `withError` → `.sl-us-error`;上传失败保留已选文件不清空
- 上传复用 `saving` 态(不单独加 uploading,保持与 KV 一致)
- 图片加载失败(onError)回退图标,不破版

## 测试

| 文件 | 内容 |
|---|---|
| `apps/showcase/__tests__/request.test.ts`(改)| 补 FormData 用例:body 不 stringify、不设 content-type、保留 boundary |
| **新建** `apps/showcase/__tests__/fileV1.test.ts` | client 层:upload 组 FormData(断言 fd 字段)/ list query(tags 多值/groupId/分页)/ patch / delete / duplicate(路径 encodeURIComponent) |
| **新建** `apps/showcase/__tests__/createUserSpaceStore-file.test.ts` | store 层:uploadFile/listFiles(映射 isPreviewable/fileKind)/updateFileMeta/deleteFile/duplicateFile,后端 stub |

- 全仓库 `pnpm exec vitest run`(原 339 + 新增,要求全过)
- lint:`pnpm exec eslint --max-warnings=0`(改动的文件)
- **不**跑 build(纯前端 + 后端 2 行)

## 全局约束

- Conventional Commits,commit 消息末尾附:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 在 `fix/gis-runtime-bugs` 分支提交;**不** push 不开 PR(用户后续决定)
- 只改本设计列的文件;不顺手重构
- 后端改动极小(2 行),用户已确认;后端仓库单独 commit

## 验收标准

- user-space 切换任一工作空间 → 「文件」tab 列出该组文件
- 上传文件 → 列表出现,public+图片直出缩略图,非图片出图标
- 行内改 accessLevel → 列表刷新;改 private 后缩略图消失换图标
- 删除:writer 无删除按钮;owner/admin 删除 → confirm → 消失
- 复制到另一工作空间 → 目标组出现副本 + toast
- reader 只读:无上传/复制/删除/改 accessLevel 控件
- 后端 `GET /files/:id/info` 返回字段(不含 originalName,展示用 fileId 截断)
