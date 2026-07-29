import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression tests for the "shortcut-library cannot scroll + has no collapse
 * toggle" fix.
 *
 * Root cause: DetailPage is `position:fixed; height:100vh; overflow:hidden`,
 * while `.sl-sl-root` used `min-height:100vh` with no internal scroll
 * container. Long tables overflowed past the viewport and got clipped, and
 * the keyboard preview had no way to collapse out of the way.
 *
 * These tests pin the CSS rules and the TSX wiring so the fix can't quietly
 * regress.
 */

const css = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.css'),
  'utf8',
);
const tsx = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.tsx'),
  'utf8',
);

interface CssRule {
  selector: string;
  decls: Record<string, string>;
}

// Tiny block-aware CSS parser: returns top-level rules (no nesting) plus
// declarations. Comments are stripped. Anything fancy (media queries,
// @supports) is collapsed to its inner block.
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
    // Split by top-level semicolons only (declarations don't contain
    // nested braces in this stylesheet).
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
    // Exact selector match (selectors can be comma-separated — split).
    const sels = r.selector.split(',').map((s) => s.trim());
    if (!sels.includes(selector)) continue;
    const v = r.decls[prop.toLowerCase()];
    if (v !== undefined) return v;
  }
  return null;
};

describe('layout — internal scrolling', () => {
  it('pins root to viewport height instead of min-height', () => {
    // The previous bug used `min-height: 100vh`, which lets content push
    // the root past the viewport — and DetailPage's overflow:hidden
    // clipped it. Must be `height: 100vh` + overflow hidden.
    expect(decl('.sl-sl-root', 'height')).toBe('100vh');
    expect(decl('.sl-sl-root', 'overflow')).toBe('hidden');
    expect(decl('.sl-sl-root', 'min-height')).toBeNull();
  });

  it('makes the sidebar list a real scroll container', () => {
    // Without flex:1 + min-height:0 the list grows past the sidebar and
    // overflows into the clipped DetailPage container.
    expect(decl('.sl-sl-sidebar__list', 'overflow-y')).toBe('auto');
    expect(decl('.sl-sl-sidebar__list', 'min-height')).toBe('0');
    expect(decl('.sl-sl-sidebar__list', 'flex')).toBe('1 1 auto');
    expect(decl('.sl-sl-sidebar', 'overflow')).toBe('hidden');
    expect(decl('.sl-sl-sidebar', 'min-height')).toBeNull();
  });

  it('lets the main column shrink so the table can scroll inside it', () => {
    // Grid items default to min-height:auto, which prevents them from
    // shrinking below content size — that kills internal scroll. The fix
    // sets min-height:0 + overflow:hidden on main, and flex:1 + overflow
    // on the table + viewport.
    expect(decl('.sl-sl-main', 'overflow')).toBe('hidden');
    expect(decl('.sl-sl-main', 'min-height')).toBe('0');
    expect(decl('.sl-sl-table', 'flex')).toBe('1 1 auto');
    expect(decl('.sl-sl-table', 'min-height')).toBe('0');
    expect(decl('.sl-sl-table__viewport', 'overflow')).toBe('auto');
    expect(decl('.sl-sl-table__viewport', 'min-height')).toBe('0');
  });

  it('keeps the column header pinned while the body scrolls', () => {
    // Without sticky thead, scrolling the viewport scrolls the column
    // titles away and the user loses orientation in long tables.
    expect(decl('.sl-sl-table__grid th', 'position')).toBe('sticky');
    expect(decl('.sl-sl-table__grid th', 'top')).toBe('0');
  });
});

describe('layout — keyboard preview collapse', () => {
  it('renders a toggle button with aria-expanded', () => {
    // The button is the user-facing "收起键" — without it there's no way
    // to reclaim vertical space from the ~400px preview pane.
    expect(tsx).toMatch(/aria-label=\{previewCollapsed\s*\?\s*'[^']+'\s*:\s*'[^']+'\}/);
    expect(tsx).toMatch(/aria-expanded=\{!previewCollapsed\}/);
  });

  it('only mounts the Keyboard component when expanded', () => {
    // Conditional render keeps the DOM light in the collapsed state and
    // ensures the toggle truly reclaims space (display:none alone wouldn't
    // shrink the section's reserved height).
    expect(tsx).toMatch(/\{!previewCollapsed\s*&&\s*\(/);
    expect(tsx).toMatch(/<Keyboard[\s\S]*?\/>/);
    // And those two appear consecutively, with the closing paren closing
    // the && expression before the </section>.
    const block = tsx.match(
      /\{!previewCollapsed\s*&&\s*\([\s\S]*?\)\}[\s\S]{0,40}<\/section>/,
    );
    expect(block, 'expected guarded <Keyboard/> before </section>').not.toBeNull();
  });

  it('keeps the preview section from claiming vertical room when collapsed', () => {
    // Without reduced padding + zero head margin, the collapsed bar still
    // eats ~50px. The fix collapses it to ~40px total.
    expect(decl('.sl-sl-preview.is-collapsed', 'padding')).toBe('12px 20px');
    expect(
      decl('.sl-sl-preview.is-collapsed .sl-sl-preview__head', 'margin-bottom'),
    ).toBe('0');
  });

  it('persists collapsed state under a dedicated localStorage key', () => {
    // Must not collide with the shortcut data key, otherwise wiping data
    // would also reset the user's preferred layout.
    expect(tsx).toMatch(/sl-shortcut-library:v1:previewCollapsed/);
    expect(tsx).toMatch(/useState<boolean>\(loadPreviewCollapsed\)/);
    expect(tsx).toMatch(/localStorage\.setItem\(PREVIEW_COLLAPSED_KEY/);
  });
});