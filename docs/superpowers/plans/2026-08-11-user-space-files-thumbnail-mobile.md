# user-space Files.tsx 缩略图 + 移动端可操作性 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. user-space 文件列表的图片行默认渲染 `?level=sm` 缩略图（`data-src`），点击图片切换到原图 (`data-full`)，再点切回 sm；非图片/无缩略图文件保持图标。
2. 修复 user-space 在移动端 ≤640px viewport 下「无法操作」的具体故障（先排查清单，再定向修）。

**Architecture:**
- 缩略图字段沿用 `dev_ctr_hello user-file-invitecode` 后端契约（`thumbnails: [{level, width, height, size, contentType, url}]`），ve 端在 `FileInfo` / `FileView` 加 `thumbnails?` 可选字段 + `toFileView` 透传。`Files.tsx` 改 `<img data-src data-full>` + 命中 `IntersectionObserver` 时懒加载；点击行图片切 `src`。
- 移动端故障排查：写一个 Playwright 脚本以 iPhone 13 viewport（390×844）跑 showcase 入口 → 登 → 进 user-space → 5 个 tab 各跑一遍核心动作 → 输出失败/控制台/网络快照。失败清单出来后再起 task 修具体故障。

**Tech Stack:** React + TypeScript + Vitest + ESLint（既有）；Playwright（新增，仅 devDep）。

## Global Constraints

- 分支：`fix/user-space-mobile-thumbnail`（基于 `origin/main` 拉）；不 push、不开 PR，等用户拍板
- Conventional Commits；commit 末尾附 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 单一职责：每个 task 只改一类文件（type / store / UI / CSS / 排查 / 修复）
- 不重构既有代码；不动业务逻辑；不动后端；不动 showcase 应用入口
- 不动 Vue 部分（`PointDetail.vue` 虽也有 thumbnail 字样，但其 `images: string[]` 与 file-server 缩略图无关，不在本次范围）
- 缩略图 URL 走现有 `resolveFileUrl(info.url)` / `resolveFileUrl(t.url)`，不另开工具
- 文件缩略图点击交互只用 React 本地 state（`isFull` per item），不用 store
- lint clean；`pnpm exec vitest run` 全过（baseline 347 + 新增若干）
- 移动端排查失败清单（task 2 输出）不要求"全绿"，只要求"识别出哪些动作/控件在 ≤640px 不可用"

---

## Task 1: `FileInfo` / `FileView` 加 `thumbnails?` 字段

**Files:**
- Modify: `apps/showcase/src/api/services/fileV1/types.ts:11-29` — `FileInfo` 加 `thumbnails?: FileThumbnail[]`
- Modify: `apps/showcase/src/api/services/fileV1/index.ts:29-39` — re-export `FileThumbnail`
- Modify: `apps/showcase/src/api/components/user-space/types.ts:78-95` — `FileView` 加 `thumbnails?: FileThumbnail[]`
- Modify: `apps/showcase/src/api/components/user-space/types.ts:18` — 透传 type
- Test: `apps/showcase/__tests__/createUserSpaceStore-file.test.ts:42-56` — 扩 fixture + 1 个新断言

**Interfaces:**
- Consumes: dev_ctr_hello 后端契约 `thumbnails: [{level: 'sm'|'md'|'lg', width, height, size, contentType, url}]`（见 `dev_ctr_hello/.claude/skills/user-file-invitecode/references/client-api.md` §3.1）
- Produces: `FileThumbnail` 单一类型定义（`apps/showcase/src/api/services/fileV1/types.ts`），被 `FileInfo.thumbnails` 和 `FileView.thumbnails` 共用

- [ ] **Step 1: 在 `fileV1/types.ts` 加 `FileThumbnail` 类型 + `FileInfo.thumbnails?` 字段**

```ts
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

export interface FileInfo {
  // ... 既有字段 ...
  thumbnails?: FileThumbnail[];   // 老文件 / 非图片 / md5 dedup 命中 → undefined
}
```

