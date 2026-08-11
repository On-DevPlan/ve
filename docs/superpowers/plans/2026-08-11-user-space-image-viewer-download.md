# user-space 图片查看器 + 双版本下载 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击文件缩略图弹出 modal 放大显示高清图;modal 底部提供「缩略图(sm)/高清图(lg)」两个下载按钮,各标注字节大小。

**Architecture:** 复用现有 `.sl-us-modal*` 样式 + `createPortal` 模式(同 DuplicateFileModal)。新建只读 `ImageViewerModal` 组件,`Files.tsx` 用本地 state 控制打开/关闭;`ThumbImg` 从「就地切换 src」改为「点击打开 modal」,移除 48×48 就地切换逻辑(评审已指出它并不真正放大图片)。

**Tech Stack:** React 19 + TypeScript + CSS(单一 adopted stylesheet)+ `createPortal`。

## Global Constraints

- 分支:`fix/user-space-mobile-thumbnail`;不 push、不开 PR。
- Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 不动任何 `.vue`、不动后端、不动 store 逻辑。
- 缩略图 URL 已在 `toFileView` 经 `resolveFileUrl` 改写为**同源相对路径**(`/files/<id>?level=sm`)→ 同源 `<a download>` 可正常触发下载。
- 高清图 = `lg` 档;`lg` 缺失回退原图 `url`。下载两个版本 = `sm` + `lg`。
- 文件大小标注用后端 `thumbnails[].size`(字节)。

---

### Task 1: ImageViewerModal + Files.tsx 接线 + CSS

**Files:**
- Create: `packages/react-components/src/user-space/src/pages/ImageViewerModal.tsx`
- Modify: `packages/react-components/src/user-space/src/pages/Files.tsx`
- Modify: `packages/react-components/src/user-space/index.css`

**Interfaces:**
- Produces: `ImageViewerModal` 组件,props `{ file: FileView | null; onClose: () => void }`;`null` = 关闭。
- Consumes: `FileView`(含 `displayName` / `url` / `contentType` / `size` / `thumbnails?`)、`FileThumbnail`(`level` / `size` / `url`)。

- [ ] **Step 1: 新建 `ImageViewerModal.tsx`**

```tsx
// pages/ImageViewerModal.tsx —— 点击文件缩略图打开的看图 modal。
//
// 设计:复用 .sl-us-modal* 样式 + portal 模式(同 DuplicateFileModal)。
// 展示:大图(优先 lg 高清档,缺失退原图)+ 底部两个下载按钮:
//   缩略图(sm) / 高清图(lg),各标注字节大小(size 字段来自后端 thumbnails)。
// 关闭:backdrop 点击 / 右上角 × / Escape。

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FileView } from '@api/components/user-space';

export interface ImageViewerModalProps {
  /** null = 关闭;非 null = 展示该文件的大图 + 下载项。 */
  file: FileView | null;
  onClose: () => void;
}

/** 字节数 → 人类可读(B / KB / MB)。与 Files.tsx 本地副本一致。 */
function formatSize(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** image/png → png;拿不到就回退 .img。 */
function imageExt(contentType: string | undefined): string {
  if (!contentType) return '.img';
  const mime = contentType.split('/');
  return mime.length === 2 && mime[1] ? `.${mime[1]}` : '.img';
}

export default function ImageViewerModal({ file, onClose }: ImageViewerModalProps) {
  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const portalRoot =
    (typeof document !== 'undefined' && document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);

  const sm = file.thumbnails?.find((t) => t.level === 'sm');
  const lg = file.thumbnails?.find((t) => t.level === 'lg');
  // 高清图:优先 lg 档;后端没给 lg 就用原图。
  const hdUrl = lg?.url ?? file.url;
  const hdSize = lg?.size ?? file.size;
  const ext = imageExt(file.contentType);

  const node = (
    <div className="sl-us-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="sl-us-modal"
        style={{ width: 'min(720px, 94vw)' }}
        role="dialog"
        aria-label={`查看图片 ${file.displayName}`}
      >
        <header className="sl-us-modal__head">
          <h3 className="sl-us-modal__title">{file.displayName}</h3>
          <button
            className="sl-us-btn sl-us-btn--ghost sl-us-btn--icon-sm"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="sl-us-modal__body sl-us-image-viewer__body">
          <img
            className="sl-us-image-viewer__img"
            src={hdUrl}
            alt={file.displayName}
          />
        </div>
        <footer className="sl-us-modal__foot sl-us-image-viewer__foot">
          {sm && (
            <a
              className="sl-us-btn sl-us-btn--ghost"
              href={sm.url}
              download={`${file.displayName}-sm${ext}`}
              title="下载 sm 缩略图"
            >
              缩略图 · {formatSize(sm.size)} ⬇
            </a>
          )}
          <a
            className="sl-us-btn sl-us-btn--primary"
            href={hdUrl}
            download={`${file.displayName}-hd${ext}`}
            title="下载高清图"
          >
            高清图 · {formatSize(hdSize)} ⬇
          </a>
        </footer>
      </div>
    </div>
  );

  if (!portalRoot) return null;
  return createPortal(node, portalRoot);
}
```

