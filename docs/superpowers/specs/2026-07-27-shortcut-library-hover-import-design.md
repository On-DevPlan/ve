# ShortcutLibrary: Keyboard Hover + TOML Import

Date: 2026-07-27

## Overview

Add two features to the `ShortcutLibrary` component:

1. **Keyboard Hover Highlight**: hovering a row in the shortcut table highlights the corresponding keys on the keyboard preview.
2. **TOML Import**: paste TOML text or upload a `.toml` file to bulk-import shortcut groups, with an inline format reference.

---

## 1. Keyboard Hover Highlight

### Current State

`ShortcutTable` already emits `onCapture(codes: Set<string>)` — fired on capture confirm, triggers a **blue** 3-second auto-fade highlight on the `Keyboard` preview.

### Changes

Add a second highlight channel that is ephemeral (mouse-driven, no timer):

| Channel | Trigger | CSS class | Color | Lifetime |
|---|---|---|---|---|
| `highlightedCodes` (existing) | Capture/Edit confirm | `.is-on` | blue `#2563eb` | 3s auto-fade |
| `hoveredCodes` (new) | Row mouse-enter | `.is-hover` | orange `#ea580c` | Until mouse-leave |

### Data flow

```
ShortcutTable
  + onHover?: (codes: Set<string> | null) => void
  → onMouseEnter on <tr>: onHover(codes of that row's combo)
  → onMouseLeave on <tr>: onHover(null)

index.tsx
  + const [hoveredCodes, setHoveredCodes] = useState<Set<string>>(new Set())
  → passes hoveredCodes to Keyboard
  → passes onHover={setHoveredCodes} to ShortcutTable

Keyboard
  + hoveredCodes prop
  → renders both highlightedCodes (blue) and hoveredCodes (orange)
  → priority: hover > capture (orange overrides blue for the duration of the hover)
```

### Keyboard visual priority

For any given key:
- If `hoveredCodes.has(code)` → `.is-hover` (orange) — user's mouse focus is most immediate
- Else if `highlightedCodes.has(code)` → `.is-on` (blue)
- Else → default (gray)

---

## 2. TOML Import

### 2.1 Format

```toml
# ShortcutLibrary 导入格式
# UTF-8 编码

[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"

[[groups.shortcuts]]
combo = "Ctrl+Shift+P"
desc = "命令面板"

[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"
```

**Fields:**

| Path | Type | Required | Description |
|---|---|---|---|
| `[[groups]]` | array of tables | yes | One entry per group |
| `groups.name` | string | yes | Group display name |
| `[[groups.shortcuts]]` | array of tables | no | Shortcuts in this group |
| `shortcuts.combo` | string | yes | Display-label combo (`Ctrl+R`, `Shift+Alt+F`) |
| `shortcuts.desc` | string | no | Description of what the shortcut does |

### 2.2 Combo parsing

`combo` uses **display labels** (what a user would type), not `KeyboardEvent.code`:

| Input label | Mapped code |
|---|---|
| `Ctrl` | `ControlLeft` |
| `Shift` | `ShiftLeft` |
| `Alt` | `AltLeft` |
| `⌘` | `MetaLeft` |
| `Enter`, `Esc`, `Tab`, `Space`, `↑`, `↓` | Direct match |
| Single letter or digit → `KeyX` / `DigitN` | Constructed |
| `F1`–`F12` | Passed through |
| `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`, `` ` `` | Direct match in `LABEL_MAP` reverse lookup |

Modifier-only label without a main key → reject with error.

### 2.3 Parser

TOML parsing is handled by a dedicated `src/import-parser.ts` module (~80 lines). No external TOML library dependency. The parser handles only the subset of TOML used by this format:

- Blank lines and `#` comments
- `[[groups]]` and `[[groups.shortcuts]]` array-of-tables headers
- `name = "..."`
- `combo = "..."`
- `desc = "..."`

It rejects anything outside this subset with a clear error message.

### 2.4 Import UI

