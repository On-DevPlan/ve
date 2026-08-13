# user-space 文件下载(非图片) — 意图

> **状态:** 待用户确认;确认后交 `superpowers:writing-plans` 产出可执行计划。
> **对应任务:** `kvcli todo id=4, topic=ve, text=「支持文件的下载,不限制于图片」`,提交 2026-08-12。
> **前置计划:** `docs/superpowers/plans/2026-08-11-user-space-image-viewer-download.md`(图片 sm/hd 已落地,本任务是其后续)。

---

## Goal

让 user-space Files 视图里的**所有 fileKind**(image / text / other)都能通过 UI 触发同源下载,不再依赖手动复制 URL。图片行已有 ImageViewerModal 内的 sm/hd 下载按钮,保持不动。

## Non-Goals

- 不改后端(`/files/<id>` 已能流式返回原文件,带 `Content-Disposition`)。
- 不重做图片下载 UX(modal 的 sm/hd 双档保留)。
- 不引入下载进度条 / 大文件分块 / 续传(本期不做)。
- 不动 `.vue`、不动 store、不动后端、不动 nginx 配置。

## Background

### 现状(2026-08-12 验证)

- `Files.tsx` 行 actions 列当前只有 `复制`(writer+)和 `删除`(admin+)两个图标按钮。
- 预览列对 `isPreviewable`(public + image MIME)渲染 `<img>`,其他渲染 emoji 图标(`📄 text` / `📎 other`)。
- 点击非图片的图标/文件名 → **没有任何反应**,用户必须自取 URL 才能下载。
- `ImageViewerModal.tsx` 的 footer 提供 `缩略图 · size ⬇` 和 `高清图 · size ⬇` 两个 `<a download>`;只对图片生效。

### 关键验证

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `FileView.url` 是否同源? | 是 | `services/fileV1/index.ts` 不改写,前端组装 `FileView` 时(`createUserSpaceStore` → `toFileView`)经 `apps/showcase/src/api/tools/file-url.ts` 的 `resolveFileUrl()` 改写成 `/files/<fileId>`(保留 `?token=`) |
| 浏览器 `<a href={item.url} download>` 是否触发下载? | 是 | 同源 + 服务端 `Content-Disposition: attachment`,浏览器按 `download` 属性命名文件 |
| protected / private 文件下载受后端保护? | 是 | token 通过 query 传递,nginx `^~ /files/` 反代到后端;后端按 token + role 校验 200/403,与 list 行为一致 |
| 后端对非图片是否同样走 `/files/<id>`? | 是 | `/files/<id>` 是统一文件流路由,与 MIME 无关 |

## Approach

**行 actions 列新增 `下载` 图标按钮**,所有角色可见(reader+)。位置紧邻 `复制` 之前(下载是只读 → 复制 → 删除,从轻到重)。

**实现细节:**

1. **新 helper**:`downloadFilename(file: FileView): string`,返回 `<displayName><ext>`,ext 由 `contentType` 派生(复用 ImageViewerModal 的 `imageExt` 思路,扩展为通用 mime → ext 映射)。
   - `image/png` → `.png`,`application/pdf` → `.pdf`,`text/plain` → `.txt`,`application/zip` → `.zip`,等。
   - 兜底:`contentType` 缺失或未识别 → 不加扩展(Mac/Windows 浏览器会按 MIME 推断)。
2. **`Files.tsx` 行 actions** 增加一个 `<a class="sl-us-btn ... sl-us-btn--icon-sm" href={item.url} download={downloadFilename(item)} title="下载原文件" aria-label="下载">⬇</a>`。
   - 用 `<a>` 而非 `<button>`:语义即下载,中键可「另存为」,无需 JS 拦截。
   - 按钮无 `disabled`(与 list 权限对齐);后端 403 时浏览器自己处理(用户看到损坏文件,后端日志可见)。
   - 行 hover 显隐规则沿用现有 `.sl-us-table__row-actions` 样式(无需新 CSS)。
3. **测试**:新增 `apps/showcase/__tests__/download-filename.test.ts`,覆盖 mime 映射、空 contentType、显示名带空格等边界。
4. **回归**:现有图片 modal 流程不动。

## Touch List

| 类型 | 文件 |
| --- | --- |
| 修改 | `packages/react-components/src/user-space/src/pages/Files.tsx`(行 actions 加按钮 + 引 helper) |
| 修改 | `packages/react-components/src/user-space/index.css`(如有需要,沿用现有按钮 class,无新规则) |
| 新增 | `packages/react-components/src/user-space/src/pages/downloadFilename.ts`(helper,单测覆盖) |
| 新增 | `apps/showcase/__tests__/download-filename.test.ts` |

## Acceptance Criteria

- [ ] Files 表格每行 actions 出现 `⬇` 按钮,reader/owner/admin/writer 都看到(无 role gating)。
- [ ] 点击 `⬇` → 浏览器下载原文件,文件名 = `<displayName><ext>`,扩展由 MIME 决定。
- [ ] 非图片(text/other)的下载按钮工作流与图片的 `高清图` 按钮**等价**(同源请求 + `download` 属性)。
- [ ] 图片行的现有 ImageViewerModal sm/hd 行为不变。
- [ ] `pnpm exec vitest run` 全绿(含新增单测)。
- [ ] `pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space` 干净。

## Risks

| 风险 | 缓解 |
| --- | --- |
| protected/private 文件 query 中的 token 泄漏到 referer | 同源请求 referer 默认同 origin,服务端可控;无需前端额外处理 |
| 极大文件(>1GB)下载卡住 UI | `<a download>` 是浏览器原生导航,不阻塞 React;若需监控再考虑后续 |
| `<a>` vs `<button>` 的可访问性差异 | 加 `aria-label="下载"`,屏幕阅读器朗读「下载」 |

## Out of Scope(留给未来)

- 批量下载(多选 + zip 打包)
- 下载历史 / 计数
- 服务端 `Content-Disposition` 强制名(目前依赖前端 `download` 属性,服务端若加 disposition,文件名优先级变化需复核)
- 预览 PDF / 视频行内