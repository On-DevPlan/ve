# GOST HTML Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `.claude/skills/goat/` 下的 HTML demo 逐个迁移为 Vue 3 组件，group=gost，每 5-8 个 demo 为一批，每批一次 commit。

**Architecture:** 每个 demo → `src/components/gost/NoN_Title/{component.js, index.vue}`，Ve Workflow 自动发现，pnpm build 验证。

**Tech Stack:** Vue 3 Composition API, Vite, pure CSS/JS (no extra deps).

---

## 完整 Demo 批次列表

批次按年份+序号排列，共 15 批，约 113 个 demo：

| 批次 | 目录名（源） | component name | 数量 |
|------|------------|----------------|------|
| Batch 1 | 2021-01 系列 | No1-No5 | 5 |
| Batch 2 | 2021-02/03 系列 | No8-No14 | 6 |
| Batch 3 | 2021-04/05 系列 | No15-No20 | 6 |
| Batch 4 | 2021-06/07/08 系列 | No21-No26 | 6 |
| Batch 5 | 2021-09/10 系列 | No27-No33 | 7 |
| Batch 6 | 2021-11/12 系列 | No34-No39 | 6 |
| Batch 7 | 2022-01/03/04 系列 | No40-No45 | 6 |
| Batch 8 | 2022-07/09/10 系列 | No46-No51 | 6 |
| Batch 9 | 2022-11/12 系列 | No52-No57 | 6 |
| Batch 10 | 2023-01/02 系列 | No58-No63 | 6 |
| Batch 11 | 2023-03/04 系列 | No64-No69 | 6 |
| Batch 12 | 2023-05/06 系列 | No70-No75 | 6 |
| Batch 13 | 2023-07/08/09 系列 | No76-No81 | 6 |
| Batch 14 | 2023-10/11/12 系列 | No82-No87 | 6 |
| Batch 15 | 2024-2025 系列 | No88-No100+ | 13+ |

---

## 每批次通用转换模板

每个 demo 转换步骤（以第一个为例，其余批次参照执行）：

### 源文件定位
从 `find .claude/skills/goat -name "*.html"` 列表中找对应的 html 文件。
**选择规则**：
- 优先选 `index.html`（若无 index.html 选主文件名如 `sbpk.html`、`fireworks.html`）
- 跳过 `index copy*.html`、`indexs.html`、`demo_index.html`（变体版本）
- 跳过 `font_*/demo_index.html`（字体子目录中的引用文件）

### component.js 模板
```js
export default {
  name: 'No{N}_{Title}',  // 如 No1_ClickPopText
  title: '{原title标签内容}',
  description: '{从内容提炼的一句话描述}',
  version: '1.0.0',
  group: 'gost',
  category: 'demos',
  tags: ['css', 'animation'],  // 从效果类型提取
  component: './index.vue'
}
```

### index.vue 模板
```vue
<script setup>
// 原 <script> 内容转 Vue 3 Composition API
// document.onclick → @click="handler"
// document.onmousemove → @mousemove="handler"
// setTimeout/setInterval → 放 onUnmounted 清理
</script>

<template>
  <div class="demo-wrapper">
    <!-- 原 <body> 内容，去掉 <body> <html> <head> 标签 -->
    <!-- 把所有事件处理属性改为 Vue 绑定 -->
  </div>
</template>

<style scoped>
/* 原 <style> 内容 */
/* 去掉 body {} 外层包装，直接写选择器 */
/* 添加 .demo-wrapper { width: 100vw; height: 100vh; overflow: hidden; } */
</style>
```

---

## Batch 1 Tasks

**Demos:** No1 页面点击文字, No2 百叶窗, No3 赛博朋克霓虹灯, No8 鼠标跟踪导航条, No9 3D翻页漫画书

### Task B1: 迁移 Batch 1 (5 demos)

**Files:**
- Create: `src/components/gost/No1_ClickPopText/component.js`
- Create: `src/components/gost/No1_ClickPopText/index.vue`
- Create: `src/components/gost/No2_WindowBlind/component.js`
- Create: `src/components/gost/No2_WindowBlind/index.vue`
- Create: `src/components/gost/No3_CyberPunkNeon/component.js`
- Create: `src/components/gost/No3_CyberPunkNeon/index.vue`
- Create: `src/components/gost/No8_MouseNavBar/component.js`
- Create: `src/components/gost/No8_MouseNavBar/index.vue`
- Create: `src/components/gost/No9_3DFlipBook/component.js`
- Create: `src/components/gost/No9_3DFlipBook/index.vue`

**Source files:**
- `.claude/skills/goat/2021-01-26_No1.HtmlCSSJs制作单机页面弹出文字/ds.html` → No1
- `.claude/skills/goat/2021-01-27_No2.HTML+CSS仅用50行代码敲出最精简的百叶窗效果/百叶窗.html` → No2
- `.claude/skills/goat/2021-01-28_No3.HTML+CSS制作超级炫酷的赛博朋克故障霓虹灯！！/sbpk.html` → No3
- `.claude/skills/goat/2021-02-03_No8.HTMLCSS制作鼠标跟踪导航条/dhl.html` → No8
- `.claude/skills/goat/2021-02-12_用CSS制作3D翻页漫画书/fydh.html` → No9

