// @vitest-environment jsdom
// 全屏热力键盘画布:画 ANSI 104 键盘 + 频度染色 + 居中逻辑 + 缩放/拖动/关闭。

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

async function mountAndOpenCanvas(groups: unknown[]): Promise<void> {
  seed(groups);
  await act(async () => {
    root.render(<ShortcutLibrary />);
  });
  const btn = Array.from(container.querySelectorAll('button'))
    .find((b) => b.textContent === '全屏') as HTMLElement | undefined;
  if (!btn) throw new Error('全屏 button not found');
  await act(async () => { btn.click(); });
}

function makeSingleGroup(shortcuts: { combo: { code: string; label: string; isModifier: boolean }[]; description: string }[]): unknown[] {
  return [{
    id: 'g1', name: 'VSCode', createdAt: 0, updatedAt: 0,
    shortcuts: shortcuts.map((s, i) => ({
      id: `s${i}`, createdAt: 0, combo: s.combo, description: s.description,
    })),
  }];
}

describe('shortcut-library: fullscreen canvas (keyboard heatmap)', () => {
  it('renders a backdrop with title containing group name', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    const backdrop = document.body.querySelector('.sl-sl-canvas-backdrop');
    expect(backdrop).not.toBeNull();
    const title = document.body.querySelector('.sl-sl-canvas__title');
    expect(title!.textContent).toContain('VSCode');
  });

  it('renders the ANSI 104 keyboard: every keyDef gets a key element', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    const keys = document.body.querySelectorAll('.sl-sl-canvas-key:not(.sl-sl-canvas-key--spacer)');
    // 主键区(去 spacer)+ 导航簇 + 小键盘 = 104 个可交互键
    expect(keys.length).toBe(104);
  });

  it('keys for bound codes show freq badge ×N and data-freq=N', async () => {
    // 3 个含 Ctrl 的 shortcut + 1 个含 KeyA 的
    await mountAndOpenCanvas(makeSingleGroup([
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyA', label: 'A', isModifier: false }], description: 'sel-all' },
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyC', label: 'C', isModifier: false }], description: 'copy' },
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyV', label: 'V', isModifier: false }], description: 'paste' },
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyA', label: 'A', isModifier: false }], description: 'sel-line' },
    ]));
    // Ctrl: data-freq=3(只数不同的 combo,但同 key 在 3 个 combo 内出现 → 3)
    // 同 Ctrl 出现在 4 个 combo 内 → freq=4
    // KeyA 出现在 2 个 combo → freq=2
    const ctrlEl = document.body.querySelector('[data-code="ControlLeft"]') as HTMLElement;
    expect(ctrlEl).not.toBeNull();
    expect(ctrlEl.dataset.freq).toBe('4');
    expect(ctrlEl.querySelector('.sl-sl-canvas-key__freq')!.textContent).toBe('×4');
    const aEl = document.body.querySelector('[data-code="KeyA"]') as HTMLElement;
    expect(aEl.dataset.freq).toBe('2');
    expect(aEl.querySelector('.sl-sl-canvas-key__freq')!.textContent).toBe('×2');
  });

  it('keys with 0 freq have no badge and the gray base color', async () => {
    // 只 seed KeyZ,其他键(如 KeyA)应未使用
    await mountAndOpenCanvas(makeSingleGroup([
      { combo: [{ code: 'KeyZ', label: 'Z', isModifier: false }], description: 'z' },
    ]));
    const zEl = document.body.querySelector('[data-code="KeyZ"]') as HTMLElement;
    expect(zEl.dataset.freq).toBe('1');
    // KeyA 未使用 → freq=0,无 badge,灰色
    const aEl = document.body.querySelector('[data-code="KeyA"]') as HTMLElement;
    expect(aEl.dataset.freq).toBe('0');
    expect(aEl.querySelector('.sl-sl-canvas-key__freq')).toBeNull();
    expect(aEl.style.background).toBe('rgb(42, 45, 53)');
  });

  it('key main label (label) is rendered in __main, freq in __freq (does not overlap)', async () => {
    await mountAndOpenCanvas(makeSingleGroup([
      { combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' },
    ]));
    const aEl = document.body.querySelector('[data-code="KeyA"]') as HTMLElement;
    expect(aEl.querySelector('.sl-sl-canvas-key__main')!.textContent).toBe('A');
    expect(aEl.querySelector('.sl-sl-canvas-key__freq')!.textContent).toBe('×1');
  });

  it('renders each binding (combo + description) inside the key it belongs to', async () => {
    // Ctrl+C (copy) 和 Ctrl+V (paste):两条 shortcut 都含 ControlLeft
    await mountAndOpenCanvas(makeSingleGroup([
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyC', label: 'C', isModifier: false }], description: 'copy' },
      { combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyV', label: 'V', isModifier: false }], description: 'paste' },
    ]));
    // ControlLeft 应挂两条 binding
    const ctrlEl = document.body.querySelector('[data-code="ControlLeft"]') as HTMLElement;
    const ctrlBindings = ctrlEl.querySelectorAll('.sl-sl-canvas-key__binding');
    expect(ctrlBindings.length).toBe(2);
    const ctrlCombos = Array.from(ctrlBindings).map((b) => b.querySelector('.sl-sl-canvas-key__combo')!.textContent);
    expect(ctrlCombos).toEqual(expect.arrayContaining(['Ctrl+C', 'Ctrl+V']));
    const ctrlDescs = Array.from(ctrlBindings).map((b) => b.querySelector('.sl-sl-canvas-key__desc')!.textContent);
    expect(ctrlDescs).toEqual(expect.arrayContaining(['copy', 'paste']));
    // KeyC 只挂一条(Ctrl+C)
    const cEl = document.body.querySelector('[data-code="KeyC"]') as HTMLElement;
    expect(cEl.querySelectorAll('.sl-sl-canvas-key__binding').length).toBe(1);
    expect(cEl.querySelector('.sl-sl-canvas-key__combo')!.textContent).toBe('Ctrl+C');
    expect(cEl.querySelector('.sl-sl-canvas-key__desc')!.textContent).toBe('copy');
  });

  it('keys with 0 bindings have no bindings list', async () => {
    await mountAndOpenCanvas(makeSingleGroup([
      { combo: [{ code: 'KeyZ', label: 'Z', isModifier: false }], description: 'z' },
    ]));
    const aEl = document.body.querySelector('[data-code="KeyA"]') as HTMLElement;
    expect(aEl.querySelector('.sl-sl-canvas-key__bindings')).toBeNull();
  });

  it('ESC closes the canvas', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).toBeNull();
  });

  it('clicking × button closes the canvas', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    const closeBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="关闭"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    await act(async () => { closeBtn.click(); });
    expect(document.body.querySelector('.sl-sl-canvas-backdrop')).toBeNull();
  });

  it('+ and − buttons adjust scale', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    const scaleEl = document.body.querySelector('.sl-sl-canvas__scale');
    const before = scaleEl!.textContent;
    const minusBtn = document.body.querySelector('.sl-sl-canvas__ctrls button[aria-label="缩小"]') as HTMLElement;
    await act(async () => { minusBtn.click(); });
    expect(scaleEl!.textContent).not.toBe(before);
  });

  it('legend chips correspond to freq tiers', async () => {
    await mountAndOpenCanvas(makeSingleGroup([{ combo: [{ code: 'KeyA', label: 'A', isModifier: false }], description: 'a' }]));
    const chips = document.body.querySelectorAll('.sl-sl-canvas__legend-chip');
    expect(chips.length).toBe(6);
    expect(chips[0].textContent).toBe('0');
    expect(chips[5].textContent).toBe('5+');
  });
});