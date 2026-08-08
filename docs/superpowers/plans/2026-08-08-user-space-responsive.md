# user-space 完整响应式适配 · 实现计划

> **For agentic workers:** REQUIRED SUB-KKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** user-space 在 360px(最小常见手机宽)~ 1920px(桌面大屏)都「合理可用」—— 不破版,关键操作可点可读。

**Architecture:**
- CSS 媒体查询(`@media`)分三档断点(移动 ≤ 640px / 平板 ≤ 900px / 桌面 > 900px),桌面作为默认(无前缀)、移动和平板为适配层。
- UI 状态(sidebar 折叠/抽屉)放在 `index.tsx` 的局部 state,setter 通过 props 传给 Sidebar(让其渲染汉堡/抽屉)/ main(汉堡按钮)。
- **零新依赖,零新组件**(Sidebar / Inventory / Invitations / Members / KvEditorModal / DuplicateKvModal / SettingsPanel 改响应式类,index.tsx 加 2 个 state)。

**Tech Stack:** 现有 React + ve `index.css`(`@media` only)。**纯 CSS 媒体查询 + 极少的 JS 状态**(sidebar 折叠)。

## Global Constraints

- **不动业务逻辑** —— store / service / API 不改;只动 `index.tsx`(状态)、`Sidebar.tsx`(汉堡渲染)、`index.css`(媒体查询)
- 三档断点:`≤640px`(移动竖屏)、`641-900px`(平板 / 桌面窄屏)、`>900px`(桌面默认)
- **桌面保持当前布局不变**(避免回归);移动/平板为新增适配
- Sidebar 折叠用 JS state(抽屉 + backdrop);不持久化(刷新即重置,符合「窄屏是临时」语义)
- 触控最小命中区域 44×44px(WCAG)
- Conventional Commits;commit 末尾附 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 在 `fix/gis-runtime-bugs` 分支提交;**不** push 不开 PR(用户后续决定)
- 不顺手重构
- lint clean;`pnpm exec vitest run` 全过(原 347 + 新增 0;纯 CSS + UI 状态)
- 浏览器级验证(headless 跑不了,留用户手动)

---

## Task 1: 完整响应式适配(纯 CSS + UI 状态)

**Files:**
- Modify: `packages/react-components/src/user-space/index.css`(加 `@media (max-width: 900px)` 和 `@media (max-width: 640px)` 块,调整布局/字体/表格水平滚/触控尺寸)
- Modify: `packages/react-components/src/user-space/index.tsx`(加 `sidebarOpen` state;汉堡按钮在 topbar;Sidebar 接收 open prop 切换抽屉态)
- Modify: `packages/react-components/src/user-space/src/pages/Sidebar.tsx`(接收 `open` prop;drawer 渲染 overlay;内部点击 close)

### Step 1: 加断点规划到 CSS 顶部注释

在 `index.css` 「shell」之上加一段:

```css
/* ── responsive break ─────────────────────────────
   desktop  (>900px): default —— 两栏 grid(sidebar 240px + main 1fr)
   tablet   (641-900px): 同 desktop 但 sidebar 180px,padding 缩到 16px
   mobile   (≤640px):  sidebar 抽屉(默认关),topbar + 汉堡按钮,
                       tabs 横滚,表格横滚,触控 44px

   实现位置:每档 @media 独立块,集中在 CSS 末尾「media queries」章节,
   避免分散到原始声明里;响应式层是叠加在桌面默认上的修改,
   删掉响应式层不会回不去。
*/
```

### Step 2: 添加 `sl-us-modal-backdrop` 在 mobile 模式的适配(已有 92vw,只需小调)

### Step 3: 平板档(641-900px)

```css
@media (max-width: 900px) {
  .sl-us-root { grid-template-columns: 180px 1fr; }
  .sl-us-side__brand { padding: 12px 12px; }
  .sl-us-side__section { padding: 10px 6px; }
  .sl-us-side__brand-name { font-size: 12px; }
  .sl-us-side__item { padding: 5px 6px; font-size: 12px; }
  .sl-us-topbar, .sl-us-tabs, .sl-us-toolbar { padding-left: 14px; padding-right: 14px; }
  .sl-us-table-wrap { margin-left: 14px; margin-right: 14px; }
  .sl-us-modal { width: min(520px, 92vw); }
}
```

### Step 4: 移动档(≤640px)

