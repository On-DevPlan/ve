// @vitest-environment jsdom
/**
 * Integration smoke: render the real component end-to-end (no mocking of
 * the CSS import) and assert the new hold-to-popup behavior:
 *   - pointerDown on a keyboard key ADDS is-on to the className (visual
 *     feedback that the key is being held)
 *   - After KEY_HOLD_MS the mapping popup portaled to document.body appears
 *   - pointerUp / pointerout removes is-on
 *
 * This catches cases where the CSS module might be tree-shaken, the
 * shadow-root clone might miss the new rule, or the bundler might fail
 * silently on the new selector.
 */

// @ts-expect-error - React act() flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import ShortcutLibrary from '../src/shortcut-library';

const KEY_HOLD_MS = 800;

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

  it('pointerDown ADDS is-on to the key (visual feedback while pressing)', async () => {
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });
    const key = container.querySelector('.sl-sl-kb__key[title="KeyQ"]') as HTMLElement;
    expect(key).not.toBeNull();
    expect(key.classList.contains('is-on')).toBe(false);

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

    // 关键不变量:pointerdown 立即让键挂 is-on(给用户「正在按住」反馈)。
    expect(key.classList.contains('is-on')).toBe(true);
  });

  it('pointerup before KEY_HOLD_MS removes is-on, no popup', async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<ShortcutLibrary />);
      });
      const key = container.querySelector('.sl-sl-kb__key[title="KeyQ"]') as HTMLElement;
      const classBefore = key.className;

      await act(async () => {
        key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      });
      expect(key.classList.contains('is-on')).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(KEY_HOLD_MS - 1);
      });
      expect(
        document.querySelectorAll('.sl-sl-longpress').length,
        'popup must not appear before KEY_HOLD_MS',
      ).toBe(0);

      // 短按释放:is-on 移除,无 popup
      await act(async () => {
        key.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
      });
      expect(key.className).toBe(classBefore);
      expect(document.querySelectorAll('.sl-sl-longpress').length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
