# Color Studio Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, this session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Phase 2a of Color Studio — UI polish (Icon+Btn, no emoji), color grouping, customizable shortcuts persisted to KV key `ve-color-key`, harmony autoFill, and multi-format export.

**Architecture:** Continues on branch `feat/color-studio-mvp-b`. Schema bumps to 1.1.0 (backwards-compatible Zod union). New host-side store for shortcut prefs (separate KV key). New UI primitives (`Icon`, `Btn`) replace emojis/bare buttons across 12 components.

**Spec:** `docs/superpowers/specs/2026-08-26-color-studio-phase2a-design.md`

---

## Global Constraints

- 沿用 MVP-B 的全部 Global Constraints(sl-cs-* 类前缀、index.tsx 顶部 import css、无新色彩存储格式、kvV1 走 default group)
- **新增 key 只有一个**:`ve-color-key`(快捷键偏好),tags 仍 `['color-studio']`
- **零 emoji**:所有 UI 文案不允许 emoji 字符
- Icon 必须 `stroke="currentColor"`,随文本色走 token
- Schema 1.0.0 数据 load 后必须无感升级到 1.1.0(vitest 覆盖)

---

## Stage 2a-M1: 数据层

### Task 1: schema 1.1.0 + 分组字段 + 迁移测试

**Files:**
- Modify: `apps/showcase/src/api/components/color-studio/types.ts`
- Modify: `apps/showcase/src/api/components/color-studio/docSchema.ts`
- Create: `packages/react-components/__tests__/color-studio-groups.test.ts`

**Interfaces:**
- Produces: `ColorEntry.group?: string`, `ColorStudioViewState.groupBy: 'none'|'group'`, schemaVersion `'1.0.0'|'1.1.0'`, `migrateDoc(raw): ColorStudioDocument`(内部函数,Zod 解析后补默认值)

- [ ] Step 1: 写失败测试 `color-studio-groups.test.ts`:1.0.0 文档 load 后 groupBy==='none' 且 schemaVersion==='1.1.0';1.1.0 文档带 group 字段 round-trip 保留
- [ ] Step 2: 跑测试确认 fail
- [ ] Step 3: types.ts 加 `group?: string`、`groupBy`,schemaVersion 类型放宽;docSchema.ts 加 v1.0.0 兼容分支(superRefine 或 preprocessing 补默认值后用 1.1.0 schema 校验)
- [ ] Step 4: 测试过;`color-studio-store.test.ts` 回归仍绿
- [ ] Step 5: Commit `feat(color-studio): schema 1.1.0 with color groups + migration`

### Task 2: createShortcutPrefsStore(ve-color-key)

**Files:**
- Create: `apps/showcase/src/api/components/color-studio/createShortcutPrefsStore.ts`
- Modify: `apps/showcase/src/api/components/color-studio/index.ts`(barrel)
- Create: `apps/showcase/__tests__/color-studio-shortcut-prefs.test.ts`

**Interfaces:**
- Produces: `ShortcutPrefs`, `DEFAULT_SHORTCUTS`, `createShortcutPrefsStore(): { load, save }`,key=`'ve-color-key'`

- [ ] Step 1: 失败测试:load 走 KV GET `/api/v1/kv/ve-color-key`;code 50/404 → DEFAULT_SHORTCUTS;save POST body 含 key/tags/ttl
- [ ] Step 2: 实现 store(与主 store 同模式)
- [ ] Step 3: 测试过 + barrel 更新
- [ ] Step 4: Commit `feat(api): shortcut prefs store on ve-color-key`

---

## Stage 2a-M2: UI 基元

### Task 3: Icon.tsx + Btn.tsx + CSS

**Files:**
- Create: `packages/react-components/src/color-studio/src/components/ui/Icon.tsx`
- Create: `packages/react-components/src/color-studio/src/components/ui/Btn.tsx`
- Modify: `packages/react-components/src/color-studio/index.css`(追加 .sl-cs-btn / .sl-cs-input / .sl-cs-icon)

**Interfaces:**
- Produces: `<Icon name size/>`(18 names,类型安全 name 联合)、`<Btn variant size icon disabled onClick>`

- [ ] Step 1: 写 Icon.tsx(18 个 path,手工绘制简洁线性图标)
- [ ] Step 2: 写 Btn.tsx + CSS(四 variant × 两 size × 全状态)
- [ ] Step 3: lint + 既有测试回归
- [ ] Step 4: Commit `feat(color-studio): Icon + Btn UI primitives`

### Task 4: 全组件替换(去 emoji / 裸按钮)

**Files:**
- Modify: `ColorChip.tsx` `PickerPanel.tsx` `PaletteSidebar.tsx` `QuickAddBar.tsx` `ColorDetailPanel.tsx` `HistoryStrip.tsx` `KeyboardHints.tsx` `ImageColorPicker.tsx` `ColorWheel.tsx`

- [ ] Step 1: ColorChip:🔒🔓→lock/lockOpen,×→close
- [ ] Step 2: PickerPanel:🎯→eyedropper;ImageColorPicker 按钮样式化
- [ ] Step 3: ColorDetailPanel 复制→Btn icon=copy;QuickAddBar 添加→Btn variant=primary
- [ ] Step 4: PaletteSidebar +/-/↑/↓ → Btn/ChevronUp/ChevronDown
- [ ] Step 5: ColorWheel harmony 按钮 → .sl-cs-btn ghost;input 统一样式
- [ ] Step 6: lint + 全测试回归 + 浏览器截图确认零 emoji
- [ ] Step 7: Commit `refactor(color-studio): replace emojis with Icon, style all buttons`

