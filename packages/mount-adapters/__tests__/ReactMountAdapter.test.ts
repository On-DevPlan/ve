import type { MountContext } from '@style-library/component-contract';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactMountAdapter } from '../src/ReactMountAdapter';
import { createShadowRootHost, type ShadowRootHost } from '../src/ShadowRootHost';

const ADAPTER_PORTAL_SELECTOR = 'div:not([data-sl-portal])';
const TEST_THEME: MountContext['theme'] = {
  colorScheme: 'light',
  tokens: {},
  namespace: 'sl',
};

// jsdom 29.1.1:'adoptedStyleSheets' in Document.prototype === false →
// supportsAdopted === false → adoptCssTexts 走 <style data-sl-css> 降级。
// adoptStylesInto 现在收集 document.styleSheets 的 cssRules 文本,jsdom 里
// head 的 <style> 会出现在 document.styleSheets 中,故可在此断言降级节点。
const envSupportsAdopted =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in Document.prototype;

function shadowCssTexts(shadowRoot: ShadowRoot): string[] {
  if (envSupportsAdopted) {
    const texts: string[] = [];
    for (const sheet of shadowRoot.adoptedStyleSheets) {
      for (const rule of Array.from(sheet.cssRules)) texts.push(rule.cssText);
    }
    return texts;
  }
  return Array.from(shadowRoot.querySelectorAll('style[data-sl-css]')).map(
    (el) => el.textContent ?? '',
  );
}

interface ReactFixtureProps {
  message?: unknown;
}

function ReactFixture({ message = '' }: ReactFixtureProps) {
  return createElement('span', { 'data-testid': 'react-message' }, String(message));
}

