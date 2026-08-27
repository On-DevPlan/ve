// @vitest-environment jsdom
// Color Studio ImportModal:
//   - 头部「复制格式提示词」按钮 → 剪贴板含 COLOR_IMPORT_FORMAT_PROMPT 关键段落
//   - 「AI 增量提示词」按钮存在性 + disabled(无 activePalette 时)+ 内容含已有 hex 清单与避冲突指令
//   - 粘贴 TOML → 解析预览 → 确认导入回调

// Mark the test environment as a React act()-aware runtime.
// @ts-expect-error - React exposes this global to test runners.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ImportModal } from '../src/color-studio/src/components/ImportModal';
import { parseColorImportToml } from '../src/color-studio/src/engine/importParser';
import type { ColorEntry, Palette } from '../../apps/showcase/src/api/components/color-studio/types';

const CSS = readFileSync(resolve(__dirname, '../src/color-studio/index.css'), 'utf8');

const writeTextMock = vi.fn(async () => {});
Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

let container: HTMLDivElement;
let root: Root;
let styleNode: HTMLStyleElement;

const noopImport = () => ({ palettesAdded: 0, palettesAppended: 0, colorsAdded: 0, colorsSkipped: 0 });

beforeEach(() => {
  writeTextMock.mockClear();
  writeTextMock.mockResolvedValue(undefined);
  container = document.createElement('div');
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
});

interface MountOpts {
  activePalette?: { palette: Palette; colors: ColorEntry[] } | null;
  onImport?: typeof noopImport;
}

async function mount(opts: MountOpts = {}): Promise<void> {
  await act(async () => {
    root.render(
      <ImportModal
        open
        onImport={opts.onImport ?? noopImport}
        onClose={() => {}}
        activePalette={opts.activePalette ?? null}
      />,
    );
  });
}

function findButton(text: string): HTMLElement {
  const btn = Array.from(container.querySelectorAll('button'))
    .find((b) => b.textContent?.includes(text)) as HTMLElement | undefined;
  expect(btn, `button containing "${text}"`).toBeDefined();
  return btn!;
}

function setTextarea(value: string): void {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!;
    setter.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ImportModal: format prompt buttons', () => {
  it('renders 复制格式提示词 button', async () => {
    await mount();
    expect(findButton('复制格式提示词')).toBeDefined();
  });

  it('clicking copies a prompt with format-spec fingerprints', async () => {
    await mount();
    await act(async () => { findButton('复制格式提示词').click(); });
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const text = writeTextMock.mock.calls[0][0];
    expect(text).toContain('[[palettes]]');
    expect(text).toContain('[[palettes.colors]]');
    expect(text).toContain('weight');
    expect(text).toContain('字段表');
    expect(text).toContain('输出要求');
  });

  it('shows 已复制 feedback after copy', async () => {
    await mount();
    const btn = findButton('复制格式提示词');
    await act(async () => { btn.click(); });
    expect(btn.textContent).toContain('已复制');
  });
});

describe('ImportModal: AI incremental prompt', () => {
  const sampleColors: ColorEntry[] = [
    { id: 'c1', hex: '#3B82F6', weight: 60, locked: false, note: '主品牌蓝', tags: ['primary'], createdAt: 0, updatedAt: 0 },
    { id: 'c2', hex: '#1D4ED8', weight: 30, locked: false, note: '', tags: [], createdAt: 0, updatedAt: 0 },
  ];

  it('disables button when no activePalette', async () => {
    await mount({ activePalette: null });
    expect(findButton('AI 增量提示词').hasAttribute('disabled')).toBe(true);
  });

  it('copies a prompt naming the palette and enumerating existing hexes', async () => {
    await mount({ activePalette: { palette: { id: 'p1', name: '品牌主色', colorIds: ['c1', 'c2'], harmony: null, sortBy: 'manual', createdAt: 0, updatedAt: 0 }, colors: sampleColors } });
    await act(async () => { findButton('AI 增量提示词').click(); });
    const text = writeTextMock.mock.calls[0][0];
    expect(text).toContain('品牌主色');
    expect(text).toMatch(/#3B82F6/);
    expect(text).toMatch(/#1D4ED8/);
    expect(text).toMatch(/(避开|不要|avoid)/i);
    expect(text).toMatch(/(冲突|重复|collision|duplicate)/i);
  });

  it('copied incremental prompt embeds the full format spec', async () => {
    await mount({ activePalette: { palette: { id: 'p1', name: '品牌主色', colorIds: ['c1'], harmony: null, sortBy: 'manual', createdAt: 0, updatedAt: 0 }, colors: sampleColors } });
    await act(async () => { findButton('AI 增量提示词').click(); });
    const text = writeTextMock.mock.calls[0][0];
    expect(text).toContain('[[palettes]]');
    expect(text).toContain('weight');
  });
});

describe('ImportModal: paste + confirm', () => {
  it('parses pasted TOML and calls onImport with parse result', async () => {
    const onImport = vi.fn(noopImport);
    await mount({ onImport });
    setTextarea(`[[palettes]]
name = "品牌主色"

[[palettes.colors]]
hex = "#3B82F6"
weight = 60
`);
    const confirm = findButton('确认导入');
    expect(confirm.hasAttribute('disabled')).toBe(false);
    await act(async () => { confirm.click(); });
    expect(onImport).toHaveBeenCalledTimes(1);
    const result = onImport.mock.calls[0][0];
    expect(result.palettes).toHaveLength(1);
    expect(result.palettes[0].name).toBe('品牌主色');
    expect(result.palettes[0].colors[0].weight).toBe(60);
  });

  it('shows parse summary before confirming', async () => {
    await mount();
    setTextarea(`[[palettes]]
name = "A"

[[palettes.colors]]
hex = "#111111"

[[palettes.colors]]
hex = "#222222"
`);
    // 解析预览: 1 个调色板, 2 个颜色
    expect(container.textContent).toContain('1 个调色板');
    expect(container.textContent).toContain('2 个颜色');
  });

  it('disables confirm when TOML has errors (unparseable hex)', async () => {
    await mount();
    setTextarea(`[[palettes]]
name = "A"

[[palettes.colors]]
hex = "garbage"
`);
    expect(container.textContent).toContain('个警告');
    const confirm = findButton('确认导入');
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });

  it('is a real end-to-end parse (validator path)', () => {
    const result = parseColorImportToml(`[[palettes]]
name = "B"

[[palettes.colors]]
hex = "#3b82f6"
weight = 25
note = "小写 hex 应归一化"
`);
    expect(result.errors).toHaveLength(0);
    expect(result.palettes[0].colors[0].hex).toBe('#3B82F6');
    expect(result.palettes[0].colors[0].weight).toBe(25);
  });
});
