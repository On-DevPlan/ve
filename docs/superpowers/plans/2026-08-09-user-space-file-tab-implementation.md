# user-space 文件 tab 实现 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** user-space 新增「文件」 tab:上传(图床,固定 public)、列表(public+image 出图,其余出图标)、删除(仅 owner/admin)、tag 筛选、行内改 accessLevel、复制到其他工作空间。展示名用 `fileId` 截断前 8 hex(后端没补 `originalName`)。

**Spec:** `docs/superpowers/specs/2026-08-08-user-space-file-tab-design.md`

**Architecture:** 镜像 KV 库存 tab 模式(用户 8 月 7 日已签)。
- `request.ts` 加 FormData 通道
- `registry.ts` 加 `fileV1`
- `services/fileV1/` HTTP wrapper(5 方法:upload/list/info/patch/delete/duplicate;tag facet YAGNI)
- `api/components/user-space/` 5 store 方法 + FileView/FileListResult
- `packages/react-components/src/user-space/` 新 tab「文件」+ Files.tsx + UploadFileModal + DuplicateFileModal

**Tech Stack:** 现有 React + HttpService + createUserSpaceStore + ve CSS。无新依赖。

## Global Constraints

- **不动后端 dev_ctr_hello**(用户决定跳过 originalName,跨仓库改动最小化)
- 不做 share 码 / 标签 facet(本期 YAGNI)
- 不做图片上传进度条 / 批量上传
- 镜像 KV 库存 tab 的 modal/handler/withError 模式
- 不重写 resolveDefaultGroupId / 已有的 store 方法
- Conventional Commits;Co-Authored-By trailer
- 在 `fix/gis-runtime-bugs` 分支提交;**不** push 不开 PR(用户后续决定)
- lint clean;`pnpm exec vitest run` 全过(363 + 新增)
- 不顺手重构

---

## Task 1: 文件 tab 接入(user-space)

**Files:**
- Modify: `apps/showcase/src/api/http/request.ts`(`call()` 加 FormData 分支)
- Modify: `apps/showcase/src/api/registry.ts`(加 `apiPaths.fileV1 = '/api/v1/files'` + entry)
- Create: `apps/showcase/src/api/services/fileV1/types.ts`(`FileInfo` / `FileListArgs` / `FileListResponse` / `FilePatchArgs` / `FileDuplicateArgs` / `FileDuplicateResponse`)
- Create: `apps/showcase/src/api/services/fileV1/index.ts`(`FileV1Service extends HttpService`,5 方法)
- Modify: `apps/showcase/src/api/services/index.ts`(`export * from './fileV1'`)
- Modify: `apps/showcase/src/api/components/user-space/types.ts`(`FileView` / `FileListResult` + `UserSpaceStore` 加 5 方法)
- Modify: `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`(实现 5 方法 + `toFileView` 映射)
- Modify: `apps/showcase/src/api/components/user-space/index.ts`(re-export `FileView` / `FileListResult` / `FileDuplicateArgs` / `FileDuplicateResponse`)
- Modify: `packages/react-components/src/user-space/src/types.ts`(透传 `FileView` / `FileListResult`)
- Modify: `packages/react-components/src/user-space/index.tsx`(`VIEW_TABS` 加 'files' + files 状态 + handlers + 渲染 Files.tsx + UploadFileModal + DuplicateFileModal)
- Create: `packages/react-components/src/user-space/src/pages/Files.tsx`(镜像 Inventory)
- Create: `packages/react-components/src/user-space/src/pages/UploadFileModal.tsx`(文件 + tags + 上传)
- Create: `packages/react-components/src/user-space/src/pages/DuplicateFileModal.tsx`(目标组下拉)
- Modify: `packages/react-components/src/user-space/index.css`(少量新增 `.sl-us-file-thumb` / `.sl-us-file-icon` / `.sl-us-cell-size` 等)
- Test: `apps/showcase/__tests__/request.test.ts`(补 FormData 用例)
- Create: `apps/showcase/__tests__/fileV1.test.ts`(client 层 5 方法)
- Create: `apps/showcase/__tests__/createUserSpaceStore-file.test.ts`(store 层 5 方法)

