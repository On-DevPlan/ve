// scripts/qa-mobile-user-space.mjs —— 一次性移动端 user-space 排查(iPhone 13 viewport)。
// 【不入版本控制】一次性排查产物,跑完看报告即可,不要 commit。
//
// 用法:
//   1) 启动 showcase dev: pnpm --filter showcase dev   (默认 port 5173,见 apps/showcase/vite.config.ts)
//   2) 准备一个已注册的测试账号(注册需邮箱验证码 + 邀请码,无法自助注册)
//   3) BASE=http://localhost:5173 EMAIL=... PASSWORD=... node scripts/qa-mobile-user-space.mjs
//
// 输出:docs/superpowers/plans/2026-08-11-user-space-mobile-findings.md
// 退出码:发现任何"不可操作"项 → 1;全通 → 0;缺凭据 → 2
//
// ── 与 task-4-brief.md 的偏差(brief 的选择器与真实代码不符,已按代码修正)──
//   1) BASE 默认 5180 → 5173         (vite.config.ts server.port = 5173)
//   2) 入口 "User Space" → 直接 goto /components/user-space
//      (component.config.ts route.path;首页卡片标题是中文「用户空间」,无 "User Space" 文案)
//   3) 组件挂在 **open shadow DOM** 里(isolation.mode = 'shadow-dom',
//      ShadowRootHost 默认 open:true)。Playwright 的 css/getByRole 能自动穿透 open
//      shadow root,但 `page.locator('select')` 这类全局选择器仍能命中,故保留。
//   4) modal 关闭按钮:brief 写 `button[aria-label=关闭]`(缺引号,CSS 语法错误)
//      → 修正为 `button[aria-label="关闭"]`(UploadFileModal.tsx:81 确认存在)
//   5) 登录:showcase 有独立路由 /login(LoginPage.vue),比首页找「登录」按钮更稳。

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const EMAIL = process.env.EMAIL ?? '';
const PASSWORD = process.env.PASSWORD ?? '';
if (!EMAIL || !PASSWORD) {
  console.error('set EMAIL + PASSWORD');
  process.exit(2);
}

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

// 1) 登 showcase —— 走独立 /login 路由
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
try {
  await page.locator('input[type=email]').fill(EMAIL);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: /登录|submit/i }).first().click();
  await page.waitForTimeout(1500);
  record('auth', 'login submit', 'PASS', '');
} catch (e) {
  record('auth', 'login submit', 'FAIL', e.message);
}

// 2) 进 user-space —— 直接走注册路由
await page.goto(`${BASE}/components/user-space`, { waitUntil: 'networkidle' });
// 【实测】React 组件是异步挂进 open shadow root 的:networkidle 时 .sl-us-root
// 还不存在,稳定在 networkidle 之后 ~1.2s 才 attach(5 次实测 1.90–2.03s from goto)。
// 所以这里必须显式等 attach,不能用 brief 里的固定 waitForTimeout(会 flaky)。
await page
  .locator('.sl-us-root')
  .waitFor({ state: 'attached', timeout: 30000 })
  .catch(() => record('entry', 'user-space mount', 'FAIL', '.sl-us-root never attached (30s)'));
// 未登录时组件渲染 gate 卡片(.sl-us-gate),登录成功才有 .sl-us-root 内的 topbar
const gate = page.locator('.sl-us-gate');
if ((await gate.count()) > 0) {
  record('entry', 'navigate to user-space', 'FAIL', 'auth gate shown — login did not take effect');
} else {
  record('entry', 'navigate to user-space', 'PASS', '');
}

// 3) 切 5 个 tab:overview / members / invitations / inventory / files
for (const tab of ['概览', '成员', '邀请', 'KV 库存', '文件']) {
  const t = page.getByRole('button', { name: new RegExp(tab) }).first();
  if ((await t.count()) === 0) {
    record('tab-switch', tab, 'FAIL', 'tab not found');
    continue;
  }
  try {
    await t.click({ timeout: 3000 });
    await page.waitForTimeout(400);
    record('tab-switch', tab, 'PASS', '');
  } catch (e) {
    record('tab-switch', tab, 'FAIL', e.message);
  }
}

// 4) 进文件 tab → 试「+ 上传文件」按钮 → 检查 modal 是否弹出
await page.getByRole('button', { name: /文件/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
const uploadBtn = page.getByRole('button', { name: /上传文件/ });
if ((await uploadBtn.count()) === 0) {
  record('files', 'upload button visible', 'FAIL', 'no upload button (需 writer+ 权限)');
} else {
  try {
    await uploadBtn.first().click({ timeout: 3000 });
    await page.waitForTimeout(500);
    const modal = page.locator('.sl-us-modal');
    const visible = await modal.isVisible().catch(() => false);
    if (visible) {
      record('files', 'upload modal open', 'PASS', '');
      const fileInput = modal.locator('input[type=file]');
      const fileInputBox = await fileInput.boundingBox().catch(() => null);
      record(
        'files',
        'file input present',
        fileInputBox ? 'PASS' : 'FAIL',
        JSON.stringify(fileInputBox ?? null),
      );
      await modal
        .locator('button[aria-label="关闭"]')
        .click({ timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(300);
    } else {
      record('files', 'upload modal open', 'FAIL', 'modal did not appear');
    }
  } catch (e) {
    record('files', 'upload button click', 'FAIL', e.message);
  }
}

// 5) 行内 accessLevel select —— 第一个 public 行,改成 protected
const firstSelect = page.locator('select[aria-label^="修改文件"]').first();
if ((await firstSelect.count()) === 0) {
  record('files', 'accessLevel select exists', 'FAIL', 'no per-row accessLevel select found (组内可能无文件)');
} else {
  try {
    await firstSelect.selectOption('protected', { timeout: 3000 });
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(400);
    const side = page.locator('.sl-us-side');
    const open = await side
      .evaluate((el) => el.classList.contains('is-open'))
      .catch(() => false);
    record('sidebar', 'drawer opens', open ? 'PASS' : 'FAIL', '');
    if (open) {
      await page.locator('.sl-us-side-backdrop').click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      const stillOpen = await side
        .evaluate((el) => el.classList.contains('is-open'))
        .catch(() => false);
      record('sidebar', 'backdrop closes drawer', stillOpen ? 'FAIL' : 'PASS', '');
    }
  } catch (e) {
    record('sidebar', 'drawer interaction', 'FAIL', e.message);
  }
}

// 7) 触摸目标尺寸 —— 全选 button 测最小尺寸
const btnSizes = await page.locator('button').evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: e.textContent?.trim().slice(0, 16),
    };
  }),
);
const tiny = btnSizes.filter((b) => b.w > 0 && (b.w < 32 || b.h < 32));
record(
  'a11y',
  `buttons <32px (${tiny.length})`,
  tiny.length === 0 ? 'PASS' : 'WARN',
  JSON.stringify(tiny.slice(0, 5)),
);

// 8) 收集控制台/网络
record(
  'console',
  `${consoleErrors.length} errors`,
  consoleErrors.length === 0 ? 'PASS' : 'WARN',
  consoleErrors.slice(0, 5).join(' | '),
);
record(
  'network',
  `${failedRequests.length} failed`,
  failedRequests.length === 0 ? 'PASS' : 'WARN',
  failedRequests.slice(0, 5).join(' | '),
);

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
