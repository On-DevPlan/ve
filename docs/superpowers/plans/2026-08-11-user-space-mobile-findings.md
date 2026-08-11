# user-space 移动端 (iPhone 13) 排查报告

> 生成时间:2026-08-11
> Base URL:`http://localhost:5173`(**不是** brief 里写的 5180,见下方"环境偏差")
> Viewport:Playwright `devices['iPhone 13']`(390×844,DPR 3)
> 脚本:`scripts/qa-mobile-user-space.mjs`(一次性产物,未 commit)

## 结论摘要

**状态:BLOCKED —— 主排查(登录后的 5 tab / 上传 modal / accessLevel / 抽屉)未能执行。**

阻塞原因:**没有可用的测试账号凭据**。`EMAIL` / `PASSWORD` 环境变量未设置,仓库内、`.env`、全局 shell 环境中均无测试账号。user-space 组件对未登录用户**硬闸**(`index.tsx:544` `if (auth.jwtAuthState !== 'logged-in' || !auth.token)` → 只渲染 gate 卡片),因此 brief 中 Step 3–6 的所有交互项都无法触达。

自助注册也不可行:`LoginPage.vue:117` 要求注册必须同时提供**邮箱验证码 + 邀请码**(`注册需要邮箱验证码和邀请码`),无法在无人值守下绕过。

不过,在未登录可达范围内(gate 卡片 + /login 页)已跑通并**发现 1 个真实的 P1 级 CSS 缺陷**,详见下表。

## 排查清单

| 区域 | 动作 | 状态 | 详情 |
|---|---|---|---|
| infra | showcase dev server 可达 | PASS | `http://localhost:5173` → 200(5180/4173 均不可达) |
| infra | Node `playwright` 包可用 | **FAIL** | 仓库内**未安装** Node playwright;`pnpm exec playwright --version` 报的 1.61.0 实为 **Python** 包(`/d/Python/py_v314/Scripts/playwright`)。本次排查改用 Python playwright 驱动同一 Chromium |
| infra | Chromium 已下载 | PASS | `~/AppData/Local/ms-playwright/chromium-1228` 等已存在,无需 install |
| auth | 测试账号凭据 | **BLOCKED** | `EMAIL`/`PASSWORD` 未设置;注册需邮箱验证码+邀请码,无法自助创建 |
| entry | 路由可达 | PASS | `/components/user-space`(取自 `component.config.ts` `route.path`) |
| entry | 组件挂载 | PASS | 挂进 **open** shadow root,Playwright 选择器可穿透 |
| entry | 登录闸 | 预期内 | 未登录 → 渲染 `.sl-us-gate`,`.sl-us-topbar__burger` 不存在 |
| **css** | **gate 卡片完全无样式** | **FAIL** | `index.css` 中 `sl-us-gate` 相关规则数 = **0**,gate 的 `__card`/`__title`/`__desc` 全部裸奔(见截图:无卡片、无居中、无留白) |
| **css** | **`.sl-us-btn` 被 reset 规则压掉** | **FAIL** | `.sl-us-root button`(特异度 0,1,1,line 64)覆盖 `.sl-us-btn`(0,1,0,line 267)→ `padding` 计算值为 `0px`、`border-width: 0`、`background: transparent`。**全局生效,非移动端专属** |
| a11y | gate 登录按钮触摸目标 | **FAIL** | 实测 **28×44 px**,宽度 < 32px(桌面端更差:26×26 px)。直接后果就是上一行的 padding 被清零 |
| a11y | 横向溢出(gate) | PASS | `scrollWidth <= innerWidth` |
| a11y | 横向溢出(/login) | PASS | `scrollWidth <= innerWidth` |
| a11y | /login 按钮触摸目标 | PASS | 6 个可见按钮,无 < 32px |
| login | 邮箱/密码输入框存在 | PASS | `input[type=email]` ×1,`input[type=password]` ×1 |
| tab-switch | 概览 / 成员 / 邀请 / KV 库存 / 文件 | **未测** | 被登录闸挡住 |
| files | 上传文件按钮 / modal / file input | **未测** | 被登录闸挡住 |
| files | 行内 accessLevel select | **未测** | 被登录闸挡住 |
| sidebar | 汉堡按钮 / 抽屉 / backdrop 关闭 | **未测** | 被登录闸挡住 |
| console | 控制台 error | PASS | gate 页与 /login 页均为 **0** error |
| network | 4xx / 5xx | PASS | 两页均为 **0** 失败请求 |