**Interfaces:**
- `UserV1Service`-style:`FileV1Service extends HttpService`;`BASE = apiPaths.fileV1`
- `upload(args: { file: Blob; groupId?: number; tags?: string[] }): Promise<FileInfo>` — POST FormData
- `list(args: FileListArgs): Promise<FileListResponse>` — GET ?groupId=...&tags[]=...&limit=...&offset=...
- `info(args: { fileId: string; groupId?: number }): Promise<FileInfo>`
- `patch(args: FilePatchArgs): Promise<FileInfo>` — PATCH
- `delete(args: { fileId: string; groupId?: number }): Promise<void>`
- `duplicate(args: FileDuplicateArgs): Promise<FileDuplicateResponse>` — POST /:fileId/duplicate
- `FileView.fileId` 截前 8 hex 作为 `displayName`(后端没补 originalName)
- `FileView.isPreviewable = accessLevel==='public' && contentType.startsWith('image/')`
- `FileView.fileKind = contentType.startsWith('image/') ? 'image' : contentType.startsWith('text/') ? 'text' : 'other'`
- `UserSpaceStore`:加 `uploadFile(groupId, { file, tags? })` / `listFiles(groupId, { page, pageSize, tags? })` / `updateFileMeta(groupId, fileId, { accessLevel?, tags? })` / `deleteFile(groupId, fileId)` / `duplicateFile({ fileId, sourceGroupId, targetGroupId })`

### Step 1: FormData 通道(request.ts)

`apps/showcase/src/api/http/request.ts` 在 `call()` 里:

```ts
const isFormData = body instanceof FormData;
const init: RequestInit = {
  method,
  credentials: 'include',
  headers: {
    Accept: 'application/json',
    // FormData 时不设 content-type,浏览器自动加 multipart boundary
    ...(body !== undefined && !isFormData ? { 'content-type': 'application/json' } : {}),
    ...bearerHeader(),
    ...headers,
  },
  body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
  signal,
  ...rest,
};
```

跑 `pnpm exec vitest run apps/showcase/__tests__/request.test.ts` —— 应仍过(默认 JSON 路径不变)。

### Step 2: registry.ts 加 fileV1

```ts
export const apiPaths = {
  userV1: '/api/v1/user',
  kvV1: '/api/v1/kv',
  groupV1: '/api/v1/groups',
  groupInvitationV1: '/api/v1/group-invitations',
  fileV1: '/api/v1/files',     // 新增
} as const;

const registry = {
  // ...现有
  fileV1: {
    target: { dev: 'http://47.110.80.47:8988', prod: 'http://47.110.80.47:8988' },
    route: apiPaths.fileV1,
  },
} as const satisfies ApiRegistry;
```

registry.test.ts 应仍过(启动期校验)。

### Step 3: services/fileV1/types.ts

```ts
export interface FileInfo {
  fileId: string; url: string;
  accessLevel: 'public' | 'private' | 'protected';
  expireAt: string; size: number; contentType: string;
  groupId: number; groupName: string; myRole: string;
  tags: string[]; md5: string; sha256: string; createdAt: string;
}
export interface FileListArgs {
  groupId?: number; tags?: string[]; match?: 'any'|'all';
  key?: string; accessLevel?: string;
  limit?: number; offset?: number;
}
export interface FileListResponse { items: FileInfo[]; total: number }
export interface FilePatchArgs {
  fileId: string; groupId?: number;
  accessLevel?: 'public'|'private'|'protected';
  tags?: string[]; expireSeconds?: number; category?: string;
}
export interface FileDuplicateArgs {
  fileId: string; sourceGroupId?: number; targetGroupId: number;
}
export interface FileDuplicateResponse {
  fileId: string; targetGroupId: number; url: string;
}
```

### Step 4: services/fileV1/index.ts

继承 `HttpService`,`BASE = apiPaths.fileV1`。5 方法:

```ts
async upload(args: { file: Blob; groupId?: number; tags?: string[] }): Promise<FileInfo> {
  const fd = new FormData();
  fd.append('file', args.file, 'file');           // 无 originalName
  for (const t of args.tags ?? []) fd.append('tags[]', t);
  fd.append('accessLevel', 'public');             // 固定 public
  if (args.groupId && args.groupId > 0) fd.append('groupId', String(args.groupId));
  return this.reqPost<FileInfo>('', fd);
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

`HttpService.reqPost<T>(path, body: unknown)` 已支持任意 body,FormData 走 request.ts 自动识别。

### Step 5: services/index.ts barrel re-export

```ts
export * from './fileV1';
```

### Step 6: store 域类型 + UserSpaceStore 接口

`apps/showcase/src/api/components/user-space/types.ts` 加(在现有 re-export 之上):

```ts
import type { FileDuplicateArgs, FileDuplicateResponse, FileInfo } from '../../services/fileV1/types';

export type { FileDuplicateArgs, FileDuplicateResponse };

