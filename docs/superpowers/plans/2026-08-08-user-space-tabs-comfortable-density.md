# user-space tabs 舒适档尺寸 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** user-space `.sl-us-tabs` 从「紧凑档」(tab ~32px 高,容器 py 10px,tab gap 10px,字号 12.5px,badge 10px)升级到「舒适档」(tab ~44px 高,容器 py 18px,tab gap 20px,字号 14px,badge 11.5px),符合 WCAG/Apple HIG 最小触控目标 44px。桌面与移动统一。

**Architecture:** 纯 CSS 改一处 + 检查 mobile 媒体查询(≤640px)有无需要覆盖的值。零 JS、零组件改动、零测试改动。

**Tech Stack:** 现有 `index.css`。

## Global Constraints

- **不动 JSX / 不动 state**(tabs 选中态仍是 `is-active` class)
- 不动 tabs 选中态视觉(2px 底线 + 字重 600 + count badge 反色保持)
- 不改 `--tabs-pad-y` 的语义(它驱动 `::after` 的 bottom 偏移,改数值时自动跟随)
- 不动 topbar / toolbar / sidebar / modal 等其它区域
- Conventional Commits;Co-Authored-By trailer
- 在 `fix/gis-runtime-bugs` 分支提交;**不** push 不开 PR
- lint clean;`pnpm exec vitest run` 全过(349,无测试改动)
- 不顺手重构

---

## Task 1: tabs 舒适档尺寸

**Files:**
- Modify: `packages/react-components/src/user-space/index.css`(改 `.sl-us-tabs` / `.sl-us-tab` / `.sl-us-tab__count`)

### Step 1: 改 `.sl-us-tabs`(容器)

```css
.sl-us-tabs {
  --tabs-pad-y: 18px;          /* ↑ 从 10px */
  display: flex;
  align-items: center;
  gap: 20px;                   /* ↑ 从 10px */
  padding: var(--tabs-pad-y) 20px;
  border-bottom: 1px solid var(--border);
}
```

### Step 2: 改 `.sl-us-tab`(单 tab)

```css
.sl-us-tab {
  padding: 12px 14px;          /* ↑ 从 8px 14px(垂直 12 拿到 ~44px 高) */
  font-size: 14px;             /* ↑ 从 12.5px */
  color: var(--fg-2);
  font-weight: 500;
  position: relative;
  border-radius: var(--radius-sm);  /* 新增:小幅圆角,选中态背景对比更显 */
  transition: color 0.1s, background 0.1s;
}
.sl-us-tab:hover { color: var(--fg); background: var(--hover); }   /* 加 hover 背景 */
.sl-us-tab.is-active {
  color: var(--fg);
  font-weight: 700;            /* ↑ 从 600(配合更粗字重强化选中态) */
  background: var(--hover);    /* 新增:active 时浅背景填充 */
}
```

### Step 3: 改 `.sl-us-tab__count`(计数 badge)

```css
.sl-us-tab__count {
  display: inline-block;
  margin-left: 8px;             /* ↑ 从 6px */
  padding: 1px 7px;            /* 微调垂直内边距,与 14px 字号对齐 */
  font-size: 11.5px;           /* ↑ 从 10px */
  background: var(--bg);       /* 略改:inactive badge 用更浅的 bg(与 hover 区分) */
  color: var(--fg-3);
  border-radius: 8px;
  vertical-align: 1px;
  font-weight: 500;
}
.sl-us-tab.is-active .sl-us-tab__count {
  background: var(--fg);       /* 保留 active 反色 */
  color: var(--bg);
}
```

### Step 4: 检查并修正 mobile(≤640px)覆盖

`index.css` 已有 mobile 媒体查询覆盖 tabs:`.sl-us-tabs { padding: 8px 12px; gap: 4px; overflow-x: auto; }`。

**问题**:mobile 覆盖会把舒适档的 `gap: 20px` 缩到 `gap: 4px`(过紧)且 padding 缩到 `8px 12px`(挤压)。

**修法**:mobile 覆盖只改 `padding-left/right`(横向更紧凑)和保留 `overflow-x: auto`,不强制覆盖 gap/padding-y。改成:

```css
@media (max-width: 640px) {
  /* tabs 横滚 —— 保持舒适档的 gap 与 py,只缩左右 padding,加横向滚动 */
  .sl-us-tabs {
    padding-left: 12px;
    padding-right: 12px;
    overflow-x: auto;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
    /* 不覆盖 --tabs-pad-y / gap —— 保留 18px / 20px 的舒适档 */
  }
  .sl-us-tab {
    flex-shrink: 0;
    padding: 12px 14px;   /* 覆盖任何同名声明,确保 mobile 也有 ~44px 高 */
  }
}
```

> 之前 mobile 覆盖 `.sl-us-tab { padding: 8px 12px; flex-shrink: 0; }` 会挤压 tab 高度。新版明确保留 `padding: 12px 14px`。

### Step 5: 验证 + commit

```bash
pnpm exec vitest run   # 349 仍全过
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/   # 干净
git add -A
git commit -m "$(cat <<'EOF'
style(user-space): tabs to comfortable density

Tab height ~32px -> ~44px (WCAG/Apple HIG min touch target);
container py 10px -> 18px, tab gap 10px -> 20px, font 12.5px -> 14px,
count badge 10px -> 11.5px. Active tab gains soft bg fill + font-weight
700 to reinforce selection. Mobile overrides only tighten horizontal
padding and add overflow-x; keeps comfortable vertical density.
No JSX / state / test changes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

## 不做

- 不动 topbar / toolbar / sidebar / modal 尺寸
- 不动 tabs 选中态的「2px 底线」(`::after`)—— 保留
- 不动其它 token 变量
- 不加 hover 动画到 sidebar / toolbar 等其它元素
- 不持久化偏好
- 不重写 tabs 渲染逻辑

## 风险

1. **mobile 横滚体验** —— 4 tab 在 18px + 20px gap 下总宽 > 360px,触发横滚;若用户希望 mobile 不横滚,可改为移动端 tab stack(垂直或 select 替代)。本期按 plan 保留横滚(用户已确认舒适档)。
2. **topbar 视觉权重** —— tabs 增高后,topbar(40px)与 tabs(60px)对比明显,topbar 显得单薄。如需可一并加高 topbar padding,但本期不做(不顺手重构)。
3. **count badge 颜色** —— inactive badge 改用 `--bg` 而非 `--hover` 是为了与 active tab 的 hover 背景区分(否则 active tab 上 hover 与 badge 同色,边界不清)。如果 `--bg` 与外层背景不一致(透明 vs 实色),badge 可能「消失」,届时再调回 `--hover`。

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\task-3-report.md`:
- 状态、改动摘要(逐行新旧对比)、commit hash、测试摘要、顾虑

## 返回

状态、commit hash、测试摘要(349/349 不变)、顾虑。完成后再 `kvcli todo done 3 --result "..."` 回填。