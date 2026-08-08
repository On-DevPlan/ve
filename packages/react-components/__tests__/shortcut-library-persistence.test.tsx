// @vitest-environment jsdom
// Mark the test environment as a React act()-aware runtime so React 19
// stops warning when we wrap state-changing work in act().

// 边框比例持久化:siderbarW / previewH 从 localStorage 读取,拖拽结束后回写。
// 沿用 shortcut-library-drag.test.tsx 的 stubGeometry pattern。
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

function seedLocalStorage(groups: unknown[]): void {
  localStorage.setItem(SL_KEY, JSON.stringify(groups));
}

function makeGroups(): unknown[] {
  return Array.from({ length: 2 }, (_, gi) => ({
    id: `g${gi}`,
    name: ['VSCode', 'Chrome'][gi],
    shortcuts: Array.from({ length: 3 }, (_, si) => ({
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

/** jsdom 没 layout —— stub 每个 panel 的 clientWidth/Height */
function stubGeometry(sidebarW = 280, previewH = 200): void {
  const geom = (el: HTMLElement | null, w: number, h: number): HTMLElement => {
    const node = el as HTMLElement;
    Object.defineProperty(node, 'clientWidth', { configurable: true, value: w });
    Object.defineProperty(node, 'clientHeight', { configurable: true, value: h });
    return node;
  };
  const rootEl = container.querySelector('.sl-sl-root') as HTMLElement;
  geom(rootEl, 1280, 800);
  geom(container.querySelector('.sl-sl-panel--sidebar'), sidebarW, 756);
  geom(container.querySelector('.sl-sl-main'), 1280 - sidebarW - 4, 756);
  geom(container.querySelector('.sl-sl-preview'), 1280 - sidebarW - 4, previewH);
}

async function mount(): Promise<void> {
  seedLocalStorage(makeGroups());
  await act(async () => {
    root.render(<ShortcutLibrary />);
  });
}

describe('shortcut-library: persistence', () => {
  it('hydrates sidebarWidth from localStorage on mount', async () => {
    localStorage.setItem('sl-shortcut-library:v1:sidebarW', '350');
    await mount();
    // stub sidebar=350,模拟 hydrate 后 panel 真就是这个尺寸
    stubGeometry(350, 200);
    const sidebarInner = container.querySelector(
      '.sl-sl-panel--sidebar .sl-sl-panel__inner',
    ) as HTMLElement;
    await act(async () => {
      container.querySelector('.sl-sl-resize-handle--col')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
    });
    // hydrate 后 sidebar panel 是 350 → freeze 时 inner 也应是 350
    expect(sidebarInner.style.width).toBe('350px');
  });

  it('writes sidebarWidth to localStorage on pointerup', async () => {
    await mount();
    stubGeometry(280, 200);
    const handle = container.querySelector('.sl-sl-resize-handle--col') as HTMLElement;
    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 300, clientY: 400 }));
    });
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 360, clientY: 400 }));
    });
    // dragStart.w=280, dx=60 → w=340 (clamped 到 [200,500])
    expect(localStorage.getItem('sl-shortcut-library:v1:sidebarW')).toBe('340');
  });

  it('hydrates previewHeight from localStorage on mount', async () => {
    localStorage.setItem('sl-shortcut-library:v1:previewH', '320');
    await mount();
    stubGeometry(280, 320);
    const previewInner = container.querySelector(
      '.sl-sl-panel__inner--preview',
    ) as HTMLElement;
    await act(async () => {
      container.querySelector('.sl-sl-resize-handle--row')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
    });
    expect(previewInner.style.height).toBe('320px');
  });

  it('writes previewHeight to localStorage on pointerup', async () => {
    await mount();
    stubGeometry(280, 200);
    const handle = container.querySelector('.sl-sl-resize-handle--row') as HTMLElement;
    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 300, clientY: 200 }));
    });
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 100 }));
    });
    // dragStart.h=200, dy=100-200=-100 → h=200-(-100)=300
    expect(localStorage.getItem('sl-shortcut-library:v1:previewH')).toBe('300');
  });
});