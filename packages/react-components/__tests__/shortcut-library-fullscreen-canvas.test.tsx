// @vitest-environment jsdom
// 全屏浮窗画布:展示当前选中组的所有快捷键,支持缩放/拖动/ESC 关闭。

// Mark the test environment as a React act()-aware runtime so React 19
// stops warning when we wrap state-changing work in act().
// @ts-expect-error - React exposes this global to test runners; type defs
// are intentionally missing because it's not part of the public API.
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

const SL_KEY = 'sl-shortcut-library:v1';

function seed(groups: unknown[]): void {
  localStorage.setItem(SL_KEY, JSON.stringify(groups));
}

function makeSingleGroup(n: number): unknown[] {
  return [{
    id: 'g1', name: 'VSCode', createdAt: 0, updatedAt: 0,
    shortcuts: Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      createdAt: 0,
      combo: [{ code: `Key${String.fromCharCode(65 + (i % 26))}`, label: String.fromCharCode(65 + (i % 26)), isModifier: false }],
      description: `action ${i}`,
    })),
  }];
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
  document.body.querySelectorAll('.sl-sl-canvas-backdrop').forEach((el) => el.remove());
});

async function mountAndOpenCanvas(): Promise<void> {
  seed(makeSingleGroup(7));
  await act(async () => {
    root.render(<ShortcutLibrary />);
  });
  // 点 "全屏" 按钮
  const btn = Array.from(container.querySelectorAll('button'))
    .find((b) => b.textContent === '全屏') as HTMLElement | undefined;
  if (!btn) throw new Error('全屏 button not found');
  await act(async () => { btn.click(); });
}

describe('shortcut-library: fullscreen canvas', () => {
  it('renders one node per shortcut in currently selected group', async () => {
    await mountAndOpenCanvas();
    const backdrop = document.body.querySelector('.sl-sl-canvas-backdrop');
    expect(backdrop).not.toBeNull();
    const nodes = document.body.querySelectorAll('.sl-sl-canvas-node');
    expect(nodes.length).toBe(7);
  });

  it('renders group name in canvas header', async () => {
    await mountAndOpenCanvas();
    const title = document.body.querySelector('.sl-sl-canvas__title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('VSCode');
  });

  it('ESC closes the canvas', async () => {
    await mountAndOpenCanvas();
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).toBeNull();
  });

  it('clicking × button closes the canvas', async () => {
    await mountAndOpenCanvas();
    const closeBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="关闭"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    await act(async () => { closeBtn.click(); });
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).toBeNull();
  });

  it('canvas +/− buttons adjust scale', async () => {
    await mountAndOpenCanvas();
    const scaleEl = document.body.querySelector('.sl-sl-canvas__scale');
    expect(scaleEl).not.toBeNull();
    const before = scaleEl!.textContent;
    const minusBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="缩小"]') as HTMLElement;
    await act(async () => { minusBtn.click(); });
    expect(scaleEl!.textContent).not.toBe(before);
  });

  it('canvas reset button restores scale to 100%', async () => {
    await mountAndOpenCanvas();
    const plusBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="放大"]') as HTMLElement;
    await act(async () => { plusBtn.click(); plusBtn.click(); plusBtn.click(); });
    const resetBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="重置"]') as HTMLElement;
    await act(async () => { resetBtn.click(); });
    const scaleEl = document.body.querySelector('.sl-sl-canvas__scale');
    expect(scaleEl!.textContent).toBe('100%');
  });

  it('wheel zoom stays in [50%, 300%] range', async () => {
    await mountAndOpenCanvas();
    const stage = document.body.querySelector('.sl-sl-canvas__stage') as HTMLElement;
    expect(stage).not.toBeNull();
    // 50 次大滚轮(每次 * 1.1,容易超上限)
    for (let i = 0; i < 50; i++) {
      await act(async () => {
        stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      });
    }
    const scaleEl = document.body.querySelector('.sl-sl-canvas__scale');
    const txt = scaleEl!.textContent!;
    const pct = parseInt(txt.replace('%', ''), 10);
    expect(pct).toBeLessThanOrEqual(300);
    // 反向再滚
    for (let i = 0; i < 100; i++) {
      await act(async () => {
        stage.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      });
    }
    const pct2 = parseInt(document.body.querySelector('.sl-sl-canvas__scale')!.textContent!.replace('%', ''), 10);
    expect(pct2).toBeGreaterThanOrEqual(50);
  });
});