describe('ReactMountAdapter', () => {
  let container: HTMLDivElement;
  let host: ShadowRootHost;
  let abortController: AbortController;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    host = createShadowRootHost({ container });
    abortController = new AbortController();
  });

  afterEach(() => {
    abortController.abort();
    container.remove();
    document.head.querySelectorAll('style[data-react-adapter-test]').forEach((style) => style.remove());
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function createContext(overrides: Partial<MountContext> = {}): MountContext {
    return {
      container,
      shadowRoot: host.shadowRoot,
      props: { message: 'Hello React' },
      theme: TEST_THEME,
      signal: abortController.signal,
      ...overrides,
    };
  }

  it('handles the react framework', () => {
    expect(createReactMountAdapter().canHandle('react')).toBe(true);
  });

  it('does not handle the vue framework', () => {
    expect(createReactMountAdapter().canHandle('vue')).toBe(false);
  });

  it('mount returns a MountedComponent handle with update', async () => {
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    await act(async () => {
      mounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });

    expect(mounted!).toBeDefined();
    expect(mounted!.update).toEqual(expect.any(Function));
    expect(mounted!.unmount).toEqual(expect.any(Function));

    await act(async () => {
      mounted!.unmount();
    });
  });

  it('re-renders portal content when update receives new props', async () => {
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    await act(async () => {
      mounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });
    const message = host.shadowRoot.querySelector('[data-testid="react-message"]');
    expect(message?.textContent).toBe('Hello React');

    await act(async () => {
      await mounted!.update?.({ message: 'Updated React' });
    });

    expect(host.shadowRoot.querySelector('[data-testid="react-message"]')?.textContent).toBe(
      'Updated React',
    );

    await act(async () => {
      mounted!.unmount();
    });
  });

  it('throws when module.default is missing', async () => {
    await expect(createReactMountAdapter().mount({}, createContext())).rejects.toThrow(
      'ReactMountAdapter: module.default is missing',
    );
  });

  it('appends a portal div to the shadow root and clears it when unmounted', async () => {
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    await act(async () => {
      mounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });
    const portal = host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR);

    expect(portal).toBeInstanceOf(HTMLDivElement);
    expect(portal?.parentNode).toBe(host.shadowRoot);
    expect(portal?.querySelector('[data-testid="react-message"]')?.textContent).toBe(
      'Hello React',
    );

    await act(async () => {
      mounted!.unmount();
    });

    expect(portal?.childElementCount).toBe(0);
  });

  it('unmounts automatically when the AbortSignal aborts', async () => {
    await act(async () => {
      await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });
    const portal = host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR);
    const renderedElement = portal?.querySelector('[data-testid="react-message"]') ?? null;

    await act(async () => {
      abortController.abort();
    });

    expect(renderedElement?.isConnected).toBe(false);
    expect(host.shadowRoot.querySelector('[data-testid="react-message"]')).toBeNull();
  });

  it('adopts the same style once into each distinct shadow root', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-react-adapter-test', '');
    style.textContent = '.react-adapter-test { color: tomato; }';
    document.head.appendChild(style);

    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const secondHost = createShadowRootHost({ container: secondContainer });
    const secondAbortController = new AbortController();
    let firstMounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;
    let secondMounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    try {
      await act(async () => {
        firstMounted = await createReactMountAdapter().mount(
          { default: ReactFixture },
          createContext(),
        );
        secondMounted = await createReactMountAdapter().mount(
          { default: ReactFixture },
          createContext({
            container: secondContainer,
            shadowRoot: secondHost.shadowRoot,
            signal: secondAbortController.signal,
          }),
        );
      });

      // ensureCss(无 cssReady)→ adoptStylesInto 收集 document.styleSheets → adoptCssTexts。
      // 每个 shadowRoot 各自落一份(adopted:各自持有同一 sheet;降级:各自一个 style 节点)。
      const firstTexts = shadowCssTexts(host.shadowRoot);
      const secondTexts = shadowCssTexts(secondHost.shadowRoot);
      expect(firstTexts.filter((t) => t.includes('.react-adapter-test'))).toHaveLength(1);
      expect(secondTexts.filter((t) => t.includes('.react-adapter-test'))).toHaveLength(1);

      await act(async () => {
        firstMounted!.unmount();
        secondMounted!.unmount();
      });
    } finally {
      secondContainer.remove();
    }
  });

  it('does not duplicate a style across repeated mounts in one shadow root', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-react-adapter-test', '');
    style.textContent = '.react-adapter-dedup-test { color: rebeccapurple; }';
    document.head.appendChild(style);
    let firstMounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;
    let secondMounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    await act(async () => {
      firstMounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
      secondMounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });
    const texts = shadowCssTexts(host.shadowRoot);
    expect(texts.filter((t) => t.includes('.react-adapter-dedup-test'))).toHaveLength(1);

    await act(async () => {
      firstMounted!.unmount();
      secondMounted!.unmount();
    });
  });

  it('mount succeeds even when cssReady rejects (degraded, no white screen)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;
    try {
      await act(async () => {
        mounted = await createReactMountAdapter().mount(
          { default: ReactFixture },
          createContext({ cssReady: Promise.reject(new Error('css-boom')) }),
        );
      });
      // ensureCss 吞掉 reject → mount 继续,组件照常渲染(无样式降级)
      expect(host.shadowRoot.querySelector('[data-testid="react-message"]')?.textContent).toBe(
        'Hello React',
      );
      await act(async () => {
        mounted!.unmount();
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('allows unmount to be called repeatedly without throwing', async () => {
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;

    await act(async () => {
      mounted = await createReactMountAdapter().mount(
        { default: ReactFixture },
        createContext(),
      );
    });

    await expect(
      act(async () => {
        mounted!.unmount();
        mounted!.unmount();
      }),
    ).resolves.toBeUndefined();
  });

  it('waits for cssReady before rendering the portal', async () => {
    let resolveCss!: () => void;
    const cssReady = new Promise<void>((r) => { resolveCss = r; });
    const mountPromise = createReactMountAdapter().mount(
      { default: ReactFixture },
      createContext({ cssReady }),
    );
    // cssReady 未 resolve:mount 应卡在 await,portal 未创建
    await Promise.resolve();
    await Promise.resolve();
    expect(host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR)).toBeNull();
    // resolve 后 portal 出现
    resolveCss();
    let mounted: Awaited<ReturnType<ReturnType<typeof createReactMountAdapter>['mount']>>;
    await act(async () => {
      mounted = await mountPromise;
    });
    expect(host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR)).not.toBeNull();
    await act(async () => {
      mounted!.unmount();
    });
  });
});