---

## Stage 2a-M3: 功能

### Task 5: useShortcutPrefs + ShortcutEditor + 快捷键消费

**Files:**
- Create: `packages/react-components/src/color-studio/src/hooks/useShortcutPrefs.ts`
- Create: `packages/react-components/src/color-studio/src/components/ShortcutEditor.tsx`
- Modify: `useKeyboardShortcuts.ts` `KeyboardHints.tsx`

**Interfaces:**
- Consumes: `createShortcutPrefsStore`
- Produces: `useShortcutPrefs(): { prefs, setKey(action, key), resetAll }`

- [ ] Step 1: hook(mount load / debounce save / 冲突检测 setKey 时同键互斥提示)
- [ ] Step 2: ShortcutEditor UI(KeyboardHints 升级:每行 action label + kbd 按钮,点击进入捕获态,按键即绑定,Esc 取消)
- [ ] Step 3: useKeyboardShortcuts 改读 prefs.shortcuts 映射
- [ ] Step 4: lint + 手动验证:改 'p'→'x' 后按 x 触发取色;刷新保留
- [ ] Step 5: Commit `feat(color-studio): customizable shortcuts persisted to ve-color-key`

### Task 6: PaletteSidebar 分组渲染

**Files:**
- Modify: `PaletteSidebar.tsx` `ColorChip.tsx`

- [ ] Step 1: 渲染逻辑:viewState.groupBy==='group' 时按 ColorEntry.group 聚合,组头(Icon group + 名称 + 折叠 chevron + 计数),未分组放最后"未分组"节
- [ ] Step 2: 组编辑:chip 右侧加"分组"按钮弹小菜单(现有组列表 + 新建输入)
- [ ] Step 3: 顶栏视图切换(平铺/分组)
- [ ] Step 4: vitest 用例(分组聚合纯函数抽出 `groupByEntries`)
- [ ] Step 5: Commit `feat(color-studio): color grouping with collapsible sections`

### Task 7: 和声 autoFill

**Files:**
- Modify: `useHarmony.ts` `ColorWheel.tsx`(开关 UI) `ColorChip.tsx`(派生标记)

- [ ] Step 1: useHarmony:检测 anchor hex 变化,autoFill 开启则把派生 hex 写回 derivedFrom 匹配的 colorEntries(新增派生条目补 derivedFrom;旧派生条目更新)
- [ ] Step 2: ColorWheel 和声区加 autoFill toggle
- [ ] Step 3: ColorChip derivedFrom 条目右上角小圆点标记(title 提示"派生自和声规则")
- [ ] Step 4: vitest(autoFill 纯逻辑抽 `applyAutoFill(doc, paletteId): doc`)
- [ ] Step 5: Commit `feat(color-studio): harmony autoFill on anchor change`

### Task 8: exporters + ExportModal

**Files:**
- Create: `packages/react-components/src/color-studio/src/engine/exporters.ts`
- Create: `packages/react-components/src/color-studio/src/components/ExportModal.tsx`
- Create: `packages/react-components/__tests__/color-studio-exporters.test.ts`
- Modify: `index.tsx`(顶栏导出按钮 + Modal 挂载)

**Interfaces:**
- Produces: `exportCssVars(doc): string`、`exportTailwind(doc): string`、`exportDesignTokens(doc): string`、`exportJson(doc): string`

- [ ] Step 1: 失败测试:固定 doc → 四种格式输出含期望片段(--color-默认调色板-0、theme.extend.colors、"\\$type":"color"、schemaVersion)
- [ ] Step 2: 实现 exporters 纯函数
- [ ] Step 3: ExportModal(format tabs + textarea 预览 + 复制 Btn + 下载 Btn;下载用 Blob+URL.createObjectURL)
- [ ] Step 4: index.tsx 顶栏加"导出"Btn(icon download)打开 Modal
- [ ] Step 5: 测试过 + 手动验证四种格式
- [ ] Step 6: Commit `feat(color-studio): multi-format export (CSS vars / Tailwind / Design Tokens / JSON)`

---

## Stage 2a-M4: 全量验证

### Task 9: lint / test / build / 浏览器

- [ ] pnpm lint(新文件 0 err)
- [ ] pnpm exec vitest run 全绿(预期 ~540)
- [ ] pnpm --filter @style-library/showcase build 通过
- [ ] 浏览器:零 emoji / 按钮全状态 / 分组折叠 / autoFill 跟随 / 改键刷新保留 / 导出四格式正确
- [ ] Commit 收尾(如有遗漏)

---

## Self-Review

- Spec coverage: §1→T1, §2→T2+T5, §3→T3+T4, §4→T7, §5→T8, §6 文件清单与各 task 对齐, §7→T9
- 无占位符;类型一致(ShortcutPrefs 在 T2 定义、T5 消费)
- 与 MVP-B 偏差无新增;所有改动在同一 feature 分支继续