- [ ] **Step 2: 在 `fileV1/index.ts` re-export `FileThumbnail`**

```ts
export type { FileInfo, FileListResponse, ..., FileThumbnail } from './types';
```

- [ ] **Step 3: 在 `components/user-space/types.ts` 透传 `FileThumbnail` + 加到 `FileView`**

```ts
import type { FileAccessLevel, FileDuplicateArgs, FileDuplicateResponse, FileThumbnail } from '../../services/fileV1/types';

export type { ..., FileThumbnail } from '../../services/fileV1/types';

export interface FileView {
  // ... 既有字段 ...
  thumbnails?: FileThumbnail[];   // 见 toFileView 透传
}
```

- [ ] **Step 4: 扩单测 fixture + 新断言（`createUserSpaceStore-file.test.ts`）**

扩 `FILE_FULL` fixture：
```ts
const FILE_FULL = {
  // ... 既有 ...
  thumbnails: [
    { level: 'sm', width: 300, height: 200, size: 1234, contentType: 'image/jpeg', url: 'https://cdn.example.com/abc12345?level=sm' },
    { level: 'md', width: 800, height: 533, size: 5678, contentType: 'image/jpeg', url: 'https://cdn.example.com/abc12345?level=md' },
  ],
};
```

新增断言（追加到 `describe('user-space store file CRUD', ...)` 末尾）：
```ts
it('listFiles preserves thumbnails in FileView', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    okBody({ items: [FILE_FULL], total: 1 }),
  );
  const store = createUserSpaceStore();
  const result = await store.listFiles(42, { page: 1, pageSize: 10 });
  expect(result.items[0].thumbnails).toEqual(FILE_FULL.thumbnails);
  expect(result.items[0].thumbnails?.[0].level).toBe('sm');
});

it('listFiles tolerates thumbnails undefined (old files / non-image)', async () => {
  const { thumbnails: _omit, ...noThumbs } = FILE_FULL;
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    okBody({ items: [noThumbs], total: 1 }),
  );
  const store = createUserSpaceStore();
  const result = await store.listFiles(42, { page: 1, pageSize: 10 });
  expect(result.items[0].thumbnails).toBeUndefined();
});
```

- [ ] **Step 5: 跑单测验证通过**

```bash
cd D:/DevProjects/my/github/ve
pnpm exec vitest run apps/showcase/__tests__/createUserSpaceStore-file.test.ts
```
预期：全部 pass（含新增 2 个）

- [ ] **Step 6: commit**

```bash
git add apps/showcase/src/api/services/fileV1/types.ts \
        apps/showcase/src/api/services/fileV1/index.ts \
        apps/showcase/src/api/components/user-space/types.ts \
        apps/showcase/__tests__/createUserSpaceStore-file.test.ts
git commit -m "$(cat <<'EOF'
feat(user-space): expose backend thumbnails metadata on FileView

FileInfo/FileView gain optional thumbnails: FileThumbnail[] mirroring
dev_ctr_hello backend contract (sm/md/lg levels with pre-built URLs).
Undefined for non-image / md5-dedup hit / pre-2026-08-10 files.
No behavior change yet — UI wiring lands in next commit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `toFileView` 透传 `thumbnails` + URL 经 `resolveFileUrl` 改写

**Files:**
- Modify: `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts:108-135` — `toFileView` 透传 `thumbnails`（URL 也要经 `resolveFileUrl`）
- Test: 复用 Task 1 单测 + 新增 1 个

**Interfaces:**
- Consumes: `FileInfo.thumbnails?: FileThumbnail[]`、`resolveFileUrl(url)`（同文件已 import）
- Produces: `FileView.thumbnails` 中每个 `url` 都经 `resolveFileUrl`（与父 `url` 字段一致处理）

- [ ] **Step 1: 改 `toFileView`（`createUserSpaceStore.ts:108-135`）**

把 `toFileView` 改为：
```ts
function toFileView(info: FileInfo): FileView {
  const thumbnails = info.thumbnails?.map((t) => ({
    level: t.level,
    width: t.width,
    height: t.height,
    size: t.size,
    contentType: t.contentType,
    url: resolveFileUrl(t.url),
  }));
  return {
    fileId: info.fileId,
    url: resolveFileUrl(info.url),
    displayName: info.fileId.slice(0, 8),
    accessLevel: info.accessLevel,
    size: info.size,
    contentType: info.contentType,
    groupId: info.groupId,
    groupName: info.groupName,
    myRole: info.myRole,
    tags: info.tags ?? [],
    md5: info.md5,
    sha256: info.sha256,
    createdAt: info.createdAt,
    expireAt: info.expireAt,
    isPreviewable: info.accessLevel === 'public' && info.contentType.startsWith('image/'),
    fileKind: info.contentType.startsWith('image/')
      ? 'image'
      : info.contentType.startsWith('text/')
        ? 'text'
        : 'other',
    thumbnails,
  };
}
```

> ⚠️ **`url: resolveFileUrl(t.url)` 必须**：后端给的缩略图 URL 含 `https://cdn...` 时（dev_ctr_hello prod 部署），前端要剥 origin 走同源；与父 `url` 字段同处理。`resolveFileUrl` 已在文件顶部 import。