A new `ImportModal.tsx` component. Entry point: a button in the top bar next to the search input.

```
┌── 导入快捷键 ─────────────────────────────┐
│                                            │
│  导入方式: [○ 粘贴文本] [○ 选择文件]         │
│                                            │
│  ┌─ 粘贴 TOML（或选择 .toml 文件）─────┐    │
│  │ [[groups]]                          │    │
│  │ name = "VSCode"                     │    │
│  │ ...                                 │    │
│  └─────────────────────────────────────┘    │
│                                            │
│  预览: 2 个分组, 5 条快捷键                  │
│                                            │
│  ┌─ 格式说明 ──── (折叠面板) ────┐          │
│  │  [[groups]]  = 分组           │          │
│  │  name        = 分组名称       │          │
│  │  combo       = 组合键         │          │
│  │  desc        = 说明           │          │
│  └────────────────────────────────┘          │
│                                            │
│  [取消]  [确认导入]                         │
└────────────────────────────────────────────┘
```

**States:**

| State | UI |
|---|---|
| Empty | Placeholder text in textarea; preview shows "0 分组, 0 条" |
| Valid TOML | Preview updates: "2 分组, 5 条快捷键"; Confirm button enabled |
| Parse error | Red error banner below textarea; Confirm disabled |
| File selected | File content loaded into textarea; same validation flow |
| After import | Brief "✅ 导入成功" toast; modal closes; store refreshes |

**File upload:** `<input type="file" accept=".toml">`, read with `FileReader.readAsText()`.

### 2.5 Import behavior

**Merge semantics (增量合并):**

For each `[[groups]]` in the import TOML:
1. Look up existing group by `name`:
   - **Found**: append shortcuts to that group's shortcut list
   - **Not found**: create new group with `id` = `freshId()`, `shortcuts = []`, then append
2. Each shortcut gets a fresh `id` and `createdAt = Date.now()`
3. Duplicate combo detection is NOT done at import time — the existing conflict detection in ShortcutTable will catch same-group duplicates visually after import.

### 2.6 `useShortcuts` API addition

```typescript
interface ImportResult {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

function importFromToml(toml: string): ImportResult;
```

The `errors` array captures parse-time per-entry failures (bad combo, missing fields) without aborting the entire import.

### 2.7 Format documentation

A standalone `IMPORT_FORMAT.md` in `packages/react-components/src/shortcut-library/`, also rendered inline in the ImportModal's collapsible "格式说明" panel.

---

## 3. Files Changed

| File | Action | Lines (est.) |
|---|---|---|
| `packages/react-components/src/shortcut-library/index.tsx` | Modify | +10 |
| `packages/react-components/src/shortcut-library/ShortcutTable.tsx` | Modify | +15 |
| `packages/react-components/src/shortcut-library/Keyboard.tsx` | Modify | +12 |
| `packages/react-components/src/shortcut-library/ImportModal.tsx` | **Add** | ~150 |
| `packages/react-components/src/shortcut-library/import-parser.ts` | **Add** | ~120 |
| `packages/react-components/src/shortcut-library/IMPORT_FORMAT.md` | **Add** | ~80 |
| `packages/react-components/src/shortcut-library/index.css` | Modify | +50 |
| `packages/react-components/src/shortcut-library/useShortcuts.ts` | Modify | +20 |

---

## 4. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Empty TOML text | Confirm button disabled; preview shows "0 分组" |
| Malformed TOML (missing `]`, unknown keys) | Red error banner: "第 X 行解析失败: ..." |
| Duplicate group `name` in import TOML | Merge into first occurrence; subsequent `[[groups]]` with same name are appends to the same group |
| Combo with modifiers only (no main key) | Error per-entry: "Ctrl+Shift 缺少主键"; other entries still import |
| File read fails (wrong type, encoding) | "无法读取文件: ..." |
| File > 1 MB | Reject with "文件过大,请控制在 1MB 以内" |
| localStorage quota exceeded | Import succeeds in memory; save step catches silently (same as existing behavior) |
