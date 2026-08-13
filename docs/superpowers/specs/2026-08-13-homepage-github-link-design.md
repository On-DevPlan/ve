# 主页添加项目 GitHub 链接 — 设计

> **状态:** 待用户评审 spec;确认后交 `superpowers:writing-plans` 出实现计划。
> **仓库:** `On-DevPlan/ve`(`https://github.com/On-DevPlan/ve`)
> **范围:** 仅 ClassicMode sidebar。

---

## Goal

在 `apps/showcase/src/pages/home/ClassicMode.vue` 的 sidebar 底部添加一个外部链接,指向项目 GitHub 仓库;PinMode / HomeMobile / HomePC 不动。

## Non-Goals

- 不在 PinMode / HomeMobile 加 GitHub 链接(本期不动)。
- 不动 `.sidebar__foot` 现有的「v0.1 · main · <platform>」文本。
- 不抽组件、不建常量(YAGNI:仅一个 caller;URL 改动频率极低)。
- 不加埋点 / 跳转统计。
- 不改 ESLint / build / package.json。

## Background

- `ClassicMode.vue` 是 PC 桌面端的杂志式首页:sidebar(品牌 + 搜索 + Groups 导航 + Platform 切换 + Mode 切换 + 底部版本文本)+ 主区卡片墙。
- sidebar 底部现有 `.sidebar__foot`(line 166-168, mono 字体 10px, `var(--ink-mute)` 色)。其下是 `.auth-chip`(line 379+, dashed 顶边)。
- 应用内**无任何已有 GitHub 引用**(Grep `github.com / GitHub / github:` 在 apps/showcase 全无命中)。
- Lucide 在 `HomeMobile.vue` 用过,但 ClassicMode 未引入;新增 icon 需要多一次 import,得不偿失。

## Design

### 模板插入

在 line 168 的 `<div class="sidebar__foot">...</div>` **之后**新增:

```vue
<a
  class="sidebar__github"
  href="https://github.com/On-DevPlan/ve"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="项目 GitHub 仓库(在新标签页打开)"
>GitHub ↗</a>
```

行 169 的 `</aside>` 不动。

### 样式追加

在 line 377 的 `.sidebar__foot .platform--mobile { color: #7c3aed; }` 之后(line 378 后),新增:

```css
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
```

继承 `.sidebar__foot` 的字体族 / 字号 / 字距 / 默认色;只补 `display: block`/`inline-block` + 4px 上间距 + 无下划线 + hover 反馈。

### 行为细节

| 项 | 决策 |
| --- | --- |
| 新标签打开 | 是 (`target="_blank"`) |
| `rel` | `noopener noreferrer`(标准外部链接防护) |
| `aria-label` | 中文「项目 GitHub 仓库(在新标签页打开)」(屏幕阅读器朗读;原文案提示新标签) |
| URL | `https://github.com/On-DevPlan/ve`(与 `git remote get-url origin` 一致) |
| 文 | `GitHub ↗`(↗ 是 U+2197 NORTH EAST ARROW,纯 Unicode,无字体依赖) |

## Touch List

| 类型 | 文件 |
| --- | --- |
| 修改 | `apps/showcase/src/pages/home/ClassicMode.vue`(template + scoped style 各一段) |

## Acceptance Criteria

- [ ] `pnpm exec vitest run` 全绿(57 文件 / 439 用例不变;无新逻辑,无需新测试)。
- [ ] `pnpm exec eslint --max-warnings=0 apps/showcase/src/pages/home/ClassicMode.vue` 0 error / 0 warning。
- [ ] 桌面端 ClassicMode 视图下:
  - sidebar 底部「v0.1 · main · pc」一行未变。
  - 其下出现 `GitHub ↗` 文本,与上一行间距 4px,字号/字距/色与上一行一致。
  - hover → 出现下划线 + 字色由 `ink-mute` 变 `ink`。
  - 点击 → 新标签打开 `https://github.com/On-DevPlan/ve`。
- [ ] PinMode / HomeMobile / HomePC 无任何变化。

## Risks

| 风险 | 缓解 |
| --- | --- |
| `↗` 字符在某些 fallback 字体下不可见 | `JetBrains Mono` + 主流系统 fallback 都含此 glyph;若用户报告缺失可换 `→` 或 SVG |
| `var(--ink-mute)` / `var(--ink)` 不存在导致样式塌 | 现有 `.sidebar__foot` 已用 `var(--ink-mute)` 且渲染正常;`--ink` 在项目其它地方也被用;无须新增 token |

## Out of Scope(留给未来)

- 在 PinMode / HomeMobile / 全局 shell 同样加 GitHub 链接
- GitHub Stars 数 / CONTRIBUTORS.md 展示
- "在 GitHub 上编辑此页"链接(当前路由是按组件生成,无对应锚点)
- GitHub release notes 拉取