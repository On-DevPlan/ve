// @vitest-environment jsdom
// Pinpoint test: simulate pointerDown on a keyboard key, assert the
// `is-pressed` className lands on the element and the CSS rule resolves
// to a short transition (not 0.24s).

// @ts-expect-error - React act() flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

function seed(): void {
  // Three groups × two shortcuts so highlightedCodes gets non-empty state
  // on initial render of the detail page (otherwise the preview is hidden
  // and we can't reach the keyboard).
  localStorage.setItem(
    'sl-shortcut-library:v1',
    JSON.stringify([
      {
        id: 'g1', name: 'VSCode', createdAt: 0, updatedAt: 0,
        shortcuts: [
          {
            id: 's1', createdAt: 0,
            combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyR', label: 'R', isModifier: false }],
            description: 'open recent',
          },
        ],
      },
    ]),
  );
}

let container: HTMLDivElement;
let root: Root;
let styleNode: HTMLStyleElement;

beforeEach(() => {
  container = document.createElement('div');
  container.style.height = '800px';
  container.style.width = '1280px';
  document.body.appendChild(container);
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

describe('long-press is-pressed wiring', () => {
  it('applies is-pressed className on pointerDown', async () => {
    seed();
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    // Pick the first keyboard key (KeyQ in row 3 is a stable choice).
    // Look it up by title attribute (we set title={code} in Keyboard.tsx).
    const key = container.querySelector('.sl-sl-kb__key[title="KeyQ"]') as HTMLElement | null;
    expect(key, 'KeyQ should be rendered').not.toBeNull();
    expect(key!.classList.contains('is-pressed')).toBe(false);

    // Fire a real PointerEvent so React's synthetic event handler runs.
    await act(async () => {
      key!.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
      );
    });

    expect(
      key!.classList.contains('is-pressed'),
      'is-pressed className should be applied immediately after pointerDown',
    ).toBe(true);

    // Release — className should clear.
    await act(async () => {
      key!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
    });
    expect(key!.classList.contains('is-pressed')).toBe(false);
  });

  it('is-pressed CSS rule has transition: none (instant color switch)', () => {
    // The base .sl-sl-kb__key has transition: background 0.24s ease-out,
    // so adding is-pressed without overriding transition still fades.
    // We require transition: none to guarantee a truly instant flip.
    const m = CSS.match(/\.sl-sl-kb__key\.is-pressed\s*\{([^}]+)\}/);
    expect(m, 'is-pressed block missing').not.toBeNull();
    expect(m![1]).toMatch(/transition:\s*none/);
  });

  it('is-pressed resets box-shadow (so is-hover yellow glow does not bleed through)', () => {
    // If is-pressed doesn't reset box-shadow, the yellow is-hover glow
    // remains during the hold and animates away on release — which reads
    // as "the key flashed" to the user.
    const m = CSS.match(/\.sl-sl-kb__key\.is-pressed\s*\{([^}]+)\}/);
    expect(m, 'is-pressed block missing').not.toBeNull();
    const decls = m![1];
    expect(decls).toMatch(/box-shadow:\s*none/);
  });
});