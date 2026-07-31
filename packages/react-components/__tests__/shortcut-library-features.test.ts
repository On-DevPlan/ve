import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-level regression tests for the four product features added on top
 * of the scroll/collapse fix. Each describe block pins the wiring that the
 * DOM tests don't fully cover (e.g. parser handling of the new `condition`
 * field, helper exports, long-press timing constants).
 *
 * The DOM tests in shortcut-library-dom.test.tsx already verify that the
 * computed styles match the CSS rules below.
 */

const css = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.css'),
  'utf8',
);
const indexTsx = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.tsx'),
  'utf8',
);
const importModal = readFileSync(
  resolve(__dirname, '../src/shortcut-library/ImportModal.tsx'),
  'utf8',
);
const parser = readFileSync(
  resolve(__dirname, '../src/shortcut-library/import-parser.ts'),
  'utf8',
);
const types = readFileSync(
  resolve(__dirname, '../src/shortcut-library/types.ts'),
  'utf8',
);
const useShortcuts = readFileSync(
  resolve(__dirname, '../src/shortcut-library/useShortcuts.ts'),
  'utf8',
);
const keyboard = readFileSync(
  resolve(__dirname, '../src/shortcut-library/Keyboard.tsx'),
  'utf8',
);
const table = readFileSync(
  resolve(__dirname, '../src/shortcut-library/ShortcutTable.tsx'),
  'utf8',
);

interface CssRule {
  selector: string;
  decls: Record<string, string>;
}