export interface FileView {
  fileId: string; url: string;
  displayName: string;          // fileId.slice(0, 8)
  accessLevel: FileInfo['accessLevel'];
  size: number; contentType: string;
  groupId: number; groupName: string; myRole: string;
  tags: string[]; md5: string; sha256: string; createdAt: string;
  isPreviewable: boolean;
  fileKind: 'image' | 'text' | 'other';
}
export interface FileListResult {
  items: FileView[]; total: number; page: number; pageSize: number;
}

// UserSpaceStore 加 5 方法
uploadFile(groupId: number, args: { file: Blob; tags?: string[] }): Promise<FileView>;
listFiles(groupId: number, opts: { page: number; pageSize: number; tags?: string[] }): Promise<FileListResult>;
updateFileMeta(groupId: number, fileId: string, args: { accessLevel?: FileInfo['accessLevel']; tags?: string[] }): Promise<FileView>;
deleteFile(groupId: number, fileId: string): Promise<void>;
duplicateFile(args: { fileId: string; sourceGroupId: number; targetGroupId: number }): Promise<FileDuplicateResponse>;
```

### Step 7: store 实现(createUserSpaceStore.ts)

```ts
import { fileV1Service } from '../../services';

function toFileView(info: FileInfo): FileView {
  return {
    ...info,
    displayName: info.fileId.slice(0, 8),
    isPreviewable: info.accessLevel === 'public' && info.contentType.startsWith('image/'),
    fileKind: info.contentType.startsWith('image/') ? 'image'
            : info.contentType.startsWith('text/') ? 'text' : 'other',
  };
}

async function uploadFile(groupId, args) {
  requireAuth();
  return toFileView(await fileV1Service.upload({ file: args.file, groupId, tags: args.tags }));
}
async function listFiles(groupId, opts) {
  requireAuth();
  const { items, total } = await fileV1Service.list({
    groupId, limit: opts.pageSize, offset: (opts.page - 1) * opts.pageSize, tags: opts.tags,
  });
  return { items: items.map(toFileView), total, page: opts.page, pageSize: opts.pageSize };
}
async function updateFileMeta(groupId, fileId, args) {
  requireAuth();
  return toFileView(await fileV1Service.patch({ fileId, groupId, ...args }));
}
async function deleteFile(groupId, fileId) {
  requireAuth();
  await fileV1Service.delete({ fileId, groupId });
}
async function duplicateFile(args) {
  requireAuth();
  return fileV1Service.duplicate(args);
}
```

return 里导出 5 个新方法。

### Step 8: UI 新 tab + 状态 + handlers

`packages/react-components/src/user-space/index.tsx`:

```ts
const VIEW_TABS = [
  // ...现有
  { key: 'files', label: '文件' },
] as const;
type ViewMode = 'overview' | 'members' | 'invitations' | 'inventory' | 'files';

// 状态
const [files, setFiles] = useState<FileListResult | null>(null);
const [filesLoading, setFilesLoading] = useState(false);
const [filesError, setFilesError] = useState<string | null>(null);
const [filesPage, setFilesPage] = useState(1);
const [filesPageSize, setFilesPageSize] = useState(10);  // LS 持久化,同 KV
const [filesTag, setFilesTag] = useState<string | null>(null);
const [uploadOpen, setUploadOpen] = useState(false);
const [duplicateFileOpen, setDuplicateFileOpen] = useState(false);
const [duplicateFileSource, setDuplicateFileSource] = useState<FileView | null>(null);
const [fileToast, setFileToast] = useState<string | null>(null);

// loadFiles + loadFilesTags(从列表内收集,镜像 Inventory)
const loadFiles = useCallback(async (page, tag) => {
  if (!currentSelected) return;
  setFilesLoading(true); setFilesError(null);
  try {
    const result = await store.listFiles(currentSelected, { page, pageSize: filesPageSize, tags: tag ? [tag] : undefined });
    setFiles(result);
  } catch (e) { setFilesError(e instanceof Error ? e.message : 'load files failed'); }
  finally { setFilesLoading(false); }
}, [currentSelected, store, filesPageSize]);

useEffect(() => {
  if (view === 'files') void loadFiles(filesPage, filesTag);
}, [view, loadFiles, filesPage, filesTag]);

