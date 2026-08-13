# user-space 文件下载(非图片) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** user-space Files 视图所有 fileKind 的行都补一个原生下载按钮(同源 `<a download>`),非图片(text/pdf/zip/视频/其它)能直接下载原文件;图片行的现有 ImageViewerModal sm/hd 流程不动。

**Architecture:** 抽一个纯 helper `downloadFilename(file)` 负责 mime → 扩展名映射(可单测);在 `Files.tsx` 行 `row-actions` 前面插入一个 `<a download>` 锚点,href 直接用 `FileView.url`(已被 `resolveFileUrl` 改写成同源 `/files/<id>`,对 protected/private 也保留 `?token=`),`download` 属性由 helper 派生。无新 CSS、无 store 改动、无后端改动。

**Tech Stack:** React 19 + TypeScript + vitest;沿用现有 `.sl-us-btn .sl-us-btn--ghost .sl-us-btn--icon-sm` 样式。

## Global Constraints

- 分支:`feat/user-space-file-download`(基于 `main`);不 push、不开 PR。
- Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 不动任何 `.vue`、不动后端、不动 store、不动 nginx 配置、不动 `ImageViewerModal`。
- `FileView.url` 已经在 `createUserSpaceStore → toFileView` 阶段被 `resolveFileUrl()` 改写为同源相对路径(`/files/<id>`,对 protected/private 保留 `?token=`),无需前端额外加工。
- 测试环境:`packages/react-components` workspace(jsdom);helper 是纯函数,无 DOM 依赖。

---

### Task 1: `downloadFilename` helper + 单测

**Files:**
- Create: `packages/react-components/src/user-space/src/pages/downloadFilename.ts`
- Create: `packages/react-components/__tests__/download-filename.test.ts`

**Interfaces:**
- Produces: `downloadFilename(file: { displayName: string; contentType: string }): string` —— 返回 `<displayName><ext>`,未知 mime 不带扩展。
- Consumes: 形参对象(只读 `displayName` + `contentType`),无副作用,可纯函数单测。

- [ ] **Step 1: 写失败的测试**

`packages/react-components/__tests__/download-filename.test.ts`:

```ts
// downloadFilename 单测 —— 锁住 mime → 扩展名映射 + displayName 透传 + 未知 mime 兜底。
//
// 背景:Files.tsx 行下载按钮的 <a download="..."> 文件名派生。当前所有 fileKind
// 都过这里,所以覆盖度要够:常见 image / 文档 / 压缩 / 视频 / 文本都打到,
// 未知 mime 和缺失 mime 走"不加扩展"分支。

import { describe, it, expect } from 'vitest';
import { downloadFilename } from '../src/user-space/src/pages/downloadFilename';

describe('downloadFilename', () => {
  it('appends .png for image/png', () => {
    expect(downloadFilename({ displayName: 'abc12345', contentType: 'image/png' })).toBe('abc12345.png');
  });

  it('appends .jpeg for image/jpeg', () => {
    expect(downloadFilename({ displayName: 'shot', contentType: 'image/jpeg' })).toBe('shot.jpeg');
  });

  it('appends .webp for image/webp', () => {
    expect(downloadFilename({ displayName: 'hero', contentType: 'image/webp' })).toBe('hero.webp');
  });

  it('appends .svg for image/svg+xml', () => {
    expect(downloadFilename({ displayName: 'logo', contentType: 'image/svg+xml' })).toBe('logo.svg');
  });

  it('appends .pdf for application/pdf', () => {
    expect(downloadFilename({ displayName: 'report', contentType: 'application/pdf' })).toBe('report.pdf');
  });

  it('appends .txt for text/plain', () => {
    expect(downloadFilename({ displayName: 'notes', contentType: 'text/plain' })).toBe('notes.txt');
  });

  it('appends .md for text/markdown', () => {
    expect(downloadFilename({ displayName: 'readme', contentType: 'text/markdown' })).toBe('readme.md');
  });

  it('appends .csv for text/csv', () => {
    expect(downloadFilename({ displayName: 'data', contentType: 'text/csv' })).toBe('data.csv');
  });

  it('appends .json for application/json', () => {
    expect(downloadFilename({ displayName: 'pkg', contentType: 'application/json' })).toBe('pkg.json');
  });

  it('appends .zip for application/zip', () => {
    expect(downloadFilename({ displayName: 'bundle', contentType: 'application/zip' })).toBe('bundle.zip');
  });

  it('appends .mp4 for video/mp4', () => {
    expect(downloadFilename({ displayName: 'clip', contentType: 'video/mp4' })).toBe('clip.mp4');
  });

  it('appends .mp3 for audio/mpeg', () => {
    expect(downloadFilename({ displayName: 'song', contentType: 'audio/mpeg' })).toBe('song.mp3');
  });

  it('appends .docx for openxml word', () => {
    expect(downloadFilename({ displayName: 'doc', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('doc.docx');
  });

  it('appends .xlsx for openxml excel', () => {
    expect(downloadFilename({ displayName: 'sheet', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe('sheet.xlsx');
  });

  it('preserves spaces in displayName', () => {
    expect(downloadFilename({ displayName: 'my report', contentType: 'application/pdf' })).toBe('my report.pdf');
  });

  it('returns displayName unchanged for unknown mime', () => {
    expect(downloadFilename({ displayName: 'blob', contentType: 'application/x-mystery' })).toBe('blob');
  });

  it('returns displayName unchanged when contentType is empty', () => {
    expect(downloadFilename({ displayName: 'mystery', contentType: '' })).toBe('mystery');
  });

  it('handles mime with charset suffix (text/plain; charset=utf-8)', () => {
    expect(downloadFilename({ displayName: 'log', contentType: 'text/plain; charset=utf-8' })).toBe('log.txt');
  });

  it('handles unknown image subtype gracefully', () => {
    // 没列出的 image 子类(如 image/heic)兜底不加扩展;避免错贴 .img 这种错名
    expect(downloadFilename({ displayName: 'raw', contentType: 'image/heic' })).toBe('raw');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run packages/react-components/__tests__/download-filename.test.ts
```

