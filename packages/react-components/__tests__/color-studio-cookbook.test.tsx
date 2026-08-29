// @vitest-environment jsdom
// Color Studio CookbookPage(全屏覆盖文档页):
//   - 渲染三章:色彩基础 / 锚色与和声 / 滤镜
//   - 章节导航可切换
//   - 关闭按钮触发 onClose

// @ts-expect-error - React exposes this global to test runners.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CookbookPage } from '../src/color-studio/src/components/CookbookPage';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(open = true, onClose = () => {}) {
  act(() => {
    root.render(<CookbookPage open={open} onClose={onClose} />);
  });
}

describe('CookbookPage', () => {
  it('open=false 时不渲染', () => {
    mount(false);
    expect(container.querySelector('.sl-cs-cookbook')).toBeNull();
  });

  it('渲染三章章节导航', () => {
    mount();
    const nav = container.querySelector('.sl-cs-cookbook__nav');
    expect(nav).not.toBeNull();
    const items = Array.from(nav!.querySelectorAll('button')).map((b) => b.textContent);
    expect(items.some((t) => t?.includes('色彩基础'))).toBe(true);
    expect(items.some((t) => t?.includes('锚色与和声'))).toBe(true);
    expect(items.some((t) => t?.includes('滤镜'))).toBe(true);
  });

  it('默认显示第一章;点导航切到滤镜章', () => {
    mount();
    const body = container.querySelector('.sl-cs-cookbook__body')!;
    expect(body.textContent).toContain('色相');
    const filterNavBtn = Array.from(
      container.querySelectorAll('.sl-cs-cookbook__nav button'),
    ).find((b) => b.textContent?.includes('滤镜'))!;
    act(() => {
      filterNavBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.sl-cs-cookbook__body')!.textContent).toContain('brightness');
  });

  it('和声章覆盖 5 种规则与场景建议', () => {
    mount();
    const harmonyNavBtn = Array.from(
      container.querySelectorAll('.sl-cs-cookbook__nav button'),
    ).find((b) => b.textContent?.includes('锚色与和声'))!;
    act(() => {
      harmonyNavBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const text = container.querySelector('.sl-cs-cookbook__body')!.textContent!;
    for (const kw of ['互补', '三角', '类似', '分裂互补', '单色', '锚色']) {
      expect(text).toContain(kw);
    }
  });

  it('滤镜章覆盖 7 种滤镜参数', () => {
    mount();
    const filterNavBtn = Array.from(
      container.querySelectorAll('.sl-cs-cookbook__nav button'),
    ).find((b) => b.textContent?.includes('滤镜'))!;
    act(() => {
      filterNavBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const text = container.querySelector('.sl-cs-cookbook__body')!.textContent!;
    for (const kw of ['brightness', 'contrast', 'saturate', 'hue-rotate', 'grayscale', 'sepia', 'invert']) {
      expect(text).toContain(kw);
    }
  });

  it('关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    mount(true, onClose);
    const closeBtn = container.querySelector('.sl-cs-cookbook__close') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