// handlers
async function handleUploadFile(args: { file: File; tags: string[] }) {
  if (!currentSelected) return;
  await withError(async () => {
    await store.uploadFile(currentSelected, { file: args.file, tags: args.tags });
    setUploadOpen(false);
    setFilesPage(1);
    await loadFiles(1, filesTag);
  });
}
async function handleAccessLevelChange(item: FileView, accessLevel: 'public'|'private'|'protected') {
  if (!currentSelected) return;
  await withError(async () => {
    await store.updateFileMeta(currentSelected, item.fileId, { accessLevel });
    await loadFiles(filesPage, filesTag);
  });
}
async function handleDeleteFile(item: FileView) {
  if (!currentSelected) return;
  if (!window.confirm(`删除文件「${item.displayName}」?`)) return;
  await withError(async () => {
    await store.deleteFile(currentSelected, item.fileId);
    let nextPage = filesPage;
    if (files && files.items.length === 1 && filesPage > 1) { nextPage = filesPage - 1; setFilesPage(nextPage); }
    await loadFiles(nextPage, filesTag);
  });
}
async function handleDuplicateFile(args: { targetGroupId: number }) {
  if (!currentSelected || !duplicateFileSource) throw new Error('no file');
  let newFile = '';
  await withError(async () => {
    const res = await store.duplicateFile({
      fileId: duplicateFileSource.fileId, sourceGroupId: currentSelected, targetGroupId: args.targetGroupId,
    });
    newFile = res.fileId;
    setDuplicateFileOpen(false);
    setDuplicateFileSource(null);
    setFileToast(`已复制为「${res.fileId.slice(0, 8)}」`);
    await loadFiles(filesPage, filesTag);
  });
  return { newFile };
}

useEffect(() => {
  if (!fileToast) return;
  const t = setTimeout(() => setFileToast(null), 8000);
  return () => clearTimeout(t);
}, [fileToast]);
```

切组 effect 加 `setFiles(null); setFilesPage(1); setFilesTag(null); setUploadOpen(false); setDuplicateFileOpen(false); setDuplicateFileSource(null); setFilesError(null);`。

Tabs counts 加 `files: files?.total ?? null`。

渲染(view==='files'):

```tsx
<>
  <Files
    group={selectedGroup}
    files={files}
    loading={filesLoading}
    error={filesError}
    saving={saving}
    page={filesPage}
    pageSize={filesPageSize}
    selectedTag={filesTag}
    onPageChange={(p) => setFilesPage(p)}
    onTagChange={(t) => { setFilesTag(t); setFilesPage(1); }}
    onUpload={() => setUploadOpen(true)}
    onAccessLevelChange={handleAccessLevelChange}
    onDuplicate={(item) => { setDuplicateFileSource(item); setDuplicateFileOpen(true); }}
    onDelete={handleDeleteFile}
    onReload={() => loadFiles(filesPage, filesTag)}
  />
  <UploadFileModal
    open={uploadOpen}
    saving={saving}
    onUpload={handleUploadFile}
    onClose={() => setUploadOpen(false)}
  />
  <DuplicateFileModal
    open={duplicateFileOpen}
    sourceGroup={selectedGroup}
    sourceFile={duplicateFileSource}
    groups={safeGroups}
    saving={saving}
    onDuplicate={handleDuplicateFile}
    onClose={() => { setDuplicateFileOpen(false); setDuplicateFileSource(null); }}
  />