## 关键缺陷详解

### P1 — `.sl-us-root button` reset 压掉所有 `.sl-us-btn` 样式

`packages/react-components/src/user-space/index.css:64`:

```css
.sl-us-root button { font: inherit; cursor: pointer; background: none; border: none; padding: 0; color: inherit; }
```

特异度 **(0,1,1)**,而 line 267 的 `.sl-us-btn { ... padding: 0 10px; height: 26px; border: 1px solid ...; }` 只有 **(0,1,0)**。两者都在同一张 adopted stylesheet 内,reset 胜出。

浏览器实测(在 `.sl-us-root` 内动态插入 `<button class="sl-us-btn sl-us-btn--primary">` 验证,排除 gate 特例):

```json
{"padding":"0px","height":"44px","border":"0px","bg":"rgba(0, 0, 0, 0)"}
```

→ 说明**组件内每一个 `.sl-us-btn` 都在裸奔**,不只是 gate。登录后的上传按钮、分页按钮、图标按钮很可能同样受影响,这与"移动端 user-space 故障"的报障高度吻合。

**归属**:`git blame` 显示该行来自 `b209298c`(2026-08-07),**早于**本分支 `38f511a`,属**既有缺陷**,非本次缩略图改动引入。

**建议修法**(留给 Task 5):把 reset 的选择器降权或改为只作用于无 class 的按钮,例如 `.sl-us-root button:not([class*='sl-us-btn'])`,或把 `.sl-us-btn` 提权到 `.sl-us-root .sl-us-btn`。

### P2 — gate 卡片零样式

`index.css` 内 `sl-us-gate` 出现次数为 **0**,但 `index.tsx:546-556` 渲染了 `.sl-us-gate` / `.sl-us-gate__card` / `.sl-us-gate__title` / `.sl-us-gate__desc`。未登录用户看到的是完全无排版的裸文本(见截图)。

## 控制台错误

无(gate 页 0,/login 页 0)。

## 网络失败

无(两页均无 ≥400 响应)。

## 截图

![mobile user-space gate](./2026-08-11-user-space-mobile.png)

## 环境偏差(brief vs 实际)

brief 里的脚本按原样跑**不起来**,已在 `scripts/qa-mobile-user-space.mjs` 中修正并注释:

1. **端口**:brief 默认 `5180`;实际 `apps/showcase/vite.config.ts` 是 `server.port = 5173`。
2. **入口**:brief 找 `getByText('User Space')`;实际首页无该英文文案,组件标题是中文「用户空间」。已改为直接 `goto('/components/user-space')`。
3. **登录**:showcase 有独立路由 `/login`,比在首页找「登录」按钮稳。
4. **CSS 语法错**:brief 写 `button[aria-label=关闭]`(属性值未加引号,非法选择器)→ 修正为 `button[aria-label="关闭"]`。
5. **挂载时序**:组件异步挂进 shadow root,`networkidle` 时 `.sl-us-root` **尚不存在**,稳定在 goto 后 ~1.9–2.0s 才 attach(5 次实测)。brief 的固定 `waitForTimeout(800/1200)` 会 flaky,已改为显式 `waitFor({state:'attached'})`。
6. **accessLevel select**:brief 用 `page.locator('select').first()`,但 Files 工具栏第一个 select 是「按 tag 过滤」(`Files.tsx:169`),会误选。已改为 `select[aria-label^="修改文件"]`。
7. **Node playwright 未安装**:`pnpm exec playwright` 命中的是 Python 包。要跑 `.mjs` 脚本需先 `pnpm add -Dw playwright`。

## 解除阻塞所需步骤

要完成 brief 里剩余的登录后排查项,需要有人提供:

1. 一个**已注册**的测试账号(邮箱 + 密码),且该账号在某个 group 内至少有 **writer** 角色(否则「+ 上传文件」按钮不渲染,`Files.tsx:85`);
2. 该 group 内**至少 1 个已存在的文件**(否则行内 accessLevel select 无从测试);
3. 安装 Node 版 playwright:`pnpm add -Dw playwright`。

然后执行:

```bash
pnpm --filter showcase dev                     # 终端 1(已在跑)
BASE=http://localhost:5173 EMAIL=... PASSWORD=... node scripts/qa-mobile-user-space.mjs
```