- [ ] **Step 2: 扩单测（`createUserSpaceStore-file.test.ts`）—— thumbnail URL 走 resolveFileUrl**

新增断言：
```ts
it('thumbnail URLs are run through resolveFileUrl (strip backend origin)', async () => {
  // 模拟 resolveFileUrl 的行为：把 https://cdn.example.com/abc?level=sm 剥成 /files/abc?level=sm
  // 此测试只校验 toFileView 后 url 不含 'cdn.example.com'
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(okBody(FILE_FULL));
  const store = createUserSpaceStore();
  const result = await store.listFiles(42, { page: 1, pageSize: 10 });
  const sm = result.items[0].thumbnails?.find((t) => t.level === 'sm');
  expect(sm?.url).toBeDefined();
  expect(sm?.url).not.toContain('cdn.example.com');
  expect(sm?.url).toMatch(/level=sm/);
});
```

> 注：`resolveFileUrl` 的具体行为是「保留路径剥 origin」—— 见 `apps/showcase/src/api/tools/file-url.ts`；单测只断言结果 URL 不含 `cdn.example.com` 且保留 query。

- [ ] **Step 3: 跑单测**

```bash
pnpm exec vitest run apps/showcase/__tests__/createUserSpaceStore-file.test.ts
```
预期：全部 pass

- [ ] **Step 4: 跑全量单测（确认无回归）**

```bash
pnpm exec vitest run
```
预期：347 + 新增 3 = 350 全过

- [ ] **Step 5: commit**

```bash
git add apps/showcase/src/api/components/user-space/createUserSpaceStore.ts \
        apps/showcase/__tests__/createUserSpaceStore-file.test.ts
git commit -m "$(cat <<'EOF'
feat(user-space): thread thumbnails through toFileView + strip origin

toFileView now passes info.thumbnails through, routing every thumbnail
url through resolveFileUrl so /files/<fileId>?level=sm stays same-origin
under HTTPS deploy (mirrors the parent url field). No UI change yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `Files.tsx` 改 `<img data-src data-full>` + 点击切换

**Files:**
- Modify: `packages/react-components/src/user-space/src/pages/Files.tsx:172-187` — 替换缩略图 `<img>` 为带 state 的可点击元素
- Modify: `packages/react-components/src/user-space/index.css`（查找 `.sl-us-file-thumb` 类，加 max-width + cursor: zoom-in / zoom-out）
- Modify: `packages/react-components/src/user-space/src/pages/Files.tsx:13-15` — 必要时 import `useState`

**Interfaces:**
- Consumes: `FileView.thumbnails?: FileThumbnail[]`、`FileView.url`（原图）、`FileView.isPreviewable`、`FileView.fileKind`、`FileView.displayName`
- Produces: 列表行 `<img>` 元素：默认 `src = thumbnails.find(level==='sm')?.url ?? url`；首次点击切到 `data-full`；再次点击切回 sm

- [ ] **Step 1: 改 `Files.tsx` 的渲染块**

在 `Files.tsx` 顶部新增 helper + state 局部组件；最简单做法是直接在 `map` 里加 `isFullMap`（per row toggle）。最干净的实现：**把行内 `<img>` 提取成 `<ThumbImg>` 子组件**，避免每行耦合外层 state。

新增（在 `Files.tsx` 顶部 import 后、组件外）：
```tsx
interface ThumbImgProps {
  url: string;             // 原图（兜底）
  thumbnails?: FileThumbnail[];
  alt: string;
}