function parseCss(source: string): CssRule[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: CssRule[] = [];
  let i = 0;
  while (i < stripped.length) {
    const braceOpen = stripped.indexOf('{', i);
    if (braceOpen < 0) break;
    const selector = stripped.slice(i, braceOpen).trim();
    let depth = 1;
    let j = braceOpen + 1;
    while (j < stripped.length && depth > 0) {
      const ch = stripped[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      j++;
    }
    const body = stripped.slice(braceOpen + 1, j - 1);
    const decls: Record<string, string> = {};
    for (const raw of body.split(';')) {
      const line = raw.trim();
      if (!line) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const prop = line.slice(0, colon).trim().toLowerCase();
      const val = line.slice(colon + 1).trim();
      decls[prop] = val;
    }
    out.push({ selector, decls });
    i = j;
  }
  return out;
}

const rules = parseCss(css);
const decl = (selector: string, prop: string): string | null => {
  for (const r of rules) {
    const sels = r.selector.split(',').map((s) => s.trim());
    if (!sels.includes(selector)) continue;
    const v = r.decls[prop.toLowerCase()];
    if (v !== undefined) return v;
  }
  return null;
};

describe('feature 1 — copy-format prompt', () => {
  it('mentions the role + output constraints LLM needs', () => {
    // The prompt must be self-contained: role, fields, modifiers, examples,
    // and explicit "don't" rules. Without these, the LLM drifts into
    // generic TOML tutorials and the user has to manually fix output.
    expect(importModal).toMatch(/FORMAT_PROMPT\s*=/);
    const promptMatch = importModal.match(/FORMAT_PROMPT\s*=\s*`([\s\S]*?)`;/);
    expect(promptMatch, 'FORMAT_PROMPT template literal missing').not.toBeNull();
    const prompt = promptMatch![1];
    for (const fragment of [
      'condition',
      '组合键',
      'combo',
      'desc',
      '字段表',
      '修饰键',
      '主键',
      '不要',
    ]) {
      expect(prompt).toContain(fragment);
    }
  });

  it('updated doc + parser agree on the condition field', () => {
    // If the doc promises condition but parser rejects it, user gets
    // mysterious "未知字段" errors on import. Keep them in sync.
    const docPath = resolve(__dirname, '../src/shortcut-library/IMPORT_FORMAT.md');
    const doc = readFileSync(docPath, 'utf8');
    expect(doc).toMatch(/condition/);
    expect(parser).toMatch(/key === 'condition'/);
  });
});

describe('feature 2 — condition field', () => {
  it('adds condition to the Shortcut type', () => {
    expect(types).toMatch(/condition\?:\s*string/);
  });

  it('passes condition through addShortcut / updateShortcut / importGroups', () => {
    // The addShortcut signature spans the next line in source, so match a
    // distinctive token pair instead of the full sig.
    expect(useShortcuts).toMatch(/addShortcut\s*=\s*useCallback/);
    expect(useShortcuts).toMatch(/condition\?\s*:\s*string/);
    expect(useShortcuts).toMatch(/updateShortcut[\s\S]*condition/);
    // importGroups spreads condition from incoming shortcuts
    expect(useShortcuts).toMatch(/condition:\s*s\.condition/);
  });

  it('parses `condition = "..."` after a shortcut block', () => {
    expect(parser).toMatch(/pendingCondition\s*=\s*null/);
    expect(parser).toMatch(/key === 'condition'/);
    // Normalizes empty string back to undefined so the table doesn't render
    // an empty "条件: " cell.
    expect(parser).toMatch(/condition:\s*sc\.condition\s*\?\s*sc\.condition\s*:\s*undefined/);
  });

  it('renders a 条件 column with explicit width', () => {
    expect(decl('.sl-sl-table__col-cond', 'width')).toBe('22%');
    expect(table).toMatch(/条件/);
  });

  it('lets CapturePopover edit condition alongside combo', () => {
    expect(table).toMatch(/initialCondition=\{s\.condition \?\? ''\}/);
  });
});

describe('feature 3 — long-press mapping popup + flash throttle', () => {
  it('exports findBindingsByCode helper', () => {
    expect(useShortcuts).toMatch(/export function findBindingsByCode/);
    expect(useShortcuts).toMatch(/BindingHit/);
  });

  it('Keyboard wires pointer events with unified onPress/onRelease (heldKeys-driven)', () => {
    // 之前是 timer-based:pointerdown 后 setTimeout 250ms 触发 onLongPress。
    // 然后改成 release-based:pointerdown 记下时间戳,pointerup 时计算按住
    // 时长。最新版:不再有 LONG_PRESS_MS / setTimeout,完全由父组件的
    // onPress / onRelease 回调 + heldKeys state 决定视觉态 + 弹 popup。
    // 鼠标 / 物理键路径完全统一。
    expect(keyboard).toMatch(/onPointerDown=/);
    expect(keyboard).toMatch(/onPointerUp=/);
    expect(keyboard).toMatch(/onPointerLeave=/);
    expect(keyboard).toMatch(/onPointerOut=/);
    expect(keyboard).toMatch(/onPointerCancel=/);
    expect(keyboard).toMatch(/onPress\?/);
    expect(keyboard).toMatch(/onRelease\?/);
  });

  it('pointerDown now ADDS is-on (hold-to-popup is the new visual feedback)', () => {
    // 之前的设计是「pointerdown 不变 className,长按只弹 popup」,用户反馈
    // 看不到反馈。这一版改为「按下立刻变蓝、持续 hold 弹 popup」,鼠标
    // 和物理键统一。所以 className 会变。
    expect(keyboard).toMatch(/is-on/);
  });

  it('index.tsx tracks keyboard hold for KEY_HOLD_MS then fires onLongPress', () => {
    // 物理键按下时键变蓝,持续 KEY_HOLD_MS(800ms)后弹 mapping popup。
    // 鼠标走同样的 onPress / onRelease 路径,达到同样的 800ms 阈值。
    expect(indexTsx).toMatch(/KEY_HOLD_MS\s*=\s*800/);
    expect(indexTsx).toMatch(/heldKeys/);
    expect(indexTsx).toMatch(/setHeldKeys/);
    expect(indexTsx).toMatch(/holdPress/);
    expect(indexTsx).toMatch(/holdRelease/);
  });

  it('renders the long-press popup via portal to the host target', () => {
    // Without portal the popup would be clipped by .sl-sl-preview's
    // overflow-x:auto (and any other scroll container in the tree).
    expect(indexTsx).toMatch(/createPortal/);
    expect(indexTsx).toMatch(/sl-sl-longpress/);
    expect(indexTsx).toMatch(/LONG_PRESS_MAX/);
  });

  it('popup positioning avoids viewport edges', () => {
    expect(indexTsx).toMatch(/VIEWPORT_PAD/);
    expect(indexTsx).toMatch(/longPressPopupPos/);
  });
});

describe('feature 4 — row-hover description tooltip', () => {
  it('renders the tooltip via portal (avoiding viewport clipping)', () => {
    expect(indexTsx).toMatch(/sl-sl-rowtip/);
    expect(indexTsx).toMatch(/rowtipPos/);
  });

  it('shows combo + description + condition when present', () => {
    // The tooltip is informational; combo + description must always render,
    // condition is conditional. This guarantees the tooltip is useful even
    // for shortcuts without a condition.
    expect(indexTsx).toMatch(/rowtip__combo/);
    expect(indexTsx).toMatch(/rowtip__desc/);
    expect(indexTsx).toMatch(/rowtip__cond/);
  });

  it('ShortcutTable fires onShortcutHover with shortcut + rect', () => {
    expect(table).toMatch(/onShortcutHover\?:\s*\(shortcut:\s*Shortcut/);
    // Sanity-check that the wiring reaches the props, not the literal pattern.
    expect(table).toMatch(/onShortcutHover\(s,\s*\(e\.currentTarget/);
    expect(table).toMatch(/onShortcutHover\?/);
    expect(table).toMatch(/\(null,\s*null\)/);
  });
});