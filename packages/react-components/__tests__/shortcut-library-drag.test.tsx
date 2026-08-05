// @vitest-environment jsdom
// Mark the test environment as a React act()-aware runtime so React 19
// stops warning when we wrap state-changing work in act(). Without this
// flag every render logs "The current testing environment is not configured
// to support act(...)".
// @ts-expect-error - React exposes this global to test runners; type defs
// are intentionally missing because it's not part of the public API.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * DOM-level regression test for the shortcut-library drag-layout freeze.
 *
 * The "freeze snapshot" perf design wraps every resizable pane in a panel
 * (whose size follows the drag) + an inner (whose size is pinned on
 * pointerdown so content never re-lays out mid-drag). The pin values must
 * come from each pane's OWN panel — otherwise content is frozen to the
 * wrong size and the pane clips it.
 *
 * Regression pinned here: the main pane's inner was frozen to the ROOT's
 * size (full grid incl. sidebar + userkv bar) instead of the <main> panel's
 * size, so the table + preview were laid out ~280px too wide and clipped
 * during drag, then snapped back on pointerup.
 *
 * jsdom has no layout (all clientWidth/Height are 0), so we stub geometry
 * per element and assert the inline freeze values.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ShortcutLibrary from '../src/shortcut-library';

const CSS = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.css'),
  'utf8',
);

const SL_KEY = 'sl-shortcut-library:v1';

function seedLocalStorage(groups: unknown[]): void {
  localStorage.setItem(SL_KEY, JSON.stringify(groups));
}

function makeGroups(): unknown[] {
  return Array.from({ length: 5 }, (_, gi) => ({
    id: `g${gi}`,
    name: ['VSCode', 'Chrome', 'Slack', 'Notion', 'Linear'][gi],
    shortcuts: Array.from({ length: 20 }, (_, si) => ({
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

/** jsdom has no geometry — stub real-world sizes for a 1280×800 viewport. */
function stubGeometry(): void {
  const geom = (el: HTMLElement | null, w: number, h: number): HTMLElement => {
    const node = el as HTMLElement;
    Object.defineProperty(node, 'clientWidth', { configurable: true, value: w });
    Object.defineProperty(node, 'clientHeight', { configurable: true, value: h });
    return node;
  };
  const rootEl = container.querySelector('.sl-sl-root') as HTMLElement;
  geom(rootEl, 1280, 800);
  // userkv-bar row ≈ 44px; sidebar 280 + 4px handle → main ≈ 916×756
  geom(container.querySelector('.sl-sl-panel--sidebar'), 280, 756);
  geom(container.querySelector('.sl-sl-main'), 916, 756);
  geom(container.querySelector('.sl-sl-preview'), 852, 200);
}

async function mount(): Promise<void> {
  seedLocalStorage(makeGroups());
  await act(async () => {
    root.render(<ShortcutLibrary />);
  });
}

describe('shortcut-library: drag-layout freeze', () => {
  it('pins the main inner to the <main> panel size, not the root size', async () => {
    await mount();
    stubGeometry();

    const mainInner = container.querySelector(
      '.sl-sl-panel__inner--main',
    ) as HTMLElement;
    const handle = container.querySelector(
      '.sl-sl-resize-handle--col',
    ) as HTMLElement;

    await act(async () => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 300,
          clientY: 400,
        }),
      );
    });

    // Must be the <main> pane's size — NOT the 1280×800 root grid.
    expect(mainInner.style.width).toBe('916px');
    expect(mainInner.style.height).toBe('756px');
    // And it must be size-contained so the browser skips its subtree layout.
    expect(mainInner.style.contain).toContain('size');
  });

  it('pins sidebar and preview inners to their own panels', async () => {
    await mount();
    stubGeometry();

    const sidebarInner = container.querySelector(
      '.sl-sl-panel--sidebar .sl-sl-panel__inner',
    ) as HTMLElement;
    const previewInner = container.querySelector(
      '.sl-sl-panel__inner--preview',
    ) as HTMLElement;
    const handle = container.querySelector(
      '.sl-sl-resize-handle--col',
    ) as HTMLElement;

    await act(async () => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 300,
          clientY: 400,
        }),
      );
    });

    expect(sidebarInner.style.width).toBe('280px');
    expect(sidebarInner.style.height).toBe('756px');
    expect(previewInner.style.width).toBe('852px');
    expect(previewInner.style.height).toBe('200px');
  });

  it('unfreezes every inner on pointerup', async () => {
    await mount();
    stubGeometry();

    const mainInner = container.querySelector(
      '.sl-sl-panel__inner--main',
    ) as HTMLElement;
    const sidebarInner = container.querySelector(
      '.sl-sl-panel--sidebar .sl-sl-panel__inner',
    ) as HTMLElement;
    const previewInner = container.querySelector(
      '.sl-sl-panel__inner--preview',
    ) as HTMLElement;
    const handle = container.querySelector(
      '.sl-sl-resize-handle--col',
    ) as HTMLElement;

    await act(async () => {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 300,
          clientY: 400,
        }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 400,
        }),
      );
    });

    for (const inner of [mainInner, sidebarInner, previewInner]) {
      expect(inner.style.width).toBe('');
      expect(inner.style.height).toBe('');
      expect(inner.style.contain).toBe('');
    }
  });
});
