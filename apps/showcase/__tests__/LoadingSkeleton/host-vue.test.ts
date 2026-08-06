// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LoadingSkeleton from '../../src/shared/LoadingSkeleton/host-vue.vue';
import type { LoadingSkeletonRef } from '../../src/shared/LoadingSkeleton/host-react';

// host-vue.vue —— Vue 3 SFC,通过 defineExpose 暴露 handle。
// 验证:appear/fadeOut/destroy 都对 root 起作用,根节点 opacity 反映 visible,
// 0.6s ease inline style 注入到根。和 skeleton.ts 共享相同 transitionend 兜底逻辑。

function makeHandle(wrapper: ReturnType<typeof mount>): LoadingSkeletonRef {
  const handle = wrapper.vm as unknown as LoadingSkeletonRef;
  if (!handle.appear) throw new Error('LoadingSkeleton did not defineExpose');
  return handle;
}

async function flushOnce(): Promise<void> {
  // 一帧后调度 transitionend —— 微任务让 wrapper.vm 把 :style 应用到 DOM
  await Promise.resolve();
}

describe('host-vue.vue', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
    vi.useRealTimers();
  });

  it('mount 渲染根 div + spinner/text/bars', () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const el = wrapper.element as HTMLDivElement;
    expect(root.contains(el)).toBe(true);
    // 顶层 3 子节点:spinner / text / bars-wrapper
    expect(el.children.length).toBe(3);
    expect(el.children[0]?.classList.contains('sl-skel__spinner')).toBe(true);
    expect(el.children[1]?.classList.contains('sl-skel__text')).toBe(true);
    expect(el.children[2]?.classList.contains('sl-skel__bars')).toBe(true);
    const barsWrapper = el.children[2] as HTMLElement;
    expect(barsWrapper.children[0]?.classList.contains('sl-skel__bar--title')).toBe(true);
    expect(el.getAttribute('role')).toBe('status');
    wrapper.unmount();
  });

  it('appear: opacity 0 → 1,过渡后 root style 反映', async () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const el = wrapper.element as HTMLDivElement;
    const handle = makeHandle(wrapper);

    const p = handle.appear();
    await flushOnce();
    // 模拟 transitionend
    el.dispatchEvent(new Event('transitionend'));
    await vi.advanceTimersByTimeAsync(500);
    await p;

    expect((el.style.opacity || '1') === '1' || el.style.opacity === '1').toBe(true);
    wrapper.unmount();
  });

  it('appear: 兜底 setTimeout 650ms 后强制 resolve', async () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const handle = makeHandle(wrapper);
    const p = handle.appear();
    vi.advanceTimersByTime(650);
    await p;
    wrapper.unmount();
  });

  it('fadeOut: 完成后调 onFaded 并移走 DOM', async () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const el = wrapper.element as HTMLDivElement;
    const handle = makeHandle(wrapper);

    const appearP = handle.appear();
    await flushOnce();
    el.dispatchEvent(new Event('transitionend'));
    await vi.advanceTimersByTimeAsync(500);
    await appearP;

    const onFaded = vi.fn();
    const fadeP = handle.fadeOut(onFaded);
    await flushOnce();
    el.dispatchEvent(new Event('transitionend'));
    await fadeP;

    expect(onFaded).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('destroy: 不抛错,SFC 同步从 DOM 拆走', () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const el = wrapper.element as HTMLDivElement;
    expect(root.contains(el)).toBe(true);
    makeHandle(wrapper).destroy();
    // destroy 直接从父节点移除 wrapper 内部 root
    expect(root.contains(el)).toBe(false);
    wrapper.unmount();
  });

  it('inline transition style 注入到根 style', () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const el = wrapper.element as HTMLDivElement;
    expect(el.style.transition).toContain('opacity');
    expect(el.style.transition).toContain('600ms');
    expect(el.style.transition).toContain('ease');
    wrapper.unmount();
  });

  it('重复 transitionend 不重复 resolve', async () => {
    const wrapper = mount(LoadingSkeleton, { attachTo: root });
    const handle = makeHandle(wrapper);
    const el = wrapper.element as HTMLDivElement;
    const calls: number[] = [];
    handle.appear().then(() => calls.push(1));
    await flushOnce();
    el.dispatchEvent(new Event('transitionend'));
    el.dispatchEvent(new Event('transitionend'));
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toEqual([1]);
    wrapper.unmount();
  });
});
