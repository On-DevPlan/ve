// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLoadingSkeleton } from '../../src/shared/LoadingSkeleton/skeleton';

// skeleton.ts 关键时序:0.6s ease opacity transition,appear 至少 500ms。
// 用 fake timer + fire transitionend 手动驱动 —— 解决 jsdom 的两条限制:
//   1) transitionend 不自动派发
//   2) layout 不真实 → opacity 变化不"真的"触发过渡
// 测试集中验证 setOpacity 注册的 transitionend listener + 兜底 setTimeout
// 落地逻辑,以及连续 appear/fadeOut 不叠加(root reflow 在第二次生效)。

describe('createLoadingSkeleton', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  it('prepends root with spinner + text + bars wrapper, role=status', () => {
    const skel = createLoadingSkeleton(container);
    expect(container.firstElementChild).toBe(skel.root);
    expect(skel.root.classList.contains('sl-skel')).toBe(true);
    expect(skel.root.getAttribute('role')).toBe('status');
    expect(skel.root.getAttribute('aria-live')).toBe('polite');
    // 顶层 3 个子节点:spinner / text / bars-wrapper
    expect(skel.root.children.length).toBe(3);
    expect(skel.root.children[0]?.classList.contains('sl-skel__spinner')).toBe(true);
    expect(skel.root.children[1]?.classList.contains('sl-skel__text')).toBe(true);
    expect(skel.root.children[2]?.classList.contains('sl-skel__bars')).toBe(true);
    // bars-wrapper 内 3 根占位 bar
    const barsWrapper = skel.root.children[2] as HTMLElement;
    expect(barsWrapper.children.length).toBe(3);
    expect(barsWrapper.children[0]?.classList.contains('sl-skel__bar--title')).toBe(true);
  });

  it('appears: opacity 0 → 1 on transitionend', async () => {
    const skel = createLoadingSkeleton(container);
    expect(skel.root.style.opacity).toBe('0');

    const p = skel.appear();
    // 异步推 transitionend → 模拟浏览器在过渡结束时派发的事件
    queueMicrotask(() => {
      skel.root.dispatchEvent(new Event('transitionend'));
    });
    // appear 至少 500ms,需要跑时间
    await vi.advanceTimersByTimeAsync(500);
    await p;
    expect(skel.root.style.opacity).toBe('1');
  });

  it('appears: 兜底 setTimeout 在 650ms 后强制 resolve(transitionend 不派发)', async () => {
    const skel = createLoadingSkeleton(container);
    const p = skel.appear();
    // 不 fire transitionend,只跑时间 —— 兜底在 FADE_MS+50=650ms 触发
    // 且 appear 最小 500ms 由 minVisible setTimeout 保证,综合 resolve 时间仍 ≈ 650ms
    vi.advanceTimersByTime(650);
    await p;
    expect(skel.root.style.opacity).toBe('1');
  });

  it('appear: 即使组件瞬时 ready 也至少展示 500ms', async () => {
    const skel = createLoadingSkeleton(container);
    const start = Date.now();
    const p = skel.appear();
    // 立刻派发 transitionend,模拟 ready 极快
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    // 跑 500ms —— 此时 minVisible setTimeout 应已触发
    await vi.advanceTimersByTimeAsync(500);
    await p;
    // 已经 resolve(因为 minVisible 在 500ms 已过 + transitionend 已触发)
    expect(skel.root.style.opacity).toBe('1');
    // start/end 主要验证行为而非墙钟(Date.now 在 fake timer 下不走)
    void start;
  });

  it('appear: 500ms 内调用 resolve 不能提前完成', async () => {
    const skel = createLoadingSkeleton(container);
    let settled = false;
    const p = skel.appear().then(() => {
      settled = true;
    });
    // 立刻派发 transitionend
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    // 跑 400ms —— 还没到 500ms
    await vi.advanceTimersByTimeAsync(400);
    expect(settled).toBe(false);
    // 再跑 200ms → 到 600ms,minVisible 500ms 已过
    await vi.advanceTimersByTimeAsync(200);
    expect(settled).toBe(true);
    await p;
  });

  it('fadeOut: 1 → 0,完成后从 DOM 移除并回调 onFaded', async () => {
    const skel = createLoadingSkeleton(container);
    // 先 appear(同步 setOpacity 0→1,模拟 transitionend 让它 settle)
    const appearP = skel.appear();
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    await vi.advanceTimersByTimeAsync(500);
    await appearP;

    const onFaded = vi.fn();
    const fadeP = skel.fadeOut(onFaded);
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    await fadeP;

    expect(onFaded).toHaveBeenCalledTimes(1);
    expect(container.contains(skel.root)).toBe(false);
  });

  it('destroy: 立即移除 DOM(无动画)', () => {
    const skel = createLoadingSkeleton(container);
    expect(container.contains(skel.root)).toBe(true);
    skel.destroy();
    expect(container.contains(skel.root)).toBe(false);
    // 幂等 —— 再调一次不抛错
    expect(() => skel.destroy()).not.toThrow();
  });

  it('appear 之后 destroy → 后续 appear/fadeOut 是 no-op', async () => {
    const skel = createLoadingSkeleton(container);
    skel.destroy();
    await expect(skel.appear()).resolves.toBeUndefined();
    await expect(skel.fadeOut()).resolves.toBeUndefined();
  });

  it('连续 appear / fadeOut 不叠加 reflow(第二次 transitionend 重置生效)', async () => {
    const skel = createLoadingSkeleton(container);
    const appearP = skel.appear();
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    await vi.advanceTimersByTimeAsync(500);
    await appearP;

    const fadeP = skel.fadeOut();
    queueMicrotask(() => skel.root.dispatchEvent(new Event('transitionend')));
    await fadeP;

    expect(skel.root.style.opacity).toBe('0');
    expect(container.contains(skel.root)).toBe(false);
  });

  it('themeTokens 写到 root.style', () => {
    const skel = createLoadingSkeleton(container, {
      themeTokens: { '--sl-color-border': '#abc', '--sl-radius-md': '4px' },
    });
    expect(skel.root.style.getPropertyValue('--sl-color-border')).toBe('#abc');
    expect(skel.root.style.getPropertyValue('--sl-radius-md')).toBe('4px');
  });

  it('className 选项覆盖默认 sl-skel', () => {
    const skel = createLoadingSkeleton(container, { className: 'my-skel' });
    expect(skel.root.classList.contains('my-skel')).toBe(true);
    expect(skel.root.classList.contains('sl-skel')).toBe(false);
  });

  it('fired transitionend 不会重复 resolve(setOpacity listener 注销)', async () => {
    const skel = createLoadingSkeleton(container);
    const calls: number[] = [];
    skel.appear().then(() => calls.push(1));
    // 派发两次 transitionend —— 不应 resolve 两次
    queueMicrotask(() => {
      skel.root.dispatchEvent(new Event('transitionend'));
      skel.root.dispatchEvent(new Event('transitionend'));
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toEqual([1]);
  });
});
