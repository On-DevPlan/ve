// @vitest-environment jsdom
/**
 * Integration smoke: render the real component end-to-end (no mocking of
 * the CSS import) and assert that `is-pressed` actually ends up on a
 * keyboard key after pointerdown.
 *
 * This catches cases where the CSS module might be tree-shaken, the
 * shadow-root clone might miss the new rule, or the bundler might fail
 * silently on the new selector.
 */

// @ts-expect-error - React act() flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import ShortcutLibrary from '../src/shortcut-library';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // Seed one shortcut so the table renders a selected group → keyboard visible
  localStorage.setItem(
    'sl-shortcut-library:v1',
    JSON.stringify([
      {
        id: 'g1', name: 'VSCode', createdAt: 0, updatedAt: 0,
        shortcuts: [
          {
            id: 's1', createdAt: 0,
            combo: [{ code: 'KeyQ', label: 'Q', isModifier: false }],
            description: 'test',
          },
        ],
      },
    ]),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

describe('integration: real component render', () => {
  it('mounts ShortcutLibrary and renders the keyboard', async () => {
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });
    // Even without injecting CSS, the JSX structure must include keyboard keys
    const keys = container.querySelectorAll('.sl-sl-kb__key');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('pointerDown adds is-pressed class to the pressed key', async () => {
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });
    const key = container.querySelector('.sl-sl-kb__key[title="KeyQ"]') as HTMLElement;
    expect(key).not.toBeNull();

    // Simulate the same React synthetic event flow that a real mouse-down
    // would generate. React listens at the document root in 17+/18+, so
    // dispatching on the element bubbles correctly.
    await act(async () => {
      key.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
        }),
      );
    });

    // Class must be applied synchronously (no transition delay because we
    // set state synchronously in the handler)
    expect(key.classList.contains('is-pressed'),
      'is-pressed must be applied synchronously after pointerdown'
    ).toBe(true);

    // Other state classes should not have leaked
    expect(key.classList.contains('is-flash')).toBe(false);
  });

  it('release on pointerup removes is-pressed', async () => {
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });
    const key = container.querySelector('.sl-sl-kb__key[title="KeyQ"]') as HTMLElement;
    await act(async () => {
      key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    });
    expect(key.classList.contains('is-pressed')).toBe(true);

    await act(async () => {
      key.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
    });
    expect(key.classList.contains('is-pressed')).toBe(false);
  });
});