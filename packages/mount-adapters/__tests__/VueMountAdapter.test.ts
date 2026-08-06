import type { MountContext } from '@style-library/component-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createShadowRootHost, type ShadowRootHost } from '../src/ShadowRootHost';
import { createVueMountAdapter } from '../src/VueMountAdapter';

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

const VueFixture = defineComponent({
  props: {
    message: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', { 'data-testid': 'vue-message' }, props.message);
  },
});

describe('VueMountAdapter', () => {
  let container: HTMLDivElement;
  let host: ShadowRootHost;
  let abortController: AbortController;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    host = createShadowRootHost({ container });
    abortController = new AbortController();
  });

  afterEach(() => {
    abortController.abort();
    container.remove();
    document.head.querySelectorAll('style[data-vue-adapter-test]').forEach((style) => style.remove());
  });

  function createContext(overrides: Partial<MountContext> = {}): MountContext {
    return {
      container,
      shadowRoot: host.shadowRoot,
      props: { message: 'Hello Vue' },
      theme: TEST_THEME,
      signal: abortController.signal,
      ...overrides,
    };
  }

  it('handles the vue framework', () => {
    expect(createVueMountAdapter().canHandle('vue')).toBe(true);
  });

  it('does not handle the react framework', () => {
    expect(createVueMountAdapter().canHandle('react')).toBe(false);
  });

  it('mount returns a MountedComponent handle', async () => {
    const mounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );

    expect(mounted).toBeDefined();
    expect(mounted.unmount).toEqual(expect.any(Function));

    mounted.unmount();
  });

  it('throws when module.default is missing', async () => {
    await expect(createVueMountAdapter().mount({}, createContext())).rejects.toThrow(
      'VueMountAdapter: module.default is missing',
    );
  });

  it('appends a portal div to the shadow root when mounted', async () => {
    const mounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );
    const portal = host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR);

    expect(portal).toBeInstanceOf(HTMLDivElement);
    expect(portal?.parentNode).toBe(host.shadowRoot);
    expect(portal?.querySelector('[data-testid="vue-message"]')?.textContent).toBe('Hello Vue');

    mounted.unmount();
  });

  it('removes rendered portal content when unmounted', async () => {
    const mounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );
    const portal = host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR);

    mounted.unmount();

    expect(portal?.childElementCount).toBe(0);
    expect(portal?.parentNode).toBe(host.shadowRoot);
  });

  it('unmounts automatically when the AbortSignal aborts', async () => {
    const mounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );
    const renderedElement = host.shadowRoot.querySelector('[data-testid="vue-message"]');

    abortController.abort();

    expect(renderedElement?.isConnected).toBe(false);
    expect(host.shadowRoot.querySelector('[data-testid="vue-message"]')).toBeNull();

    mounted.unmount();
  });

  it('adopts the same style once into each distinct shadow root', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-vue-adapter-test', '');
    style.textContent = '.vue-adapter-test { color: tomato; }';
    document.head.appendChild(style);

    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const secondHost = createShadowRootHost({ container: secondContainer });
    const secondAbortController = new AbortController();

    try {
      const firstMounted = await createVueMountAdapter().mount(
        { default: VueFixture },
        createContext(),
      );
      const secondMounted = await createVueMountAdapter().mount(
        { default: VueFixture },
        createContext({
          container: secondContainer,
          shadowRoot: secondHost.shadowRoot,
          signal: secondAbortController.signal,
        }),
      );

      // ensureCss(无 cssReady)→ adoptStylesInto 收集 document.styleSheets → adoptCssTexts。
      // 每个 shadowRoot 各自落一份(adopted:各自持有同一 sheet;降级:各自一个 style 节点)。
      const firstTexts = shadowCssTexts(host.shadowRoot);
      const secondTexts = shadowCssTexts(secondHost.shadowRoot);
      expect(firstTexts.filter((t) => t.includes('.vue-adapter-test'))).toHaveLength(1);
      expect(secondTexts.filter((t) => t.includes('.vue-adapter-test'))).toHaveLength(1);

      firstMounted.unmount();
      secondMounted.unmount();
    } finally {
      secondContainer.remove();
    }
  });

  it('does not duplicate a style across repeated mounts in one shadow root', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-vue-adapter-test', '');
    style.textContent = '.vue-adapter-dedup-test { color: rebeccapurple; }';
    document.head.appendChild(style);

    const firstMounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );
    const secondMounted = await createVueMountAdapter().mount(
      { default: VueFixture },
      createContext(),
    );
    const texts = shadowCssTexts(host.shadowRoot);
    expect(texts.filter((t) => t.includes('.vue-adapter-dedup-test'))).toHaveLength(1);

    firstMounted.unmount();
    secondMounted.unmount();
  });

  it('mount succeeds even when cssReady rejects (degraded, no white screen)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const mounted = await createVueMountAdapter().mount(
        { default: VueFixture },
        createContext({ cssReady: Promise.reject(new Error('css-boom')) }),
      );
      // ensureCss 吞掉 reject → mount 继续,组件照常渲染(无样式降级)
      expect(host.shadowRoot.querySelector('[data-testid="vue-message"]')?.textContent).toBe(
        'Hello Vue',
      );
      mounted.unmount();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('waits for cssReady before mounting', async () => {
    let resolveCss!: () => void;
    const cssReady = new Promise<void>((r) => { resolveCss = r; });
    const mountPromise = createVueMountAdapter().mount(
      { default: VueFixture },
      createContext({ cssReady }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR)).toBeNull();
    resolveCss();
    const mounted = await mountPromise;
    expect(host.shadowRoot.querySelector(ADAPTER_PORTAL_SELECTOR)).not.toBeNull();
    mounted.unmount();
  });
});
