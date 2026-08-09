// @vitest-environment jsdom
// ImportModal 「AI 增量提示词」按钮:
//   - 存在性 + disabled 行为(无 selectedGroupName 时)
//   - 点击 → 写入剪贴板(含 FORMAT_PROMPT 原文 + 当前组 combo 清单 + 避冲突指令)
//   - 剪贴板内容应能驱动下游 LLM 生成"不与已存在 combo 冲突"的 TOML

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
import ImportModal from '../src/shortcut-library/src/pages/ImportModal';
import type { Shortcut } from '../src/shortcut-library/src/types';

const CSS = readFileSync(
  resolve(__dirname, '../src/shortcut-library/index.css'),
  'utf8',
);

// mock clipboard
const writeTextMock = vi.fn(async () => {});
Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

let container: HTMLDivElement;
let root: Root;
let styleNode: HTMLStyleElement;
const noopImport = () => ({ groupsAdded: 0, groupsAppended: 0, shortcutsAdded: 0, errors: [] });

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
  groupName?: string;
  shortcuts?: Shortcut[];
}

async function mount(opts: MountOpts = {}): Promise<void> {
  await act(async () => {
    root.render(
      <ImportModal
        onImport={noopImport}
        onClose={() => {}}
        selectedGroupName={opts.groupName}
        selectedGroupShortcuts={opts.shortcuts ?? []}
      />,
    );
  });
}

describe('ImportModal: AI incremental prompt button', () => {
  it('renders the AI incremental prompt button', async () => {
    await mount({ groupName: 'VSCode' });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement | undefined;
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(false);
  });

  it('disables the button when no selectedGroupName is provided', async () => {
    await mount({});
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement | undefined;
    expect(btn).toBeDefined();
    expect(btn!.disabled).toBe(true);
  });

  it('clicking copies a prompt containing FORMAT_PROMPT verbatim', async () => {
    await mount({ groupName: 'VSCode' });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement;
    await act(async () => { btn.click(); });
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const text = writeTextMock.mock.calls[0][0];
    // 必须包含 FORMAT_PROMPT 的关键标识(用段落标题做 fingerprint,避免依赖整个字面量)
    expect(text).toContain('格式规范');
    expect(text).toContain('字段表');
    expect(text).toContain('[[groups]]');
  });

  it('prompt contains the current group name as context', async () => {
    await mount({ groupName: 'VSCode' });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement;
    await act(async () => { btn.click(); });
    const text = writeTextMock.mock.calls[0][0];
    expect(text).toContain('VSCode');
  });

  it('prompt enumerates existing combos (avoid-collision context)', async () => {
    // 给 3 条 shortcut,期望 prompt 列出它们的 combo key
    const shortcuts: Shortcut[] = [
      {
        id: 's1', createdAt: 0,
        combo: [
          { code: 'ControlLeft', label: 'Ctrl', isModifier: true },
          { code: 'KeyC', label: 'C', isModifier: false },
        ],
        description: 'copy',
      },
      {
        id: 's2', createdAt: 0,
        combo: [
          { code: 'ControlLeft', label: 'Ctrl', isModifier: true },
          { code: 'KeyV', label: 'V', isModifier: false },
        ],
        description: 'paste',
      },
      {
        id: 's3', createdAt: 0,
        combo: [{ code: 'KeyA', label: 'A', isModifier: false }],
        description: 'select-all',
      },
    ];
    await mount({ groupName: 'VSCode', shortcuts });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement;
    await act(async () => { btn.click(); });
    const text = writeTextMock.mock.calls[0][0];
    // combo key 由 code 序列拼接(comboKey 函数签名)
    expect(text).toMatch(/ControlLeft\+KeyC/);
    expect(text).toMatch(/ControlLeft\+KeyV/);
    expect(text).toMatch(/KeyA/);
  });

  it('prompt contains explicit avoid-collision instruction', async () => {
    await mount({
      groupName: 'VSCode',
      shortcuts: [{
        id: 's1', createdAt: 0,
        combo: [{ code: 'ControlLeft', label: 'Ctrl', isModifier: true }, { code: 'KeyC', label: 'C', isModifier: false }],
        description: 'copy',
      }],
    });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement;
    await act(async () => { btn.click(); });
    const text = writeTextMock.mock.calls[0][0];
    // 避冲突指令必须明确(中英文都接受,但语义要清晰)
    expect(text).toMatch(/(避开|不要|avoid)/i);
    expect(text).toMatch(/(冲突|重复|collision|duplicate)/i);
  });

  it('clicking shows "已复制" feedback', async () => {
    await mount({ groupName: 'VSCode' });
    const btn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词')) as HTMLElement;
    await act(async () => { btn.click(); });
    expect(btn.textContent).toContain('已复制');
  });

  it('coexists with the original "复制格式提示词" button', async () => {
    await mount({ groupName: 'VSCode' });
    const formatBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('复制格式提示词') || b.textContent?.includes('已复制'));
    const aiBtn = Array.from(container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('AI 增量提示词'));
    expect(formatBtn).toBeDefined();
    expect(aiBtn).toBeDefined();
  });
});