预期:FAIL —— `Failed to resolve import "../src/user-space/src/pages/downloadFilename"`(模块不存在)。

- [ ] **Step 3: 实现 `downloadFilename`**

`packages/react-components/src/user-space/src/pages/downloadFilename.ts`:

```ts
// downloadFilename —— 给 <a download="..."> 派生文件名 = displayName + 扩展。
//
// Files.tsx 行下载按钮使用。规则:
//   - 从 contentType 取「type/subtype」前缀,查表得到 `.ext`。
//   - 未命中(未知 / 缺失 / 含 charset 等参数) → 不加扩展,保留 displayName。
//   - 浏览器遇到没扩展 + 同源响应,会用 Content-Disposition 或 MIME 推断默认名;
//     我们不强行补 `.img` / `.bin` 之类的错名,免得误导用户。
//
// 覆盖范围:常见 image / 文档 / 表格 / 演示 / 压缩 / 视频 / 音频 / 文本。
// 不在本期:application/octet-stream(刻意不映射,交给浏览器 / 后端 disposition)。

interface FileLike {
  displayName: string;
  contentType: string;
}

/** 主 mime(type/subtype) → 文件扩展名。命中失败不抛错,返回空字符串。 */
const MIME_EXT: Readonly<Record<string, string>> = {
  // images
  'image/png': '.png',
  'image/jpeg': '.jpeg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  // documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  // text
  'text/plain': '.txt',
  'text/html': '.html',
  'text/css': '.css',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'text/xml': '.xml',
  // data
  'application/json': '.json',
  'application/xml': '.xml',
  // archives
  'application/zip': '.zip',
  'application/x-tar': '.tar',
  'application/gzip': '.gz',
  // media
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
};

/**
 * 给 <a download="..."> 派生文件名。
 *
 * @param file  - 至少包含 displayName + contentType(只读)。
 * @returns `<displayName><ext>`;未知 mime 返回原 displayName。
 *
 * @example
 *   downloadFilename({ displayName: 'abc12345', contentType: 'image/png' })
 *   // → 'abc12345.png'
 *   downloadFilename({ displayName: 'blob', contentType: 'application/octet-stream' })
 *   // → 'blob'
 */
export function downloadFilename(file: FileLike): string {
  const ct = (file.contentType ?? '').trim().toLowerCase();
  if (!ct) return file.displayName;
  // 去掉 "; charset=..." 等参数,只留 type/subtype 主段
  const main = ct.split(';')[0]?.trim() ?? '';
  const ext = MIME_EXT[main];
  return ext ? `${file.displayName}${ext}` : file.displayName;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run packages/react-components/__tests__/download-filename.test.ts
```

预期:PASS —— 19 个 case 全绿。

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/user-space/src/pages/downloadFilename.ts packages/react-components/__tests__/download-filename.test.ts
git commit -m "feat(user-space): add downloadFilename helper with mime → ext map

Pure helper used by Files.tsx row download buttons to derive the
<a download=\"...\"> filename from FileView.displayName + contentType.
Covers common image / document / archive / video / audio MIME types;
falls back to displayName unchanged for unknown or empty content types
(no spurious .img/.bin suffixes).

19 unit tests in packages/react-components/__tests__ lock the mapping
plus edge cases (charset suffix, missing contentType, spaces in name).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Files.tsx 行下载按钮接线

**Files:**
- Modify: `packages/react-components/src/user-space/src/pages/Files.tsx`

**Interfaces:**
- Consumes: `FileView`(`@api/components/user-space` 已有)、`downloadFilename(file)`(Task 1 新增)。
- Produces: 每个文件行 `row-actions` 渲染一个 `<a download>` 按钮(可见性沿用现有 hover-only 容器,无 role gating)。