function ThumbImg({ url, thumbnails, alt }: ThumbImgProps) {
  const sm = thumbnails?.find((t) => t.level === 'sm');
  // 默认显示 sm 缩略图；sm 缺失则退到原图
  const defaultSrc = sm?.url ?? url;
  const [src, setSrc] = useState(defaultSrc);
  const [isFull, setIsFull] = useState(false);

  function handleClick(): void {
    if (isFull) {
      // 切回 sm（不存在则保持原图）
      setSrc(defaultSrc);
      setIsFull(false);
    } else {
      setSrc(url);
      setIsFull(true);
    }
  }

  return (
    <img
      className="sl-us-file-thumb"
      src={src}
      data-src={defaultSrc}    // 缩略图 URL（懒加载初始目标）
      data-full={url}          // 原图 URL（点击切换目标）
      data-state={isFull ? 'full' : 'thumb'}
      alt={alt}
      loading="lazy"
      onClick={handleClick}
      title={isFull ? '点击切回缩略图' : '点击查看原图'}
    />
  );
}
```

> ⚠️ 命名解释：用户原话"前端渲染使用 data-src,默认展示缩略图,若用户点击大图,切换高清图" —— 这里 `data-src` = 缩略图 URL（默认显示），`data-full` = 原图 URL（点击切换目标）。`src` 是实际加载的图片，由 React state 控制。点击交互走 React state 而非直接改 `src` attribute，避免 DOM 直写与 React 渲染冲突。

替换原 `Files.tsx:175-187` 的 `<img>` 块：
```tsx
{item.isPreviewable ? (
  <ThumbImg
    url={item.url}
    thumbnails={item.thumbnails}
    alt={item.displayName}
  />
) : (
  <span className="sl-us-file-icon" aria-hidden="true">
    {fileKindIcon(item.fileKind)}
  </span>
)}
```

- [ ] **Step 2: 给 `.sl-us-file-thumb` 加点击样式（`index.css`）**

定位 `.sl-us-file-thumb`（搜索 "file-thumb"），在它的规则后加：
```css
.sl-us-file-thumb {
  cursor: zoom-in;
  /* 已有样式保留;以下为新增 */
}
.sl-us-file-thumb[data-state="full"] {
  cursor: zoom-out;
}
```

> 不强制 `max-width` —— `Files.tsx:177` 的现有 `<th style={{ width: '64px' }}>` 已经约束列宽。

- [ ] **Step 3: 跑 lint**

```bash
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/src/pages/Files.tsx \
                                  packages/react-components/src/user-space/index.css
```
预期：clean

- [ ] **Step 4: 跑 vitest 全量**

```bash
pnpm exec vitest run
```
预期：全过（Files.tsx 无单测，纯 UI 改动）

- [ ] **Step 5: 手动验证清单（写进 commit body,留给用户）**

- [ ] 桌面浏览器：列表行渲染缩略图（明显比原图小）；点击行图片 → 切到原图（loading 后展示原图）；再点 → 切回缩略图
- [ ] DevTools Network：`data-src` / `data-full` 属性出现在 DOM 上
- [ ] 非图片文件（pdf / text）：不渲染 `<img>`，仍走图标（行为不变）
- [ ] 表格行宽 64px 列：缩略图不破列

- [ ] **Step 6: commit**

```bash
git add packages/react-components/src/user-space/src/pages/Files.tsx \
        packages/react-components/src/user-space/index.css
