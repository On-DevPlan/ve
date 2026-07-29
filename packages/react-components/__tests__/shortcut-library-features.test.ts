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

  it('Keyboard wires pointer events with a 250ms long-press timer', () => {
    expect(keyboard).toMatch(/LONG_PRESS_MS\s*=\s*250/);
    expect(keyboard).toMatch(/onPointerDown=/);
    expect(keyboard).toMatch(/onPointerUp=/);
    expect(keyboard).toMatch(/onPointerLeave=/);
    expect(keyboard).toMatch(/onPointerCancel=/);
    expect(keyboard).toMatch(/window\.setTimeout\([\s\S]*?LONG_PRESS_MS/);
  });

  it('adds a stable is-pressed visual state during pointer hold', () => {
    // Without an is-pressed state, the key transitions from the base
    // 浅灰 background to the 蓝色 is-on color over 0.24s — which reads
    // as "先闪一下再长亮". The fix is a dedicated class with
    // transition: none so the visual change is truly instant.
    expect(keyboard).toMatch(/is-pressed/);
    expect(keyboard).toMatch(/setPressed\(true\)/);
    expect(keyboard).toMatch(/setPressed\(false\)/);
    expect(css).toMatch(/\.sl-sl-kb__key\.is-pressed/);
    // The is-pressed rule must declare transition: none to short-circuit
    // the base element's 0.24s color transition on press.
    const pressedRule = css.match(
      /\.sl-sl-kb__key\.is-pressed\s*\{([^}]+)\}/,
    );
    expect(pressedRule, 'is-pressed rule missing').not.toBeNull();
    expect(pressedRule![1]).toMatch(/transition:\s*none/);
  });

  it('index.tsx throttles flash at 50ms per code', () => {
    // Without throttle, OS auto-repeat hammers setTimeout every frame and
    // visually strobes the key — drives users up the wall.
    expect(indexTsx).toMatch(/FLASH_THROTTLE_MS\s*=\s*50/);
    expect(indexTsx).toMatch(/flashLastAt/);
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