- [ ] **Step 1: 改 `Files.tsx` —— import helper + 加下载按钮**

在 `Files.tsx` 顶部 import 区(在 `import ImageViewerModal from './ImageViewerModal';` **后面**)加:

```tsx
import { downloadFilename } from './downloadFilename';
```

把第 256-281 行的 `<div className="sl-us-table__row-actions">...</div>` 整块替换为:

```tsx
<td>
  <div className="sl-us-table__row-actions">
    {/* 原文件下载:所有 fileKind 都支持。FileView.url 已被 resolveFileUrl
        改写成同源 /files/<id>(protected/private 保留 ?token=)。
        文件名由 contentType 派生扩展;未知 mime 走 downloadFilename 兜底
        (不加扩展,交给浏览器按 MIME 推断)。 */}
    <a
      className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
      href={item.url}
      download={downloadFilename(item)}
      title="下载原文件"
      aria-label={`下载 ${item.displayName}`}
    >
      ⬇
    </a>
    {canWrite && (
      <button
        className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
        disabled={saving}
        onClick={() => onDuplicate(item)}
        title="复制到其他工作空间"
        aria-label="复制"
      >
        ⎘
      </button>
    )}
    {canDelete && (
      <button
        className="sl-us-btn sl-us-btn--danger-ghost sl-us-btn--icon-sm"
        disabled={saving}
        onClick={() => onDelete(item)}
        title="删除"
        aria-label="删除"
      >
        ×
      </button>
    )}
  </div>
</td>
```

> 注意:`{canWrite && ...}` 和 `{canDelete && ...}` 块内容与原文件完全一致,只是把它们和外层 `<a>` 一起放进同一个 `<div className="sl-us-table__row-actions">` 里。**确认操作:Edit 的 old_string 必须精确匹配原文件那段 `<td>...</td>` 整块(第 256-281 行);不要只替换 `<div className=...">..."` 的内部。**

- [ ] **Step 2: 跑全套 vitest 确认无回归**

```bash
pnpm exec vitest run
```

预期:全绿(react-components + showcase + 其他 workspace);`download-filename.test.ts` 19 个 case PASS。

- [ ] **Step 3: 跑 lint**

```bash
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/src/pages/Files.tsx packages/react-components/src/user-space/src/pages/downloadFilename.ts packages/react-components/__tests__/download-filename.test.ts
```

预期:0 error / 0 warning。

- [ ] **Step 4: Commit**

```bash
git add packages/react-components/src/user-space/src/pages/Files.tsx
git commit -m "feat(user-space): row-level download button for all file kinds

Adds an <a download> to every Files.tsx row in row-actions, sitting
before the existing 复制 / 删除 buttons. The href uses FileView.url,
which is already rewritten to a same-origin /files/<id> path by
resolveFileUrl (protected/private files preserve ?token=), so a single
<a href download> triggers a browser-native download for images, text,
archives, video, audio, and any other fileKind — closing the gap that
non-image files had no UI affordance at all.

Image rows keep their existing ImageViewerModal sm/hd flow unchanged.
No role gating on the download button: visible to reader+ since reading
the file URL is already in the page payload for any role that can list.

No backend, store, .vue, or nginx changes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 手工验证清单(留给用户真机)

- [ ] **图片行** —— 预览列点击缩略图 → ImageViewerModal 弹出,sm/hd 下载按钮照旧;**新增** ⬇ 行按钮下载 `<displayName>-sm.png` / `<displayName>-hd.png`(走 ImageViewerModal 内还是行按钮都行,两者并存)。
- [ ] **非图片行(text/plain)** —— 点 ⬇ 行按钮 → 浏览器下载 `xxxxxxxx.txt`(displayName + `.txt`)。
- [ ] **非图片行(application/pdf)** —— 点 ⬇ → 下载 `xxxxxxxx.pdf`。
- [ ] **非图片行(application/zip)** —— 点 ⬇ → 下载 `xxxxxxxx.zip`,浏览器显示下载进度。
- [ ] **非图片行(image/heic 等未列出的 mime)** —— 点 ⬇ → 下载文件名 = displayName(无扩展),浏览器按 MIME 推断默认行为。
- [ ] **reader 角色** —— 仍能看到 ⬇ 行按钮,但 复制 不可见(只 writer+)、删 不可见(只 admin+)。
- [ ] **protected / private 文件** —— ⬇ 行按钮的 href 含 token,后端校验 200;token 缺失 → 浏览器下载损坏文件(后端 403 行为与 list 一致,UI 无新增错误提示)。
- [ ] **hover 行** —— ⬇ 按钮仅在 hover 行时显示(沿用现有 `.sl-us-table__row-actions` 样式,无新 CSS)。
- [ ] **移动端(≤640px)** —— 行 actions 在窄屏仍可达,按钮不溢出表格。