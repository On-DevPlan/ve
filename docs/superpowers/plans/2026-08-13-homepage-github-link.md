# 主页 sidebar 添加 GitHub 链接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `ClassicMode.vue` 的 sidebar 底部添加一个外部链接,指向 `https://github.com/On-DevPlan/ve`,PinMode / HomeMobile / HomePC 不动。

**Architecture:** 单文件 inline 改动 —— `apps/showcase/src/pages/home/ClassicMode.vue` 的 template 第 168 行后插入一个 `<a class="sidebar__github">`,`<style scoped>` 第 378 行后追加 `.sidebar__github` / `.sidebar__github:hover` 两条规则。URL 硬编码在 template(单 caller,YAGNI);无新组件、无新常量、无新测试。

**Tech Stack:** Vue 3 `<script setup>` + SFC scoped CSS;沿用现有 `--ink-mute` / `--ink` CSS 变量 + `.sidebar__foot` 的 mono 字体约定。

## Global Constraints

- 分支:`feat/homepage-github-link`(基于 `main`);不 push、不开 PR。
- Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 不动 PinMode / HomeMobile / HomePC / store / build / package.json / ESLint 配置。
- 不动现有 `.sidebar__foot` 文本「v0.1 · main · <platform>」;链接**追加**在该行下面,**不替换**。
- URL 必须为 `https://github.com/On-DevPlan/ve`(与 `git remote get-url origin` 一致;`git push` 输出已确认)。
- `↗` 是 Unicode U+2197 NORTH EAST ARROW,纯字符,无字体 / SVG / icon 依赖。
- 现有 vitest 套件(57 文件 / 439 用例)**不变**;此改动不引入新逻辑,无需新测试。

---

### Task 1: ClassicMode.vue 模板 + scoped CSS 双处编辑

**Files:**
- Modify: `apps/showcase/src/pages/home/ClassicMode.vue`(template 第 168 行 `</div>` 后插一段;`<style scoped>` 第 378 行后插一段)

**Interfaces:**
- Consumes: 现有的 `<style scoped>`(line 262)、`.sidebar__foot` 样式约定(第 372-377 行)、`var(--ink-mute)` / `var(--ink)` 颜色 token。
- Produces: 一个新的 `<a class="sidebar__github">` 元素 + 两条对应的 scoped CSS 规则。

- [ ] **Step 1: 读取当前 ClassicMode.vue 的两处目标行**

用 Read 工具读这两段,确认精确文本(避免 Edit 的 old_string 失配):

- 第 166-169 行 template 段:
  ```vue
        <div class="sidebar__foot">
          v0.1 · main · <span :class="'platform--' + platform">{{ platform }}</span>
        </div>
      </aside>
  ```
- 第 372-379 行 style 段:
  ```css
  .sidebar__foot {
    margin-top: auto; font-family: "JetBrains Mono", monospace;
    font-size: 10px; letter-spacing: 0.2em; color: var(--ink-mute);
  }
  .sidebar__foot .platform--pc { color: #2563eb; }
  .sidebar__foot .platform--mobile { color: #7c3aed; }

  /* 鉴权态 chip:与 sidebar__foot 分两行,样式紧凑 */
  ```

- [ ] **Step 2: 改 template —— 在 `</div>`(sidebar__foot)与 `</aside>` 之间插入 `<a>`**

Edit `apps/showcase/src/pages/home/ClassicMode.vue`,old_string 用 Step 1 读到的精确 4 行(含两行缩进 + `</aside>`),替换为:

```vue
        <div class="sidebar__foot">
          v0.1 · main · <span :class="'platform--' + platform">{{ platform }}</span>
        </div>
        <a
          class="sidebar__github"
          href="https://github.com/On-DevPlan/ve"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="项目 GitHub 仓库(在新标签页打开)"
        >GitHub ↗</a>
      </aside>
```

> 注意:保留 `<div class="sidebar__foot">...</div>` 原样不动(只在其后追加);`</aside>` 仍是 6 空格缩进闭合。

- [ ] **Step 3: 改 scoped style —— 在 `.sidebar__foot .platform--mobile` 规则后追加两条新规则**

Edit `apps/showcase/src/pages/home/ClassicMode.vue`,old_string 用 Step 1 读到的精确 `.sidebar__foot .platform--pc / .platform--mobile` 两行 + 空行 + `/* 鉴权态 chip:...` 注释开头行(共 4 行),替换为:

```css
.sidebar__foot .platform--pc { color: #2563eb; }
.sidebar__foot .platform--mobile { color: #7c3aed; }

.sidebar__github {
  display: inline-block;
  margin-top: 4px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-mute);
  text-decoration: none;
}
.sidebar__github:hover {
  text-decoration: underline;
  color: var(--ink);
}

/* 鉴权态 chip:与 sidebar__foot 分两行,样式紧凑 */
```

- [ ] **Step 4: 跑全套 vitest 确认无回归**

```bash
pnpm exec vitest run
```

预期:全绿(57 文件 / 439 用例不变);本次改动无新逻辑,若意外 fail 则中止并报告。

- [ ] **Step 5: 跑 ESLint**

```bash
pnpm exec eslint --max-warnings=0 apps/showcase/src/pages/home/ClassicMode.vue
```

预期:exit 0,0 error / 0 warning。

- [ ] **Step 6: Commit**

```bash
git add apps/showcase/src/pages/home/ClassicMode.vue
git commit -m "feat(homepage): sidebar GitHub link in ClassicMode

Adds an external link to the project GitHub repo
(https://github.com/On-DevPlan/ve) at the bottom of ClassicMode's
sidebar footer, below the existing v0.1 / platform version line.

Text-only label \"GitHub ↗\" rendered in the same monospace footer style
as .sidebar__foot; hover state shifts color to --ink with underline.
target=_blank + rel=noopener noreferrer; aria-label in Chinese for
screen readers. Single-file change, scoped CSS, hardcoded URL string
(YAGNI: one caller, low URL change frequency).

No new tests; vitest suite unchanged. PinMode / HomeMobile / HomePC
deliberately untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 手工验证清单(留给用户真机)

- [ ] **桌面端浏览器加载首页**(默认 ClassicMode):
  - sidebar 底部「v0.1 · main · pc」一行未变。
  - 其下出现 `GitHub ↗` 文本,与上一行间距 ≈28-32px(`.sidebar` 父级 flex gap 28px + 本元素 `margin-top:4px` 叠加;plan 初版估 ~4px 未计 flex gap,已修正),字号 / 字距 / 色与上一行一致。
  - hover `GitHub ↗` → 出现下划线 + 字色由 `--ink-mute` 变 `--ink`。
  - 点击 → 新标签打开 `https://github.com/On-DevPlan/ve`,原页面不动。
  - 浏览器 devtools 检查 `<a>` 的 `rel="noopener noreferrer"` 已生效。
- [ ] **PinMode 视图**(登录后切到 Pin)—— sidebar 不存在,但确认顶栏 / 桌面瓦片布局无任何 GitHub 文本出现。
- [ ] **HomeMobile 视图**(platform=mobile 或浏览器 devtools 切到移动设备)—— 顶栏「wb / showcase」行无任何 GitHub 文本出现。
- [ ] **屏幕阅读器**(可选)—— 朗读 `aria-label`「项目 GitHub 仓库(在新标签页打开)」而非裸的「GitHub ↗」。
- [ ] **键盘可达**—— Tab 键能聚焦到 `GitHub ↗`,Enter 触发跳转。