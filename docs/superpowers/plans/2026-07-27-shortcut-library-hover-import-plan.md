# ShortcutLibrary: Keyboard Hover + TOML Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two features to the ShortcutLibrary component: (1) hovering a table row highlights corresponding keys on the keyboard preview in orange; (2) TOML paste + file-upload import with inline format reference.

**Architecture:** Hover highlight threads a new `hoveredCodes` state channel (ephemeral, no timer) alongside the existing `highlightedCodes` (3s blue). TOML import uses a zero-dependency hand-written parser for this specific TOML subset, with combo display-labels resolved back to `KeyboardEvent.code` via a reverse lookup of the existing `keymap.ts`.

**Tech Stack:** React 19, TypeScript, Vitest, CSS (no CSS-in-JS). No external TOML library.

## Global Constraints

- All CSS class names use `sl-sl-` prefix.
- All CSS color/spacing tokens use `var(--sl-*, fallback)` pattern.
- Combo field in import TOML uses display labels (`Ctrl+R`), not `KeyboardEvent.code`.
- No external TOML parser dependency — hand-parse the known subset.
- File upload limit: 1 MB.
- Import merge semantics: incremental (append to same-named group; create new group otherwise).
- Test files go in `packages/react-components/__tests__/` (tsconfig already includes `__tests__/**/*`).

---
### Task 1: Import parser

**Files:**
- Create: `packages/react-components/src/shortcut-library/import-parser.ts`
- Test: `packages/react-components/__tests__/import-parser.test.ts`

**Interfaces:**
- Produces: `parseImportToml(toml: string): ImportParseResult` — the pure parse function consumed by ImportModal and useShortcuts. `resolveCombo(input: string): KeyStroke[] | string` — resolves display-label string to KeyStroke array; returns error string on failure.

```typescript
interface ImportParseResult {
  groups: Array<{
    name: string;
    shortcuts: Array<{
      combo: KeyStroke[];
      description: string;
    }>;
  }>;
  errors: string[];  // per-entry parse failures, does NOT abort entire import
}
```

- [ ] **Step 1: Write the failing test**

The test file covers the known TOML subset, combo resolution, and error paths.