- [ ] **Step 1: Read all 5 source HTML files** (Read tool)

```bash
# Read each file and extract:
# 1. <style> content → index.vue <style scoped>
# 2. <body> inner HTML → index.vue <template>
# 3. <script> content → index.vue <script setup>
# 4. <title> → component.js title
```

- [ ] **Step 2: Create component directories**

```bash
mkdir -p src/components/gost/No1_ClickPopText
mkdir -p src/components/gost/No2_WindowBlind
mkdir -p src/components/gost/No3_CyberPunkNeon
mkdir -p src/components/gost/No8_MouseNavBar
mkdir -p src/components/gost/No9_3DFlipBook
```

- [ ] **Step 3: Write component.js files** (Write tool, 5 files)

- [ ] **Step 4: Write index.vue files** (Write tool, 5 files)

**Key Vue 3 conversions:**
- `document.onclick = function(e) {...}` → `const handleClick = (e) => {...}` + `@click="handleClick"` on root div
- `var arr = [...]` → `const arr = ref([...])` if reactive, or `const arr = [...]` if not
- `setTimeout(fn, delay)` → store id, clear in `onUnmounted`
- `setInterval(fn, delay)` → store id, clear in `onUnmounted`
- `document.addEventListener` → `window.addEventListener` + cleanup in `onUnmounted`
- `body { margin: 0; overflow: hidden; }` → `.demo-wrapper { width: 100vw; height: 100vh; overflow: hidden; margin: 0; }`

- [ ] **Step 5: Run build to verify**

```bash
pnpm run build
# Expected: "✓ built" with no errors
```

- [ ] **Step 6: Commit and push**

```bash
git add src/components/gost/No1_ClickPopText src/components/gost/No2_WindowBlind src/components/gost/No3_CyberPunkNeon src/components/gost/No8_MouseNavBar src/components/gost/No9_3DFlipBook
git commit -m "feat(gost): migrate No1-No9 demos (ClickPop, WindowBlind, CyberPunk, MouseNav, 3DFlipBook)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin deploy
```

---

## Batch 2 Tasks

**Demos:** No10 3D轮播图片, No11 动态搜索框, No12 登录界面, No13 极简登录页, No14 视觉差名片, No15 滑动名片

**Source files:**
- `.claude/skills/goat/2021-02-20_[CSS] 3D轮播图片/lbtp.html` → No10
- `.claude/skills/goat/2021-03-01_【CSS】3分钟实现漂亮的动态搜索框/ssk.html` → No11
- `.claude/skills/goat/2021-03-09_[CSS]简洁美观の登入界面/dr.html` → No12
- `.claude/skills/goat/2021-03-14_[CSS]极简美登入页/drjm.html` → No13
- `.claude/skills/goat/2021-03-19_[CSS]这是你要的高级感吗-视觉差名片/sjcmp.html` → No14
- `.claude/skills/goat/2021-03-26_[CSS]这是你要的高级感吗-滑动名片/hdmp.html` → No15

- [ ] **Step 1: Read 6 source HTMLs → Write 12 files (6 component.js + 6 index.vue)**

- [ ] **Step 2: pnpm build**

- [ ] **Step 3: git add + commit + push**

```bash
git commit -m "feat(gost): migrate No10-No15 demos (3DCarousel, DynamicSearch, LoginUI, MinimalLogin, ParallaxCard, SlideCard)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

*(Batches 3-15 follow identical pattern: read sources → write 12-16 files → build → commit → push)*

---

## 关键注意事项

### CSS 选择器冲突处理
- 原 `body {}`、`html {}`、`* {}` 全局样式 → 全部包装进 `.demo-wrapper {}`
- `body { background }` → `.demo-wrapper { background }`
- `body { margin: 0 }` → `.demo-wrapper { margin: 0; width: 100vw; height: 100vh; overflow: hidden }`

### 字体文件
- 跳过所有 `font_*/` 子目录下的 HTML（字体文件，不是 demo）
- CSS 中 `@font-face` 引用的字体文件如果只有相对路径，保留原路径（假设 `public/` 或 `node_modules/`）

### 图片/素材资源
- 如果 demo 引用外部图片 URL → 保留 URL
- 如果引用本地相对路径（如 `./img/xxx.jpg`）→ 检查路径是否存在，不存在则注释掉该样式
- `font_*/` 子目录下的图片 → 跳过（随字体 demo 一起处理）

### 外部 CDN 依赖
- 如果 `<script src="https://cdn...">` → 保留，但需在组件中验证可用性
- 优先使用本地等效实现替代 CDN

### JS 变量提升
- `var` → `const`（推荐）或 `let`
- 全局函数 → `function` 在 `<script setup>` 顶层定义

---

## 质量检查点

每批次完成后检查：
1. `pnpm build` 无 error（warning 可忽略）
2. `git log --oneline` 有对应 commit
3. 首页 `localhost:5173` 能看到新增 gost 分组
4. 点击进入 demo 无 JS 报错
