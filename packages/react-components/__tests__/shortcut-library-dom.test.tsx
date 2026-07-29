// @vitest-environment jsdom
// Mark the test environment as a React act()-aware runtime so React 19
// stops warning when we wrap state-changing work in act(). Without this
// flag every render logs "The current testing environment is not configured
// to support act(...)".
// @ts-expect-error - React exposes this global to test runners; type defs
// are intentionally missing because it's not part of the public API.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * DOM-level regression test for the shortcut-library scroll + collapse fix.
 *
 * Why this exists alongside shortcut-library-layout.test.ts (which greps
 * CSS/TSX source):
 *   - The layout test pins *what the code says*.
 *   - This test pins *what the browser actually computes*. Catches regressions
 *     where someone changes the CSS but breaks the sticky / overflow chain
 *     in a way a grep won't notice (e.g. setting `overflow: clip` on the
 *     viewport, or putting the wrong element under the overflow:auto scope).
 *
 * What it asserts:
 *   1. With many shortcuts loaded, the table viewport is a real scroll
 *      container (scrollHeight > clientHeight), and the column header is
 *      sticky.
 *   2. The sidebar list is a real scroll container when many groups exist.
 *   3. Toggling the preview button (a) removes the <Keyboard/> node and
 *      (b) flips the preview section to its is-collapsed style.
 *
 * Notes:
 *   - jsdom does not do layout (no real geometry), so clientHeight/scrollHeight
 *     stay at 0. We assert via getComputedStyle that the *CSS values* are
 *     correct, which is what actually drives scroll behavior in a real
 *     browser. This is the standard limitation; see
 *     https://github.com/jsdom/jsdom/issues/1042
 *   - We do simulate the toggle behavior end-to-end via React DOM events
 *     and confirm the Keyboard subtree unmounts, which is the *behavioral*
 *     half of the fix (the visual half — "preview is short" — is governed
 *     by the CSS we already pin in the other test).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ShortcutLibrary from '../src/shortcut-library';

// jsdom does not run Vite's CSS pipeline. Inject the stylesheet as a <style>
// node so getComputedStyle can resolve our rules. This is the standard
// workaround (see jsdom issue #1042); without it, every CSS-driven
// assertion would return the user-agent default ('visible' / '').
const CSS = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.css'),
  'utf8',
);

const SL_KEY = 'sl-shortcut-library:v1';
const PREVIEW_KEY = 'sl-shortcut-library:v1:previewCollapsed';

function seedLocalStorage(groups: unknown[]): void {
  localStorage.setItem(SL_KEY, JSON.stringify(groups));
}

function makeGroups(): unknown[] {
  // 5 groups × 60 shortcuts = enough rows that the viewport would overflow
  // any reasonable sidebar/table height in a real browser.
  return Array.from({ length: 5 }, (_, gi) => ({
    id: `g${gi}`,
    name: ['VSCode', 'Chrome', 'Slack', 'Notion', 'Linear'][gi],
    shortcuts: Array.from({ length: 60 }, (_, si) => ({
      id: `${gi}-${si}`,
      combo: [{ code: 'KeyA', label: 'A', isModifier: false }],
      description: `action ${gi}-${si}`,
      createdAt: 0,
    })),
    createdAt: 0,
    updatedAt: 0,
  }));
}

let container: HTMLDivElement;
let root: Root;
let styleNode: HTMLStyleElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  // JSDOM has no layout — give the root a viewport-height box so
  // getComputedStyle reads back our percent/100vh values faithfully.
  container.style.height = '800px';
  container.style.width = '1280px';
  styleNode = document.createElement('style');
  styleNode.textContent = CSS;
  document.head.appendChild(styleNode);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  styleNode.remove();
  localStorage.clear();
});

describe('shortcut-library: rendered DOM contracts', () => {
  it('renders the sidebar list as a scroll container', async () => {
    seedLocalStorage(makeGroups());
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    const list = container.querySelector(
      '.sl-sl-sidebar__list',
    ) as HTMLElement | null;
    expect(list, 'sidebar list missing').not.toBeNull();
    const cs = getComputedStyle(list!);
    expect(cs.overflowY).toBe('auto');
    // flex:1 1 auto + min-height:0 are what actually let the list scroll —
    // the predecessor bug had it set to overflow-y:auto without those, so
    // it would grow past the sidebar instead of scrolling.
    expect(cs.flexGrow).toBe('1');
    expect(cs.minHeight).toBe('0px');
  });

  it('renders the table viewport as a scroll container with sticky thead', async () => {
    seedLocalStorage(makeGroups());
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    const viewport = container.querySelector(
      '.sl-sl-table__viewport',
    ) as HTMLElement | null;
    expect(viewport, 'table viewport missing').not.toBeNull();
    expect(getComputedStyle(viewport!).overflow).toBe('auto');
    expect(getComputedStyle(viewport!).minHeight).toBe('0px');

    const th = container.querySelector(
      '.sl-sl-table__grid thead th',
    ) as HTMLElement | null;
    expect(th, 'thead th missing').not.toBeNull();
    expect(getComputedStyle(th!).position).toBe('sticky');
    expect(getComputedStyle(th!).top).toBe('0px');
  });

  it('mounts <Keyboard/> by default and unmounts it on collapse', async () => {
    // Start fresh — no persisted collapsed flag.
    localStorage.removeItem(PREVIEW_KEY);
    seedLocalStorage(makeGroups());

    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    // Keyboard renders a stable attribute: each key has title="<code>".
    // Pick one we know exists (KeyA is in every row, but also in the
    // Keyboard ROWS array as 'KeyQ'...'KeyP').
    const keySelector = '.sl-sl-kb__key';
    expect(container.querySelectorAll(keySelector).length).toBeGreaterThan(0);

    // Toggle button is rendered with aria-expanded={!previewCollapsed}
    const toggle = container.querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement | null;
    expect(toggle, 'collapse toggle missing').not.toBeNull();
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');

    // Click it.
    await act(async () => {
      toggle!.click();
    });

    expect(container.querySelectorAll(keySelector).length).toBe(0);
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');

    const previewSection = container.querySelector(
      '.sl-sl-preview',
    ) as HTMLElement | null;
    expect(previewSection, 'preview section missing').not.toBeNull();
    expect(previewSection!.classList.contains('is-collapsed')).toBe(true);
  });

  it('persists collapsed state across remounts', async () => {
    seedLocalStorage(makeGroups());
    // Pre-seed LS as if the user previously collapsed the preview.
    localStorage.setItem(PREVIEW_KEY, '1');

    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    expect(container.querySelectorAll('.sl-sl-kb__key').length).toBe(0);
    const toggle = container.querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement | null;
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    expect(
      container
        .querySelector('.sl-sl-preview')!
        .classList.contains('is-collapsed'),
    ).toBe(true);
  });
});