git commit -m "$(cat <<'EOF'
feat(user-space): Files tab thumbnails via data-src + click-to-fullscreen

List rows now default to thumbnails?.[level='sm']?.url (fallback to
original url when thumbnails absent). Each row image stores
data-src (thumb) and data-full (original). Clicking the image toggles
between thumb and full via local state. Non-image files keep their
icon. data-state="full" toggles cursor to zoom-out for affordance.

No backend change; aligns with dev_ctr_hello user-file-invitecode
thumbnail contract (sm/md/lg).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 排查移动端 user-space 故障（iPhone 13 viewport）

**Files:**
- Create: `scripts/qa-mobile-user-space.mjs` — Playwright 一次性脚本（不入版本控制，仅本地排查）
- Create: `docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md` — 排查报告（不入版本控制）

**Interfaces:**
- Consumes: showcase 入口 URL（环境变量 `BASE`；默认 `http://localhost:5180`，看 `apps/showcase/package.json` dev script）
- Produces: `findings.md` 含「失败动作 / 控件 / 控制台 error / 网络 4xx-5xx」对照表
- **NOT committed**: `scripts/qa-mobile-user-space.mjs` 和 `docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md` 都是一次性产物，留在工作区即可，不入版本控制（`scripts/` 不在 .gitignore，但本任务不能 commit 这些文件）。报告产出由 main 控制器人肉搬到 ~/.claude/projects/.../task-findings.md。

- [ ] **Step 1: 确认 Playwright 已装**

```bash
cd D:/DevProjects/my/github/ve
pnpm exec playwright --version
```
预期：1.x。若未装：`pnpm add -D playwright && pnpm exec playwright install chromium`（仅本机 dev，不 commit）

- [ ] **Step 2: 写排查脚本 `scripts/qa-mobile-user-space.mjs`**

```js
// scripts/qa-mobile-user-space.mjs —— 一次性移动端 user-space 排查。
// 用法:
//   1) 启动 showcase dev: pnpm --filter showcase dev
//   2) 注册一个测试账号(或直接登录已有)
//   3) BASE=http://localhost:5180 EMAIL=... PASSWORD=... node scripts/qa-mobile-user-space.mjs
//
// 输出:docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md
// 退出码:发现任何"不可操作"项 → 1;全通 → 0

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5180';
const EMAIL = process.env.EMAIL ?? '';
const PASSWORD = process.env.PASSWORD ?? '';
if (!EMAIL || !PASSWORD) { console.error('set EMAIL + PASSWORD'); process.exit(2); }

const findings = [];
function record(area, action, status, detail) {
  findings.push({ area, action, status, detail });
  console.log(`[${status}] ${area} :: ${action} :: ${detail}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