`packages/react-components/__tests__/import-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseImportToml, resolveCombo } from '../src/shortcut-library/import-parser';

describe('resolveCombo', () => {
  it('resolves Ctrl+R to ControlLeft + KeyR', () => {
    const result = resolveCombo('Ctrl+R');
    expect(result).not.toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatchObject({ code: 'ControlLeft', label: 'Ctrl', isModifier: true });
    expect(keys[1]).toMatchObject({ code: 'KeyR', label: 'R', isModifier: false });
  });

  it('resolves Shift+Alt+F to ShiftLeft + AltLeft + KeyF', () => {
    const result = resolveCombo('Shift+Alt+F');
    expect(result).not.toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatchObject({ code: 'ShiftLeft', isModifier: true });
    expect(keys[1]).toMatchObject({ code: 'AltLeft', isModifier: true });
    expect(keys[2]).toMatchObject({ code: 'KeyF', isModifier: false });
  });

  it('resolves ArrowUp', () => {
    const result = resolveCombo('↑');
    expect(result).not.toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys[0]).toMatchObject({ code: 'ArrowUp', label: '↑' });
  });

  it('rejects modifier-only combo (Ctrl+Shift)', () => {
    const result = resolveCombo('Ctrl+Shift');
    expect(typeof result).toBe('string');  // error string
  });

  it('rejects empty combo', () => {
    const result = resolveCombo('');
    expect(typeof result).toBe('string');
  });

  it('resolves single letter', () => {
    const result = resolveCombo('X');
    expect(result).not.toBeInstanceOf(Array);
    expect((result as KeyStroke[])[0]).toMatchObject({ code: 'KeyX', label: 'X' });
  });

  it('resolves F1..F12', () => {
    const result = resolveCombo('F7');
    expect(result).not.toBeInstanceOf(Array);
    expect((result as KeyStroke[])[0]).toMatchObject({ code: 'F7' });
  });
});

describe('parseImportToml', () => {
  it('parses a valid TOML with one group and one shortcut', () => {
    const toml = `[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('VSCode');
    expect(result.groups[0].shortcuts).toHaveLength(1);
    expect(result.groups[0].shortcuts[0].description).toBe('打开目录');
    expect(result.groups[0].shortcuts[0].combo.length).toBeGreaterThan(0);
  });

  it('parses two groups with multiple shortcuts', () => {
    const toml = `[[groups]]
name = "Editor"

[[groups.shortcuts]]
combo = "Ctrl+S"
desc = "保存"

[[groups]]
name = "Browser"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新标签页"

[[groups.shortcuts]]
combo = "Ctrl+W"
desc = "关闭标签页"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].shortcuts).toHaveLength(1);
    expect(result.groups[1].shortcuts).toHaveLength(2);
  });

  it('returns empty result for empty input', () => {
    const result = parseImportToml('');
    expect(result.groups).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for malformed combo in shortcut entry', () => {
    const toml = `[[groups]]
name = "Test"

[[groups.shortcuts]]
combo = "Ctrl+Shift"
desc = "modifier only"
`;
    const result = parseImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // shortcut with bad combo is still included with empty combo
  });

  it('rejects unknown keys in TOML', () => {
    const toml = `[[groups]]
name = "Test"
color = "red"
`;
    const result = parseImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('skips comment lines', () => {
    const toml = `# 这是一个注释
[[groups]]
name = "G"

[[groups.shortcuts]]
combo = "A"
desc = "only A"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].shortcuts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /d D:\DevProjects\my\github\ve
pnpm exec vitest run packages/react-components/__tests__/import-parser.test.ts --config vitest.workspace.ts
```
Expected: FAIL — `Cannot find module '../src/shortcut-library/import-parser'` or similar.

- [ ] **Step 3: Write minimal implementation**

`packages/react-components/src/shortcut-library/import-parser.ts`:

```typescript
// import-parser.ts —— Zero-dependency TOML subset parser for ShortcutLibrary import.
// Supports only the subset defined in the import spec:
//   - [[groups]] array-of-tables headers
//   - [[groups.shortcuts]] nested array-of-tables
//   - name = "..."
//   - combo = "..."
//   - desc = "..."
//   - # comments

import { labelFor, isModifier } from './keymap';
import type { KeyStroke } from './types';

export interface ImportParseResult {
  groups: Array<{
    name: string;
    shortcuts: Array<{
      combo: KeyStroke[];
      description: string;
    }>;
  }>;
  errors: string[];
}

// Reverse lookup: display label → KeyboardEvent.code
// Only covers labels that a user might type in an import file
const LABEL_REVERSE: Record<string, string> = {
  'Ctrl': 'ControlLeft',
  'Shift': 'ShiftLeft',
  'Alt': 'AltLeft',
  '⌘': 'MetaLeft',
  'Enter': 'Enter',
  'Esc': 'Escape',
  'Tab': 'Tab',
  'Space': 'Space',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '←': 'ArrowLeft',
  '→': 'ArrowRight',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
};

// Characters that map to their Symbol-key code directly
// (the char itself IS the label, e.g. "-" → "Minus")
const CHAR_TO_CODE: Record<string, string> = {
  '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
  '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote',
  ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote',
};

/** Resolve a display-label combo like "Ctrl+R" to KeyStroke[].
 *  Returns the array on success, or an error string on failure. */
export function resolveCombo(input: string): KeyStroke[] | string {
  const trimmed = input.trim();
  if (!trimmed) return '组合键不能为空';

  const parts = trimmed.split('+').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '组合键格式无效';

  const strokes: KeyStroke[] = [];
  let hasNonModifier = false;

  for (const part of parts) {
    if (part.length === 1 && CHAR_TO_CODE[part]) {
      const code = CHAR_TO_CODE[part];
      strokes.push({ code, label: part, isModifier: false });
      hasNonModifier = true;
    } else if (LABEL_REVERSE[part]) {
      const code = LABEL_REVERSE[part];
      const label = labelFor(code, part);
      strokes.push({ code, label, isModifier: true });
    } else if (isModifier(part) || part === 'Ctrl' || part === 'Shift' || part === 'Alt') {
      // Direct modifier name without labelFor — Ctrl, Shift, Alt
      const code = part === 'Ctrl' ? 'ControlLeft' : part === 'Shift' ? 'ShiftLeft' : 'AltLeft';
      strokes.push({ code, label: part, isModifier: true });
    } else if (part.startsWith('F') && /^F\d{1,2}$/.test(part)) {
      strokes.push({ code: part, label: part, isModifier: false });
      hasNonModifier = true;
    } else if (part === '⌘') {
      strokes.push({ code: 'MetaLeft', label: '⌘', isModifier: true });
    } else if (part.length === 1 && /[A-Za-z0-9]/.test(part)) {
      const upper = part.toUpperCase();
      const code = /[A-Z]/.test(upper) ? `Key${upper}` : `Digit${part}`;
      strokes.push({ code, label: upper, isModifier: false });
      hasNonModifier = true;
    } else {
      // Try labelFor reverse — check if it's a known label from LABEL_MAP
      // by iterating: this is O(n) but n ≤ 30 entries.
      const entry = Object.entries(LABEL_REVERSE).find(([k]) => k === part);
      if (entry) {
        strokes.push({ code: entry[1], label: part, isModifier: isModifier(entry[1]) });
        if (!isModifier(entry[1])) hasNonModifier = true;
      } else {
        return `无法识别的按键: "${part}"`;
      }
    }
  }

  if (!hasNonModifier) return `组合键缺少主键: "${trimmed}" (修饰键不能单独作为快捷键)`;

  return strokes;
}

/** Parse TOML import text into structured data. */
export function parseImportToml(toml: string): ImportParseResult {
  const groups: ImportParseResult['groups'] = [];
  const errors: string[] = [];
  const lines = toml.split('\n');

  let currentGroup: { name: string; shortcuts: Array<{ combo: string; desc: string }> } | null = null;
  let inShortcuts = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) continue;

    // Array-of-tables header: [[groups]]
    if (line === '[[groups]]') {
      if (currentGroup) {
        // Finalize previous group
        finalizeGroup();
      }
      currentGroup = { name: '', shortcuts: [] };
      inShortcuts = false;
      continue;
    }

    // Array-of-tables header: [[groups.shortcuts]]
    if (line === '[[groups.shortcuts]]') {
      inShortcuts = true;
      continue;
    }

    // Key-value pairs
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      errors.push(`第 ${i + 1} 行: 无法解析 "${raw}"`);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const valRaw = line.slice(eqIdx + 1).trim();
    const val = valRaw.startsWith('"') && valRaw.endsWith('"')
      ? valRaw.slice(1, -1).replace(/\\"/g, '"')
      : valRaw;

    if (inShortcuts && currentGroup) {
      if (key === 'combo') currentGroup.shortcuts.push({ combo: val, desc: '' });
      else if (key === 'desc' && currentGroup.shortcuts.length > 0)
        currentGroup.shortcuts[currentGroup.shortcuts.length - 1].desc = val;
      else
        errors.push(`第 ${i + 1} 行: 未知字段 "${key}"`);
    } else if (!inShortcuts && currentGroup) {
      if (key === 'name') currentGroup.name = val;
      else
        errors.push(`第 ${i + 1} 行: 未知字段 "${key}"`);
    } else {
      errors.push(`第 ${i + 1} 行: 不在任何表头下的字段 "${key}"`);
    }
  }

  // Finalize last group
  if (currentGroup) finalizeGroup();

  function finalizeGroup() {
    if (!currentGroup) return;
    if (!currentGroup.name) {
      errors.push('分组缺少 name 字段,已跳过');
      currentGroup = null;
      return;
    }
    const resolvedShortcuts: ImportParseResult['groups'][0]['shortcuts'] = [];
    for (const sc of currentGroup.shortcuts) {
      const combo = resolveCombo(sc.combo);
      if (typeof combo === 'string') {
        errors.push(`分组 "${currentGroup.name}" · ${sc.combo}: ${combo}`);
        continue;
      }
      resolvedShortcuts.push({ combo, description: sc.desc });
    }
    groups.push({ name: currentGroup.name, shortcuts: resolvedShortcuts });
    currentGroup = null;
    inShortcuts = false;
  }

  return { groups, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run packages/react-components/__tests__/import-parser.test.ts --config vitest.workspace.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/shortcut-library/import-parser.ts packages/react-components/__tests__/import-parser.test.ts
git commit -m "feat(shortcut-library): add TOML import parser with combo resolution"
```

---
### Task 2: Hover highlight — ShortcutTable + Keyboard wiring

**Files:**
- Modify: `packages/react-components/src/shortcut-library/ShortcutTable.tsx`
- Modify: `packages/react-components/src/shortcut-library/Keyboard.tsx`
- Modify: `packages/react-components/src/shortcut-library/index.tsx`
- Modify: `packages/react-components/src/shortcut-library/index.css`

**Interfaces:**
- Consumes: `ShortcutTable.onHover?: (codes: Set<string> | null) => void` — from Task 2 (this task)
- Consumes: `Keyboard.hoveredCodes: Set<string>` — from Task 2 (this task)
- Consumes: `index.tsx` manages `hoveredCodes` state and passes it to children

- [ ] **Step 1: Add `onHover` prop to ShortcutTable and wire mouse events**

In `ShortcutTable.tsx`:

Add `onHover?: (codes: Set<string> | null) => void` to the `Props` interface.

On each `<tr>` (the `filtered.map` loop, around line 98), add `onMouseEnter` and `onMouseLeave`:

```tsx
// Before the td cells, add to the <tr> element:
onMouseEnter={() => onHover?.(new Set(s.combo.map(k => k.code)))}
onMouseLeave={() => onHover?.(null)}
```

Also update the `editing-row <tr>` (the `isEditing` branch) — no hover needed on an editing row (the CapturePopover takes focus). Leave that `onMouseEnter/Leave` unset.

- [ ] **Step 2: Run build to verify TS compiles**

```bash
cd /d D:\DevProjects\my\github\ve
npx tsc --noEmit -p packages/react-components/tsconfig.json 2>&1
```
Expected: no errors.

- [ ] **Step 3: Add `hoveredCodes` state to index.tsx**

In `index.tsx`:

```typescript
// Add new state alongside highlightedCodes, around line 13:
const [hoveredCodes, setHoveredCodes] = useState<Set<string>>(new Set());
```

Pass it to `ShortcutTable`:
```tsx
<ShortcutTable
  ...
  onCapture={setHighlightedCodes}
+ onHover={setHoveredCodes}
/>
```

Pass it to `Keyboard`:
```tsx
<Keyboard
  highlightedCodes={highlightedCodes}
+ hoveredCodes={hoveredCodes}
/>
```

Update the hint text below the keyboard title to reflect hovering state:
```tsx
<span className="sl-sl-preview__hint">
  {hoveredCodes.size > 0
    ? '悬浮在表格行上'
    : highlightedCodes.size > 0
      ? '高亮的是最近一次录入的按键'
      : '录入或选择快捷键以高亮'}
</span>
```

- [ ] **Step 4: Run build to verify TS compiles**

```bash
npx tsc --noEmit -p packages/react-components/tsconfig.json 2>&1
```
Expected: no errors.

- [ ] **Step 5: Add `hoveredCodes` prop and `.is-hover` rendering to Keyboard.tsx**

In `Keyboard.tsx`:

```typescript
interface Props {
  highlightedCodes: Set<string>;
+ hoveredCodes: Set<string>;
}

export default function Keyboard({ highlightedCodes, hoveredCodes }: Props) {
```

In the JSX for each key (the row.map callback, around line 87):

```tsx
const isOn = highlightedCodes.has(key.code);
const isHover = hoveredCodes.has(key.code);
```

Add the second CSS class:
```tsx
className={`sl-sl-kb__key ${isOn ? 'is-on' : ''} ${isHover ? 'is-hover' : ''}`}
```

- [ ] **Step 6: Run build to verify TS compiles**

```bash
npx tsc --noEmit -p packages/react-components/tsconfig.json 2>&1
```
Expected: no errors.

- [ ] **Step 7: Add CSS for `.is-hover` state**

In `index.css`, add after the existing `.sl-sl-kb__key.is-on` block (~line 384):

```css
.sl-sl-kb__key.is-hover {
  background: #fef3c7;   /* amber-100 */
  border-color: #f59e0b; /* amber-500 */
  color: #92400e;        /* amber-800 */
  transform: translateY(1px);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/react-components/src/shortcut-library/ShortcutTable.tsx packages/react-components/src/shortcut-library/Keyboard.tsx packages/react-components/src/shortcut-library/index.tsx packages/react-components/src/shortcut-library/index.css
git commit -m "feat(shortcut-library): hover table row highlights corresponding keyboard keys"
```

---
### Task 3: TOML import — useShortcuts merge method

**Files:**
- Modify: `packages/react-components/src/shortcut-library/useShortcuts.ts`

**Interfaces:**
- Input: `ImportParseResult` from Task 1
- Produces: `importGroups(data: ImportParseResult): ImportStats` — merges parsed groups into store

```typescript
interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}
```

- [ ] **Step 1: Add `importGroups` to `useShortcuts.ts`**

```typescript
// Add to the imports at top:
import type { ImportParseResult } from './import-parser';

// Add to the return type:
interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

// Add after deleteShortcut (~line 123):
const importGroups = useCallback((data: ImportParseResult): ImportStats => {
  const stats: ImportStats = { groupsAdded: 0, groupsAppended: 0, shortcutsAdded: 0, errors: [...data.errors] };

  setGroups((prev) => {
    const next = [...prev];
    for (const g of data.groups) {
      // Look up existing group by name (case-insensitive)
      const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
      if (existing) {
        // Append shortcuts to existing group
        const newShortcuts = g.shortcuts.map((s) => ({
          id: freshId(),
          combo: s.combo,
          description: s.description,
          createdAt: Date.now(),
        }));
        existing.shortcuts = [...existing.shortcuts, ...newShortcuts];
        existing.updatedAt = Date.now();
        stats.groupsAppended++;
        stats.shortcutsAdded += newShortcuts.length;
      } else {
        // Create new group
        const now = Date.now();
        const newGroup: Group = {
          id: freshId(),
          name: g.name,
          shortcuts: g.shortcuts.map((s) => ({
            id: freshId(),
            combo: s.combo,
            description: s.description,
            createdAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        };
        next.push(newGroup);
        stats.groupsAdded++;
        stats.shortcutsAdded += newGroup.shortcuts.length;
      }
    }
    return next;
  });

  return stats;
}, []);

// Export ImportStats type
export type { ImportStats };
```

**Important note about closure and setGroups**: `setGroups` receives a callback, so it always gets the latest state. The `data.groups` loop happens synchronously inside the callback, so it's safe — no stale closure on `prev`.

- [ ] **Step 2: Run build to verify TS compiles**

```bash
npx tsc --noEmit -p packages/react-components/tsconfig.json 2>&1
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react-components/src/shortcut-library/useShortcuts.ts
git commit -m "feat(shortcut-library): add importGroups merge method to store"
```

---
### Task 4: ImportModal component

**Files:**
- Create: `packages/react-components/src/shortcut-library/ImportModal.tsx`
- Modify: `packages/react-components/src/shortcut-library/index.tsx`
- Modify: `packages/react-components/src/shortcut-library/index.css`

- [ ] **Step 1: Create ImportModal.tsx**

```tsx
// ImportModal.tsx —— 粘贴/上传 TOML 的导入弹窗,内嵌格式说明

import { useRef, useState } from 'react';
import { parseImportToml, type ImportParseResult } from './import-parser';

interface Props {
  onImport: (data: ImportParseResult) => { groupsAdded: number; groupsAppended: number; shortcutsAdded: number; errors: string[] };
  onClose: () => void;
}

type TabMode = 'paste' | 'file';

export default function ImportModal({ onImport, onClose }: Props) {
  const [mode, setMode] = useState<TabMode>('paste');
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [parsed, setParsed] = useState(false);
  const [resultSummary, setResultSummary] = useState<ReturnType<typeof onImport> | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParse() {
    if (!text.trim()) {
      setParseResult(null);
      setParsed(true);
      return;
    }
    const result = parseImportToml(text);
    setParseResult(result);
    setParsed(true);
  }

  function handleConfirm() {
    if (!parseResult) return;
    const stats = onImport(parseResult);
    setResultSummary(stats);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      alert('文件过大,请控制在 1MB 以内');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setText(content);
      // Auto-parse on file load
      const result = parseImportToml(content);
      setParseResult(result);
      setParsed(true);
    };
    reader.onerror = () => alert('无法读取文件');
    reader.readAsText(file);
  }

  // Re-parse when text changes in paste mode
  function handleTextChange(val: string) {
    setText(val);
    setResultSummary(null);
    if (!val.trim()) {
      setParseResult(null);
      setParsed(false);
      return;
    }
    const result = parseImportToml(val);
    setParseResult(result);
    setParsed(true);
  }

  const totalGroups = parseResult?.groups.length ?? 0;
  const totalShortcuts = parseResult?.groups.reduce((n, g) => n + g.shortcuts.length, 0) ?? 0;
  const hasErrors = parseResult && parseResult.errors.length > 0;
  const isValid = parseResult && totalGroups > 0 && totalShortcuts > 0;

  return (
    <div className="sl-sl-overlay" onClick={onClose}>
      <div className="sl-sl-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sl-sl-modal__head">
          <h2 className="sl-sl-modal__title">导入快捷键</h2>
          <button className="sl-sl-icon-btn" onClick={onClose}>×</button>
        </header>

        {/* Tab switch */}
        <div className="sl-sl-modal__tabs">
          <button
            className={`sl-sl-modal__tab ${mode === 'paste' ? 'is-active' : ''}`}
            onClick={() => { setMode('paste'); setResultSummary(null); }}
          >
            粘贴文本
          </button>
          <button
            className={`sl-sl-modal__tab ${mode === 'file' ? 'is-active' : ''}`}
            onClick={() => { setMode('file'); setResultSummary(null); }}
          >
            选择文件
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            className="sl-sl-modal__textarea"
            rows={10}
            placeholder={`粘贴 TOML 内容...\n\n示例:\n[[groups]]\nname = "VSCode"\n\n[[groups.shortcuts]]\ncombo = "Ctrl+R"\ndesc = "打开目录"`}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="sl-sl-modal__file-zone">
            <input
              ref={fileRef}
              type="file"
              accept=".toml"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <button
              className="sl-sl-btn sl-sl-btn--primary"
              onClick={() => fileRef.current?.click()}
            >
              选择 .toml 文件
            </button>
            {text && (
              <p className="sl-sl-modal__file-name">
                已加载 {text.length} 字节
              </p>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="sl-sl-modal__preview">
          {parsed && !text.trim() && (
            <span className="sl-sl-modal__preview-text">未输入内容</span>
          )}
          {parsed && text.trim() && parseResult && (
            <span className="sl-sl-modal__preview-text">
              解析结果: {totalGroups} 个分组, {totalShortcuts} 条快捷键
              {hasErrors && (
                <span className="sl-sl-modal__preview-warn">
                  , {parseResult.errors.length} 个警告
                </span>
              )}
            </span>
          )}
        </div>

        {/* Error detail */}
        {hasErrors && (
          <div className="sl-sl-modal__errors">
            {parseResult!.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="sl-sl-modal__error-item">{err}</div>
            ))}
            {parseResult!.errors.length > 10 && (
              <div className="sl-sl-modal__error-item">… 还有 {parseResult!.errors.length - 10} 条</div>
            )}
          </div>
        )}

        {/* Format reference (collapsible) */}
        <div className="sl-sl-modal__format">
          <button
            className="sl-sl-modal__format-toggle"
            onClick={() => setShowFormat(!showFormat)}
          >
            📄 {showFormat ? '收起格式说明' : '查看格式说明'}
          </button>
          {showFormat && (
            <div className="sl-sl-modal__format-body">
              <pre>{`# ShortcutLibrary 导入格式 (TOML)
# UTF-8 编码

[[groups]]
name = "分组名称"

[[groups.shortcuts]]
combo = "Ctrl+R"     # 组合键,用 + 连接
desc  = "打开目录"    # 说明(可选)

# 支持多个分组和快捷键
[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"

# 支持的修饰键: Ctrl, Shift, Alt, ⌘
# 支持的方向键: ↑, ↓, ←, →
# 支持的字母/数字: A-Z, 0-9
# 支持的功能键: F1-F12
# 文件大小限制: 1 MB`}</pre>
            </div>
          )}
        </div>

        {/* Result summary after import */}
        {resultSummary && (
          <div className="sl-sl-modal__result">
            ✅ 导入完成: 新增 {resultSummary.groupsAdded} 个分组,
            追加 {resultSummary.groupsAppended} 个现有分组,
            合计 {resultSummary.shortcutsAdded} 条快捷键
            {resultSummary.errors.length > 0 && (
              <div className="sl-sl-modal__result-warn">
                {resultSummary.errors.length} 个警告已忽略
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="sl-sl-modal__actions">
          {!resultSummary ? (
            <>
              <button className="sl-sl-btn sl-sl-btn--ghost" onClick={onClose}>取消</button>
              <button
                className="sl-sl-btn sl-sl-btn--primary"
                disabled={!isValid}
                onClick={handleConfirm}
              >
                确认导入
              </button>
            </>
          ) : (
            <button className="sl-sl-btn sl-sl-btn--primary" onClick={onClose}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire ImportModal into index.tsx**

In `index.tsx`:

```typescript
// Add imports:
import ImportModal from './ImportModal';
import type { ImportParseResult } from './import-parser';
import type { ImportStats } from './useShortcuts';

// Add state:
const [showImport, setShowImport] = useState(false);

// Add handler:
function handleImport(data: ImportParseResult): ImportStats {
  return store.importGroups(data);
}

// In the topbar section, after the search input (~line 44):
<button
  className="sl-sl-btn sl-sl-btn--ghost"
  onClick={() => setShowImport(true)}
>
  导入
</button>

// Before closing </main>:
{showImport && (
  <ImportModal
    onImport={handleImport}
    onClose={() => setShowImport(false)}
  />
)}
```

- [ ] **Step 3: Add modal CSS**

Append to `index.css`:

```css
/* ===== Import Modal ===== */
.sl-sl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.sl-sl-modal {
  background: var(--sl-color-surface, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.25);
  width: min(640px, 90vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sl-sl-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}
.sl-sl-modal__title { font-size: 16px; font-weight: 600; margin: 0; }
.sl-sl-modal__tabs {
  display: flex;
  gap: 0;
  margin: 16px 24px 0;
  border-bottom: 1px solid var(--sl-color-border, #e4e4e7);
}
.sl-sl-modal__tab {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--sl-color-text-mute, #9ca3af);
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.sl-sl-modal__tab.is-active {
  color: var(--sl-color-primary, #2563eb);
  border-bottom-color: var(--sl-color-primary, #2563eb);
}
.sl-sl-modal__textarea {
  margin: 16px 24px 0;
  padding: 12px;
  border: 1px solid var(--sl-color-border, #e4e4e7);
  border-radius: 8px;
  font-family: var(--sl-font-mono, ui-monospace, "JetBrains Mono", monospace);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  min-height: 180px;
  outline: none;
}
.sl-sl-modal__textarea:focus {
  border-color: var(--sl-color-primary, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.sl-sl-modal__file-zone {
  margin: 24px;
  padding: 32px;
  border: 2px dashed var(--sl-color-border, #e4e4e7);
  border-radius: 8px;
  text-align: center;
}
.sl-sl-modal__file-name { font-size: 12px; color: var(--sl-color-text-mute, #9ca3af); margin-top: 12px; }
.sl-sl-modal__preview {
  padding: 8px 24px;
  font-size: 13px;
}
.sl-sl-modal__preview-text { color: var(--sl-color-text, #1f2328); }
.sl-sl-modal__preview-warn { color: #d97706; margin-left: 4px; }
.sl-sl-modal__errors {
  margin: 0 24px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  max-height: 120px;
  overflow-y: auto;
}
.sl-sl-modal__error-item {
  font-size: 12px;
  color: #b91c1c;
  line-height: 1.6;
}
.sl-sl-modal__format {
  margin: 8px 24px 0;
}
.sl-sl-modal__format-toggle {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--sl-color-primary, #2563eb);
  cursor: pointer;
  padding: 4px 0;
}
.sl-sl-modal__format-body {
  margin-top: 8px;
  padding: 12px;
  background: var(--sl-color-surface-alt, #f4f4f5);
  border-radius: 6px;
  overflow-x: auto;
}
.sl-sl-modal__format-body pre {
  margin: 0;
  font-family: var(--sl-font-mono, ui-monospace, "JetBrains Mono", monospace);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre;
  color: var(--sl-color-text, #1f2328);
}
.sl-sl-modal__result {
  margin: 12px 24px 0;
  padding: 12px;
  background: #ecfdf5;
  border-radius: 6px;
  font-size: 13px;
  color: #065f46;
}
.sl-sl-modal__result-warn {
  font-size: 12px;
  color: #92400e;
  margin-top: 4px;
}
.sl-sl-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--sl-color-border, #e4e4e7);
  margin-top: 16px;
}
```

- [ ] **Step 4: Run build to verify TS compiles**

```bash
npx tsc --noEmit -p packages/react-components/tsconfig.json 2>&1
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/react-components/src/shortcut-library/ImportModal.tsx packages/react-components/src/shortcut-library/index.tsx packages/react-components/src/shortcut-library/index.css
git commit -m "feat(shortcut-library): add TOML import modal with paste/file/format-panel"
```

---
### Task 5: IMPORT_FORMAT.md documentation

**Files:**
- Create: `packages/react-components/src/shortcut-library/IMPORT_FORMAT.md`

**Interfaces:**
- This is a standalone reference doc. No code changes.

- [ ] **Step 1: Write IMPORT_FORMAT.md**

```markdown
# ShortcutLibrary 导入格式

支持通过 **TOML 文件**或**粘贴 TOML 文本**批量导入快捷键分组。

## 文件格式

TOML (Tom's Obvious, Minimal Language), UTF-8 编码。

```toml
[[groups]]
name = "分组名称"

[[groups.shortcuts]]
combo = "Ctrl+R"     # 组合键,用 + 连接
desc  = "打开目录"    # 说明(可选)
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `[[groups]]` | 表数组 | 是 | 每个分组一个 `[[groups]]` |
| `name` | 字符串 | 是 | 分组名称,如 "VSCode"、"Chrome" |
| `[[groups.shortcuts]]` | 嵌套表数组 | 否 | 分组下的快捷键条目 |
| `combo` | 字符串 | 是 | 组合键(见下方),如 "Ctrl+R" |
| `desc` | 字符串 | 否 | 快捷键功能说明 |

## 组合键写法

- 用 `+` 连接修饰键和主键,如 `Ctrl+Shift+P`
- 同一修饰键不分左右(均映射为 Left 侧)

### 支持的修饰键

| 写法 | 说明 |
|---|---|
| `Ctrl` | Control 键 |
| `Shift` | Shift 键 |
| `Alt` | Alt 键 |
| `⌘` | Meta/Command 键 |

### 支持的主键

| 类型 | 示例 |
|---|---|
| 字母 | `A` `B` … `Z`(大小写不敏感) |
| 数字 | `0` `1` … `9` |
| 功能键 | `F1` … `F12` |
| 方向键 | `↑` `↓` `←` `→` |
| 符号 | `-` `=` `[` `]` `\` `;` `'` `,` `.` `/` `` ` `` |
| 特殊键 | `Enter` `Esc` `Tab` `Space` `Backspace` `Delete` |

## 完整示例

```toml
# 我的快捷键库
[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"

[[groups.shortcuts]]
combo = "Ctrl+Shift+P"
desc = "命令面板"

[[groups.shortcuts]]
combo = "Ctrl+P"
desc = "文件搜索"

[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"

[[groups.shortcuts]]
combo = "Ctrl+Shift+T"
desc = "恢复关闭标签页"

[[groups.shortcuts]]
combo = "Ctrl+D"
desc = "收藏当前页"
```

## 导入行为

- **增量合并**:同名分组会将快捷键追加到该分组下;不存在的分组自动新建
- 每条快捷键自动分配唯一 ID,不会覆盖已有数据
- 文件大小限制: 1 MB

## 常见错误

| 错误 | 原因 |
|---|---|
| "组合键缺少主键" | combo 只写了修饰键,如 `Ctrl+Shift` |
| "无法识别的按键" | combo 中包含不支持的按键名 |
| "分组缺少 name 字段" | `[group]` 块内缺少 `name = "..."` |
```

- [ ] **Step 2: Commit**

```bash
git add packages/react-components/src/shortcut-library/IMPORT_FORMAT.md
git commit -m "docs(shortcut-library): add IMPORT_FORMAT.md reference doc"
```

---
### Task 6: Full integration build & verify

- [ ] **Step 1: Run all tests**

```bash
pnpm exec vitest run --config vitest.workspace.ts
```
Expected: all test suites pass (especially `import-parser.test.ts`).

- [ ] **Step 2: Run production build**

```bash
cd /d D:\DevProjects\my\github\ve && pnpm build
```
Expected: `apps/showcase/dist/` generated. Check that `rc-shortcut-library.js` chunk is emitted.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat(shortcut-library): keyboard hover highlight + TOML import (#2)"
```