```css
@media (max-width: 640px) {
  .sl-us-root {
    grid-template-columns: 1fr;     /* 单栏,sidebar 浮层 */
    font-size: 14px;                /* 加大基础字号 */
  }
  /* Sidebar 默认隐藏,作为抽屉(sl-us-side.is-open 才显) */
  .sl-us-side {
    position: fixed; inset: 0 auto 0 0;       /* 左抽屉 */
    width: min(280px, 80vw);
    z-index: 100;
    transform: translateX(-100%);             /* 默认滑出 */
    transition: transform 0.18s ease;
    border-right: 1px solid var(--border);
  }
  .sl-us-side.is-open {
    transform: translateX(0);
  }
  /* 抽屉打开时的暗色遮罩(点击关闭) */
  .sl-us-side-backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }
  /* topbar:加汉堡按钮位置 */
  .sl-us-topbar__burger {
    width: 36px; height: 36px;
    display: none;                /* 默认桌面隐藏 */
    align-items: center; justify-content: center;
    border-radius: 6px;
    color: var(--fg-2);
    flex-shrink: 0;
  }
  .sl-us-topbar__burger:hover { background: var(--hover); color: var(--fg); }
  .sl-us-topbar { padding: 8px 12px; gap: 8px; }
  .sl-us-topbar__title { font-size: 14px; max-width: 50vw;
                          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* tabs 横滚(4 tab 不再挤) */
  .sl-us-tabs {
    padding: 8px 12px; gap: 4px;
    overflow-x: auto;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  .sl-us-tab { padding: 8px 12px; flex-shrink: 0; }

  /* 工具栏 padding 缩 */
  .sl-us-toolbar { padding: 8px 12px; flex-wrap: wrap; }
  .sl-us-toolbar__spacer { width: 100%; height: 0; }    /* spacer 换行占位 */

  /* 表格水平滚(关键修复:原 overflow:hidden 会截掉) */
  .sl-us-table-wrap {
    margin: 0 12px 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .sl-us-table { min-width: 480px; }   /* 表不收缩到挤,触发滚动 */

  /* 触控 44px:按钮/输入最小高 */
  .sl-us-btn { min-height: 36px; padding: 8px 12px; }
  .sl-us-btn--sm { min-height: 32px; }
  .sl-us-input, .sl-us-side__add, .sl-us-side__user-action {
    min-height: 36px;
  }

  /* modal 占满全屏(去掉 width/min,width 改为 100vw/100vh) */
  .sl-us-modal {
    width: 100vw;
    max-height: 100vh;
    height: 100dvh;
    border-radius: 0;
    border: none;
  }

  /* topbar 内 hamburger 仅在 mobile 显 */
  .sl-us-topbar__burger { display: inline-flex; }
  /* sidebar 在 mobile 显 */
  .sl-us-side, .sl-us-side-backdrop { display: block; }
  /* sidebar 默认隐藏(desktop)再覆盖一遍 */
  .sl-us-side { display: block; }   /* 已经显了 */
  /* 但 desktop 模式 .sl-us-side 不该是 fixed —— 用一个 .sl-us-root 的子选择器? */
}
```

> ⚠️ 上面 `@media (max-width: 640px)` 内部的 `.sl-us-side` 块会覆盖 desktop 默认的 `position: relative; transform: none`(由 flex grid 给出)。这是设计 —— mobile 单独重定义。但需要 desktop 侧显式:

```css
/* 默认(桌面):sidebar 是 grid item,不是 fixed */
.sl-us-side {
  position: relative;          /* 显式 */
  transform: none;
}
/* mobile 媒体查询再覆盖 */
```

### Step 5: 移动 topbar 加汉堡按钮 + 抽屉 backdrop

`index.tsx`:

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);

return (
  <div className="sl-us-root">
    {sidebarOpen && <div className="sl-us-side-backdrop" onClick={() => setSidebarOpen(false)} />}
    <Sidebar
      open={sidebarOpen}                  // 新增 prop
      groups={safeGroups}
      ...
      onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}   // 选完关
    />
    <main className="sl-us-main">
      {selectedGroup ? (
        <>
          <div className="sl-us-topbar">
            <button
              className="sl-us-topbar__burger"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="切换工作空间列表"
            >
              ☰
            </button>
            <div className="sl-us-topbar__title">{selectedGroup.name}</div>
            ...
```

`Sidebar.tsx` props 加 `open: boolean`,根 `<aside>` 加 `is-open` 类:

```tsx
<aside className={`sl-us-side${open ? ' is-open' : ''}`}>
  ...
</aside>
```

### Step 6: 验证 + commit

```bash
pnpm exec vitest run   # 347/347 仍过(无业务逻辑改动)
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/   # 干净
```

浏览器手动验证清单(留给你):
- [ ] 1920×1080 桌面:布局不变
- [ ] 1024×768 横屏:sidebar 180px,内边距缩
- [ ] 768×1024 平板:同 1024
- [ ] 375×667 手机(Safari/Chrome devtools):汉堡按钮显,点开抽屉,选完关;表格横滚;tabs 横滚;modal 占满;按钮 44px

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(user-space): full responsive layout

Breakpoints: >900px desktop (240px sidebar), 641-900px tablet
(180px sidebar), ≤640px mobile (drawer sidebar + hamburger +
table horizontal scroll + 44px touch targets + full-screen modal).
Pure CSS @media + minimal JS state (sidebarOpen in index.tsx).
Desktop layout unchanged; no business-logic changes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

## 不做(避免越界)

- 不动 sidebar 业务内容(列表/创建表单/用户卡)
- 不为移动端写新组件(纯 CSS 改)
- 不持久化 sidebar 折叠态(刷新即重置,符合"窄屏临时"语义)
- 不做 PWA / 移动端专用导航模式
- 不动 store / service / api(纯前端布局)
- 不加 dark/light 主题切换

## 风险与注意

1. **`.sl-us-side` 默认相对定位 + 移动 `position: fixed`** 需要显式声明(避免 transform 重影)
2. **backdrop 必须 z-index < sidebar 但 > main**,否则点不关
3. **mobile modal 占满全屏** 后 `max-height: 86vh` 不再生效;确认表单/key 编辑器在 100dvh 内可滚
4. **表格 `min-width: 480px`** 是触发横滚的关键;太宽会一直滚,太窄(<360px)又挤
5. **safari iOS**:100vh 在地址栏收起/展开时会跳;用 `100dvh` 已经做了
6. **JS disabled 用户**:汉堡按钮靠 JS state 控制可见;最坏情况下 mobile 没 JS 看不到 sidebar —— **CSS 不应依赖 JS**;需要让汉堡按钮默认 inline-flex,JS 只切换 is-open 类
7. **Sidebar.tsx 的 `open` prop 是新增** → 现有调用方(只有 index.tsx)必须传,否则 type 错误;先全部提交前检查

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\task-19-report.md`:
- 状态、改动摘要、3 档断点对照、JS 改动列表、commit hash、顾虑(浏览器手动验证留给用户)

## 返回

状态、commit hash、3 档断点摘要、顾虑。完成后再 `kvcli todo done 19 --result "..."` 回填。