const failedRequests = [];
page.on('requestfailed', (r) =>
  failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`),
);
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

// 1) 登 showcase
await page.goto(BASE, { waitUntil: 'networkidle' });
// 找登录入口(按文字"登录"或"#login"路由)
const loginBtn = page.getByRole('button', { name: '登录' }).first();
if (await loginBtn.count() > 0) {
  await loginBtn.click();
  await page.waitForTimeout(300);
}
// 填表单
await page.locator('input[type=email]').fill(EMAIL);
await page.locator('input[type=password]').fill(PASSWORD);
await page.getByRole('button', { name: /登录|submit/i }).first().click();
await page.waitForTimeout(800);

// 2) 进 user-space(具体入口看 showcase 入口;常见是点卡片)
const userSpaceCard = page.getByText('User Space').first();
if (await userSpaceCard.count() === 0) {
  record('entry', 'find user-space card', 'FAIL', 'no "User Space" text found on home');
} else {
  await userSpaceCard.click();
  await page.waitForTimeout(800);
  record('entry', 'navigate to user-space', 'PASS', '');
}

// 3) 切 5 个 tab:overview / members / invitations / inventory / files
for (const tab of ['概览', '成员', '邀请', 'KV 库存', '文件']) {
  const t = page.getByRole('button', { name: new RegExp(tab) }).first();
  if (await t.count() === 0) {
    record('tab-switch', tab, 'FAIL', 'tab not found');
    continue;
  }
  try {
    await t.click({ timeout: 3000 });
    await page.waitForTimeout(300);
    record('tab-switch', tab, 'PASS', '');
  } catch (e) {
    record('tab-switch', tab, 'FAIL', e.message);
  }
}

// 4) 进文件 tab → 试「+ 上传文件」按钮 → 检查 modal 是否弹出
await page.getByRole('button', { name: /文件/ }).first().click();
await page.waitForTimeout(300);
const uploadBtn = page.getByRole('button', { name: /上传文件/ });
if (await uploadBtn.count() === 0) {
  record('files', 'upload button visible', 'FAIL', 'no upload button');
} else {
  try {
    await uploadBtn.click({ timeout: 3000 });
    await page.waitForTimeout(400);
    const modal = page.locator('.sl-us-modal');
    const visible = await modal.isVisible().catch(() => false);
    if (visible) {
      record('files', 'upload modal open', 'PASS', '');
      // 检查 modal 内 input file 是否可点
      const fileInput = modal.locator('input[type=file]');
      const fileInputBox = await fileInput.boundingBox().catch(() => null);
      record('files', 'file input present', fileInputBox ? 'PASS' : 'FAIL', JSON.stringify(fileInputBox ?? null));
      // 关闭 modal
      await modal.locator('button[aria-label=关闭]').click({ timeout: 2000 }).catch(() => {});
    } else {
      record('files', 'upload modal open', 'FAIL', 'modal did not appear');
    }
  } catch (e) {
    record('files', 'upload button click', 'FAIL', e.message);
  }
}

// 5) 行内 accessLevel select —— 第一个 public 行,改成 protected
const firstSelect = page.locator('select').first();
if (await firstSelect.count() === 0) {
  record('files', 'accessLevel select exists', 'FAIL', 'no select found');
} else {
  try {
    await firstSelect.selectOption('protected', { timeout: 3000 });
    await page.waitForTimeout(500);
    record('files', 'change accessLevel', 'PASS', '');
  } catch (e) {
    record('files', 'change accessLevel', 'FAIL', e.message);
  }
}

// 6) 汉堡按钮 —— 切到 sidebar 抽屉
const burger = page.locator('.sl-us-topbar__burger');
const burgerVisible = await burger.isVisible().catch(() => false);
record('sidebar', 'hamburger visible', burgerVisible ? 'PASS' : 'FAIL', '');
if (burgerVisible) {
  try {
    await burger.click({ timeout: 3000 });
    await page.waitForTimeout(300);
    const side = page.locator('.sl-us-side');
    const open = await side.evaluate((el) => el.classList.contains('is-open')).catch(() => false);
    record('sidebar', 'drawer opens', open ? 'PASS' : 'FAIL', '');
    if (open) {
      // 点 backdrop 关闭
      await page.locator('.sl-us-side-backdrop').click({ timeout: 2000 }).catch(() => {});
    }
  } catch (e) {
    record('sidebar', 'drawer interaction', 'FAIL', e.message);
  }
}

// 7) 触摸目标尺寸 —— 全选 button 测最小尺寸
const btnSizes = await page.locator('button').evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: e.textContent?.trim().slice(0, 16) };
  }),
);
const tiny = btnSizes.filter((b) => b.w > 0 && (b.w < 32 || b.h < 32));
record('a11y', `buttons <32px (${tiny.length})`, tiny.length === 0 ? 'PASS' : 'WARN', JSON.stringify(tiny.slice(0, 5)));

// 8) 收集控制台/网络
record('console', `${consoleErrors.length} errors`, consoleErrors.length === 0 ? 'PASS' : 'WARN',
  consoleErrors.slice(0, 5).join(' | '));
record('network', `${failedRequests.length} failed`, failedRequests.length === 0 ? 'PASS' : 'WARN',
  failedRequests.slice(0, 5).join(' | '));

// 9) 截图
mkdirSync('docs/superpowers/plans', { recursive: true });
const shotPath = resolve('docs/superpowers/plans/2026-08-11-user-space-mobile.png');
await page.screenshot({ path: shotPath, fullPage: true });

// 10) 写报告
const report =
  `# user-space 移动端 (iPhone 13) 排查报告\n\n` +
  `> 生成时间:${new Date().toISOString()}\n> Base URL:${BASE}\n\n` +
  `## 排查清单\n\n| 区域 | 动作 | 状态 | 详情 |\n|---|---|---|---|\n` +
  findings.map((f) => `| ${f.area} | ${f.action} | ${f.status} | ${f.detail} |`).join('\n') +
  `\n\n## 控制台错误\n\n${consoleErrors.length === 0 ? '无' : consoleErrors.map((e) => `- ${e}`).join('\n')}\n\n` +
  `## 网络失败\n\n${failedRequests.length === 0 ? '无' : failedRequests.map((e) => `- ${e}`).join('\n')}\n\n` +
  `## 截图\n\n![mobile user-space](./2026-08-11-user-space-mobile.png)\n`;
writeFileSync('docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md', report);

await browser.close();
const fails = findings.filter((f) => f.status === 'FAIL').length;
process.exit(fails > 0 ? 1 : 0);
```

- [ ] **Step 3: 启动 showcase dev + 跑脚本**

```bash
# 终端 1
pnpm --filter showcase dev   # 等到 vite ready
# 终端 2
EMAIL=t@x.com PASSWORD=... node scripts/qa-mobile-user-space.mjs
```

- [ ] **Step 4: 读报告,把 FAIL 项列为 Task 5 的子步骤**

打开 `docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md`,把所有 FAIL 项列出来 → 这些就是 Task 5 要修的目标。**不 commit 脚本和报告**(一次性,不入版本控制)。

---

## Task 5: 修复移动端 user-space 故障（基于 Task 4 清单）

**Files:** 由 Task 4 报告决定。可能涉及：

- `packages/react-components/src/user-space/index.css`（最常见：媒体查询微调）
- `packages/react-components/src/user-space/index.tsx`（state / event handler）
- `packages/react-components/src/user-space/src/pages/Sidebar.tsx`（backdrop / drawer 关闭逻辑）
- `packages/react-components/src/user-space/src/pages/Files.tsx`（行 actions、移动端表格）

> 本 task 不预先写代码——因为具体修哪几处取决于 Task 4 的失败清单。每个 fix 子步骤会按 [排查项 → 文件 → 改法 → 验证] 拆。

- [ ] **Step 1: 把 Task 4 失败清单逐条填入本 task 的 sub-task**

例（**占位**,实际由 Task 4 报告驱动）:

```markdown
### 修复项 N: [来自 Task 4 报告的具体失败]

**Files:**
- Modify: [确切文件:行号]

**改法:**
[具体 CSS / TSX 改动]

**验证:**
- [ ] playwright 重跑对应动作 → PASS
- [ ] lint clean
- [ ] vitest 全过

**Commit:**
[Conventional Commits + Co-Authored-By]
```

- [ ] **Step 2: 每个 fix 单独 atomic commit（不批量）**

- [ ] **Step 3: 重跑 Task 4 脚本验证全 PASS**

```bash
EMAIL=t@x.com PASSWORD=... node scripts/qa-mobile-user-space.mjs
echo "exit=$?"   # 0 = 全 PASS
```

---

## 报告

写到 `~/.claude/projects/D--DevProjects-my-github-ve/task-findings.md`(一次性):
- 状态、Task 1-3 commit hash、Task 4 排查报告路径、Task 5 修复列表与 commit hash、剩余风险

## 返回

Task 1-3 状态、commit hash、Task 4 失败清单（重点项）、Task 5 修复状态。完成后再由用户决定是否 push + 开 PR。