</>
```

### Step 9: Files.tsx(新建,镜像 Inventory)

`packages/react-components/src/user-space/src/pages/Files.tsx` —— 完整实现,镜像 Inventory.tsx 结构:
- Toolbar:tag select(从 `files.items` 收集)、刷新、「+ 上传文件」(`canWrite`)
- 表格列:预览(缩略图或 icon)/ displayName(fileId 截断)/ 类型(contentType)/ 大小(KB)/ tags/ 过期/ accessLevel(行内 select)/ actions
- accessLevel 行内 `<select>`:`onChange` → `onAccessLevelChange(file, value)`,disabled saving
- actions:⎘ 复制(canWrite)+ × 删除(`hasMinRole(myRole,'admin')`,confirm)
- 分页 foot(同 Inventory)

### Step 10: UploadFileModal.tsx

`packages/react-components/src/user-space/src/pages/UploadFileModal.tsx` —— 复用 `.sl-us-modal*` 样式(`document.body` portal,同 KvEditorModal):
- `<input type="file">`(accept 默认 all)
- tags `<input>`(逗号分隔)
- 显示选中文件名 + 大小预览
- 提交按钮 disabled:没选文件 / saving
- 调 `onUpload({ file, tags: tags.split(',').map(s=>s.trim()).filter(Boolean) })`

### Step 11: DuplicateFileModal.tsx

镜像 `DuplicateKvModal.tsx`(复用样式 + portal):
- 源文件只读(`displayName` + url)
- 目标组 `<select>`(排除源组 + `hasMinRole(g.myRole,'writer')`)
- 确认 disabled:没选目标组 / 源=目标

### Step 12: CSS 增量

`packages/react-components/src/user-space/index.css` 新增:

```css
.sl-us-file-thumb {
  width: 48px; height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
}
.sl-us-file-icon {
  width: 48px; height: 48px;
  display: grid; place-items: center;
  font-size: 22px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
}
.sl-us-cell-size { font-variant-numeric: tabular-nums; font-size: 12px; }
```

mobile 媒体查询不需额外覆盖(thumb 48px 已紧凑)。

### Step 13: 测试

**request.test.ts 补充 FormData 用例**(已有 `request.test.ts` 结构):
- FormData body 不被 JSON.stringify(断言 fd 字段存在)
- FormData 时不设 content-type(断言 fetch init.headers 没 content-type)
- JSON 路径不变(原有断言仍过)

**fileV1.test.ts 新建** —— 后端 stub:
- `upload` 组 FormData(fd 字段 + accessLevel=public + 显式 groupId)
- `list` query(tags 多值 / groupId / 分页)
- `info/patch/delete/duplicate`(路径 encodeURIComponent)

**createUserSpaceStore-file.test.ts 新建**:
- `uploadFile/listFiles(映射 isPreviewable+fileKind+displayName)/updateFileMeta/deleteFile/duplicateFile`

### Step 14: 验证 + commit

```bash
pnpm exec vitest run   # 363 + 新增 全过
pnpm exec eslint --max-warnings=0 apps/showcase/src/api/services/fileV1/ apps/showcase/src/api/components/user-space/ apps/showcase/__tests__/fileV1.test.ts apps/showcase/__tests__/createUserSpaceStore-file.test.ts packages/react-components/src/user-space/   # 干净
git add -A
git commit -m "$(cat <<'EOF'
feat(user-space): file tab — upload, list, delete, tag, duplicate

Frontend wiring for backend /api/v1/files (dev_ctr_hello file module).
request.ts gains FormData channel. fileV1 registry + HttpService
wrapper with 5 methods (upload/list/info/patch/delete/duplicate;
tag-facet YAGNI). createUserSpaceStore exposes 5 store methods.
New tab "文件" with Files.tsx (mirrors Inventory), UploadFileModal,
DuplicateFileModal. Delete is owner/admin only (hasMinRole 'admin').
Public + image files render thumbnail inline; others show type icon.
No backend changes (originalName omitted per user decision — list
shows fileId[:8] as display name).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

## 不做(避免越界)

- 不动后端(dev_ctr_hello 原 spec 的 originalName 用户决定跳过)
- 不做 share 短码(后端接口保留待后续)
- 不做 tag facet(列表内收集,与 KV 库存一致)
- 不做文件版本 / 恢复(file 域无 versions)
- 不做批量上传 / 批量操作
- 不动 resolveDefaultGroupId / 已有 KV / groups store 方法
- 不加图片上传进度条

## 风险

1. **`request.ts` FormData 检测顺序** —— `body instanceof FormData` 在某些 polyfill 环境可能不命中;Node 18+ / 现代浏览器 OK
2. **multipart boundary** —— 不能手动设 content-type,否则丢失 boundary 字符串 → 严格遵守 `body !== undefined && !isFormData ? { 'content-type': 'application/json' } : {}`
3. **File 类型** —— 浏览器 `<input type="file">` 的 `files[0]` 是 `File`(继承 `Blob`),`Blob` 类型即可
4. **accessLevel 修后端 405** —— 行内 select 改 accessLevel 时,后端 PATCH 接受 pointer 字段,nil=不改;但 select 永远发完整值(后端 controller 接收 pointer 字段,这里我们传对象 `{accessLevel: value}` —— 检查 `FilePatchArgs` 设计已对)
5. **mobile 表格宽度** —— 表格列多,`min-width` 需要设够(可能 640px);可继承现有 `.sl-us-table` mobile 横滚
6. **displayName 重复风险** —— 截断前 8 hex 在小数据集可能重复,但 32 hex 8 字符 → 16^8 = 2^32 几乎不可能碰撞

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\file-tab-report.md`:
- 状态、改动摘要、测试摘要、commit hash、顾虑

## 返回

状态、commit hash、测试摘要(363 + 新增)、顾虑。完成后再 `kvcli todo add` 跟进或 push。