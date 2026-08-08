// @vitest-environment jsdom
// 验证「可视化键盘 + popup 只显示当前选中组」。
//
// seed 两个组:G1 含 KeyA,G2 含 KeyB。选 G1 时,所有 popup 只列 G1 的 binding;
// Keyboard 上只有 KeyA 标 has-binding,G2 的 KeyB 没有(即便它在 G2 里)。

// Mark the test environment as a React act()-aware runtime so React 19
// stops warning when we wrap state-changing work in act().
// @ts-expect-error - React exposes this global to test runners; type defs
// are intentionally missing because it's not part of the public API.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

function seedTwoGroups(): void {
  // G1 含 KeyA,G2 含 KeyB —— 切组测试可见
  localStorage.setItem(
    SL_KEY,
    JSON.stringify([
      {
        id: 'g1', name: 'VSCode', createdAt: 0, updatedAt: 0,
        shortcuts: [
          { id: 's1', createdAt: 0, combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'G1-A' },
          { id: 's2', createdAt: 0, combo: [{ code: 'KeyC', label: 'C', isModifier: false }], description: 'G1-C' },
        ],
      },
      {
        id: 'g2', name: 'Chrome', createdAt: 0, updatedAt: 0,
        shortcuts: [
          { id: 's3', createdAt: 0, combo: [{ code: 'KeyB', label: 'B', isModifier: false }], description: 'G2-B' },
          { id: 's4', createdAt: 0, combo: [{ code: 'KeyC', label: 'C', isModifier: false }], description: 'G2-C' },
        ],
      },
    ]),
  );
}

let container: HTMLDivElement;
let root: Root;
let styleNode: HTMLStyleElement;

beforeEach(() => {
  vi.useFakeTimers();
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
  vi.useRealTimers();
  container.remove();
  styleNode.remove();
  localStorage.clear();
});

async function mount(): Promise<void> {
  seedTwoGroups();
  await act(async () => {
    root.render(<ShortcutLibrary />);
  });
}

/** 在 shadow DOM / 普通 DOM 中找 data-shortcut-code 的元素 */
function findKey(code: string): HTMLElement | null {
  return container.querySelector(`[data-shortcut-code="${code}"]`) as HTMLElement | null;
}

/** 触发「长按某键」:pointerdown 触发 onPress(KEY_HOLD_MS=400) → 弹 popup */
async function longPressKey(code: string): Promise<void> {
  const key = findKey(code);
  if (!key) throw new Error(`key ${code} not found`);
  await act(async () => {
    key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  });
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
}

/** 触发「双击某键」:React 的 onDoubleClick 合成事件 */
async function doubleClickKey(code: string): Promise<void> {
  const key = findKey(code);
  if (!key) throw new Error(`key ${code} not found`);
  await act(async () => {
    key.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, button: 0 }));
  });
}

describe('shortcut-library: group scope', () => {
  it('Keyboard has-binding only marks keys in currently selected group', async () => {
    await mount();
    // 默认选 G1,KeyA 应标 has-binding,KeyB 不应
    const keyA = findKey('KeyA');
    const keyB = findKey('KeyB');
    expect(keyA).not.toBeNull();
    expect(keyB).not.toBeNull();
    expect(keyA!.classList.contains('has-binding')).toBe(true);
    expect(keyB!.classList.contains('has-binding')).toBe(false);
  });

  it('Keyboard has-binding updates when switching groups', async () => {
    await mount();
    // 兜底:直接读 sidebar 中的 G2 文字节点并触发
    const g2Btn = Array.from(container.querySelectorAll('*'))
      .find((el) => el.textContent === 'Chrome') as HTMLElement | undefined;
    if (!g2Btn) throw new Error('Chrome button not found');
    await act(async () => {
      g2Btn.click();
    });
    // 切到 G2 后,KeyA 不再 has-binding,KeyB 应有
    const keyA = findKey('KeyA');
    const keyB = findKey('KeyB');
    expect(keyA!.classList.contains('has-binding')).toBe(false);
    expect(keyB!.classList.contains('has-binding')).toBe(true);
  });

  it('long-press popup shows only currently selected group bindings', async () => {
    await mount();
    // KeyC 在 G1 和 G2 都有;选 G1,长按 KeyC,popup 应只列 G1-C
    await longPressKey('KeyC');
    // 长按 popup 通过 portal 渲染到 document.body
    const popup = document.body.querySelector('.sl-sl-longpress');
    expect(popup).not.toBeNull();
    const items = popup!.querySelectorAll('.sl-sl-longpress__group');
    const groups = Array.from(items).map((el) => el.textContent);
    // 应该只有 VSCode,不能有 Chrome
    expect(groups).toEqual(['VSCode']);
  });

  it('double-click popup shows only currently selected group bindings', async () => {
    await mount();
    await doubleClickKey('KeyC');
    const popup = document.body.querySelector('.sl-sl-longpress');
    expect(popup).not.toBeNull();
    const items = popup!.querySelectorAll('.sl-sl-longpress__group');
    const groups = Array.from(items).map((el) => el.textContent);
    expect(groups).toEqual(['VSCode']);
  });

  it('long-press on key only in non-selected group shows empty popup', async () => {
    await mount();
    // 默认 G1,长按 KeyB(只在 G2)→ popup 应为空
    await longPressKey('KeyB');
    const popup = document.body.querySelector('.sl-sl-longpress');
    expect(popup).not.toBeNull();
    const empty = popup!.querySelector('.sl-sl-longpress__empty');
    expect(empty).not.toBeNull();
  });
});