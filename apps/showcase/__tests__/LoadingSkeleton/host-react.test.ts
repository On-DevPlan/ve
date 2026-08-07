// @vitest-environment jsdom
// @ts-expect-error - React exposes IS_REACT_ACT_ENVIRONMENT for act() support.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import * as React from 'react';
import { LoadingSkeleton } from '../../src/shared/LoadingSkeleton/host-react';
import type { LoadingSkeletonRef } from '../../src/shared/LoadingSkeleton/host-react';

// host-react.tsx —— forwardRef 组件暴露 LoadingSkeletonRef。
// React 测试不直接用 JSX,改用 React.createElement 避开 .test.ts 含 JSX 的边界
// (showcase workspace include 是 `*.test.ts`,不接 .tsx)。
// 验证 handle 在 act() 内 await 后,root 的 style.opacity 已经更新 + 节点从 DOM 移除。

describe('host-react', () => {
  let host: HTMLDivElement;
  let root: Root;
  let ref: React.RefObject<LoadingSkeletonRef | null>;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    ref = React.createRef<LoadingSkeletonRef>();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(host);
    vi.useRealTimers();
  });

  function renderWithSkeleton(): HTMLDivElement {
    let captured: HTMLDivElement | null = null;
    act(() => {
      root.render(
        React.createElement(
          'div',
          null,
          React.createElement(LoadingSkeleton, { className: 'sl-skel-test', ref }),
          React.createElement('div', {
            ref: (el: HTMLDivElement | null) => {
              captured = el;
            },
          }),
        ),
      );
    });
    // root 渲染完成后 captured 是 sibling div,skeleton root 在它前面
    const inner = host.querySelector('.sl-skel-test') as HTMLDivElement;
    expect(inner).toBeTruthy();
    expect(captured).toBeTruthy();
    return inner;
  }

  async function flush(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('mount 渲染根 div + spinner/text/bars', () => {
    const el = renderWithSkeleton();
    // 顶层 3 子节点:spinner / text / bars-wrapper
    expect(el.children.length).toBe(3);
    expect(el.children[0]?.classList.contains('sl-skel__spinner')).toBe(true);
    expect(el.children[1]?.classList.contains('sl-skel__text')).toBe(true);
    expect(el.children[2]?.classList.contains('sl-skel__bars')).toBe(true);
    const barsWrapper = el.children[2] as HTMLElement;
    expect(barsWrapper.children[0]?.classList.contains('sl-skel__bar--title')).toBe(true);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('appear: opacity 0 → 1', async () => {
    const el = renderWithSkeleton();
    expect(ref.current).toBeTruthy();
    let done = false;
    const p = ref.current!.appear().then(() => {
      done = true;
    });
    await flush();
    act(() => {
      el.dispatchEvent(new Event('transitionend'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await p;
    });
    expect(done).toBe(true);
    expect(el.style.opacity).toBe('1');
  });

  it('appear: 650ms 兜底 setTimeout 强制 resolve', async () => {
    renderWithSkeleton();
    const p = ref.current!.appear();
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => {
      await p;
    });
    expect(ref.current).toBeTruthy();
  });

  it('fadeOut: 完成后 onFaded 并从 DOM 移除', async () => {
    const el = renderWithSkeleton();
    const appearP = ref.current!.appear();
    await flush();
    act(() => {
      el.dispatchEvent(new Event('transitionend'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await appearP;
    });

    const onFaded = vi.fn();
    const fadeP = ref.current!.fadeOut(onFaded);
    await flush();
    act(() => {
      el.dispatchEvent(new Event('transitionend'));
    });
    await act(async () => {
      await fadeP;
    });

    expect(onFaded).toHaveBeenCalledTimes(1);
    expect(host.contains(el)).toBe(false);
  });

  it('destroy: 立即从 DOM 拆走', () => {
    const el = renderWithSkeleton();
    expect(host.contains(el)).toBe(true);
    act(() => {
      ref.current!.destroy();
    });
    expect(host.contains(el)).toBe(false);
  });

  it('transition inline style: opacity 600ms ease', () => {
    const el = renderWithSkeleton();
    expect(el.style.transition).toContain('opacity');
    expect(el.style.transition).toContain('600ms');
    expect(el.style.transition).toContain('ease');
  });

  it('重复 transitionend 不重复 resolve', async () => {
    const el = renderWithSkeleton();
    let calls = 0;
    const p = ref.current!.appear().then(() => {
      calls++;
    });
    await flush();
    act(() => {
      el.dispatchEvent(new Event('transitionend'));
      el.dispatchEvent(new Event('transitionend'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await p;
    });
    expect(calls).toBe(1);
  });
});
