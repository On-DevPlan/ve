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
import SettingsPanel from '../src/shortcut-library/src/pages/SettingsPanel';

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

  it('SettingsPanel renders no account/auth section (auth lives in host UI only)', async () => {
    // Auth UI (登录/已登录/退出) moved out of the library entirely — the host
    // shows it globally. SettingsPanel must render no account section and no
    // inline password form.
    await act(async () => {
      root.render(
        <SettingsPanel
          open
          onClose={() => {}}
          saveMode="auto"
          onChangeSaveMode={() => {}}
          warnOnDirtyExit
          onToggleWarnOnDirtyExit={() => {}}
          dirty={false}
          saving={false}
          onFlushDirty={() => {}}
        />,
      );
    });

    // SettingsPanel renders through a portal to document.body (index.tsx
    // mounts the same way), so query the body, not the render container.
    expect(document.body.querySelector('.sl-sl-settings__auth')).toBeNull();
    expect(document.body.querySelector('input[type="password"]')).toBeNull();
    // 登录 trigger 也已移出设置面板(注意:面板里帮助文案仍可能出现"退出登录"字样,
    // 所以按 button 判,而不是按全文)
    const loginButton = Array.from(
      document.body.querySelectorAll('.sl-sl-settings-panel button'),
    ).find((b) => b.textContent === '登录');
    expect(loginButton).toBeUndefined();
  });

  it('sidebar footer shows login entry + settings only, no logged-in pill or logout', async () => {
    seedLocalStorage(makeGroups());
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    const foot = container.querySelector('.sl-sl-sidebar-foot');
    expect(foot, 'sidebar footer missing').not.toBeNull();
    // 默认未登录 → 显示登录入口 + 设置齿轮
    expect(foot!.textContent).toContain('登录');
    expect(foot!.textContent).toContain('⚙');
    // 已登录态与退出只在全局 host UI 显示,库内不出现
    expect(foot!.textContent).not.toContain('已登录');
    expect(foot!.textContent).not.toContain('退出');
    expect(container.querySelector('.sl-sl-sync-pill')).toBeNull();
  });

  it('filters table rows by condition through the header select', async () => {
    seedLocalStorage([
      {
        id: 'g0',
        name: 'VSCode',
        shortcuts: [
          { id: 's0', combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a', condition: '编辑中', createdAt: 0 },
          { id: 's1', combo: [{ code: 'KeyB', label: 'B', isModifier: false }], description: 'b', condition: '选中文本时', createdAt: 0 },
          { id: 's2', combo: [{ code: 'KeyC', label: 'C', isModifier: false }], description: 'c', condition: '编辑中', createdAt: 0 },
          { id: 's3', combo: [{ code: 'KeyD', label: 'D', isModifier: false }], description: 'd', createdAt: 0 },
        ],
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    await act(async () => {
      root.render(<ShortcutLibrary />);
    });

    const select = container.querySelector(
      '.sl-sl-filter',
    ) as HTMLSelectElement | null;
    expect(select, 'condition filter select missing').not.toBeNull();
    // 去重后的 condition 进选项
    expect(select!.textContent).toContain('编辑中');
    expect(select!.textContent).toContain('选中文本时');

    const rowCount = () => container.querySelectorAll('.sl-sl-row').length;
    expect(rowCount()).toBe(4);

    // 用原型 setter 绕过 React 的受控 value tracker,再派发 change 事件
    const setSelectValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setSelectValue.call(select, '编辑中');
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(rowCount()).toBe(2);
    expect(select!.value).toBe('编辑中');

    // 切回「全部条件」→ 恢复全部行
    await act(async () => {
      setSelectValue.call(select, '');
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(rowCount()).toBe(4);
  });
});