- [ ] **Step 2: 改 `Files.tsx` 的 `ThumbImg`(移除就地切换,加 `onPreview`)**

把第 100-137 行的 `ThumbImg` 整体替换为(注意 `src` 不再是 state,`onPreview` 为新增 prop):

```tsx
interface ThumbImgProps {
  url: string;             // 原图(兜底 / 高清源)
  thumbnails?: FileThumbnail[];
  alt: string;
  /** 点击缩略图 → 打开看图 modal(父级管 state)。 */
  onPreview: () => void;
}

function ThumbImg({ url, thumbnails, alt, onPreview }: ThumbImgProps) {
  const sm = thumbnails?.find((t) => t.level === 'sm');
  // 默认显示 sm 缩略图;sm 缺失则退到原图
  const src = sm?.url ?? url;
  return (
    <img
      className="sl-us-file-thumb"
      src={src}
      data-src={src}
      data-full={url}
      alt={alt}
      loading="lazy"
      onClick={onPreview}
      title="点击放大"
    />
  );
}
```

- [ ] **Step 3: `Files.tsx` 加打开 state + 接线**

组件函数顶部(第一个 `useMemo` 之前)加:

```tsx
// 当前放大预览的文件(null = 关闭)。
const [previewFile, setPreviewFile] = useState<FileView | null>(null);
```

`FileView` 类型已在文件顶部 import(现有 props 用到),确认一下即可。文件顶部 import 区加:

```tsx
import ImageViewerModal from './ImageViewerModal';
```

行 220 的 `<ThumbImg>` 调用处加 `onPreview`:

```tsx
<ThumbImg
  url={item.url}
  thumbnails={item.thumbnails}
  alt={item.displayName}
  onPreview={() => setPreviewFile(item)}
/>
```

组件返回 JSX 的**最外层 `<div>` 闭合前**(`Files` 的 return 末尾)加:

```tsx
<ImageViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />
```

- [ ] **Step 4: `index.css` 移除死规则 + 新增看图样式**

a) 删除 `.sl-us-file-thumb[data-state="full"] { cursor: zoom-out; }` 整块(就地切换已移除,`data-state` 不再产生;`.sl-us-file-thumb` 保留 `cursor: zoom-in`)。

b) 在 `.sl-us-modal*` 样式块之后新增:

```css
/* 看图 modal:大图自适应 + 底部下载区 */
.sl-us-image-viewer__body {
  align-items: center;
  padding: 12px;
}
.sl-us-image-viewer__img {
  max-width: 100%;
  max-height: 62vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
}
.sl-us-image-viewer__foot {
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}
.sl-us-image-viewer__foot a {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
```

若 `.sl-us-btn` 基础规则本身已含 `display: inline-flex`,`.sl-us-image-viewer__foot a` 里可省去,但保留 `text-decoration: none`。

- [ ] **Step 5: 跑测试 + lint**

```bash
pnpm exec vitest run
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/src/pages/ImageViewerModal.tsx packages/react-components/src/user-space/src/pages/Files.tsx
```
预期:56 files / 417 tests 全绿;ESLint 干净(CSS 无 lint 规则,沿用现有认知)。

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/user-space/src/pages/ImageViewerModal.tsx packages/react-components/src/user-space/src/pages/Files.tsx packages/react-components/src/user-space/index.css
git commit -m "feat(user-space): image viewer modal + sm/hd download buttons

Clicking a file thumbnail opens a modal showing the HD image (lg level,
falling back to the original file URL). The modal footer offers two
download buttons — thumbnail (sm) and HD (lg) — each labeled with its
byte size from the backend thumbnails metadata. Replaces the previous
in-place click-to-toggle behavior (48x48 src swap), which the review
flagged as not actually enlarging the image.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: 手工验证清单(留给用户真机)**

- 点击缩略图 → modal 弹出,显示 lg 大图(1600×900);缩略图不再就地变大。
- 没有 lg(存量文件,`thumbnails` 为空)→ 显示原图,缩略图按钮不渲染,高清图按钮回退原图 + 原图 size。
- 点「缩略图 · 37.1 KB」→ 浏览器下载 `<displayName>-sm.png`(同源 `?level=sm`)。
- 点「高清图 · 595.6 KB」→ 下载 `<displayName>-hd.png`。
- backdrop / × / Escape 三路关闭都生效;移动端 ≤640px modal 不溢出。
