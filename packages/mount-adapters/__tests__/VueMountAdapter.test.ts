import type { MountContext } from '@style-library/component-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createShadowRootHost, type ShadowRootHost } from '../src/ShadowRootHost';
import { createVueMountAdapter } from '../src/VueMountAdapter';

const ADAPTER_PORTAL_SELECTOR = 'div:not([data-sl-portal])';
const TEST_THEME: MountContext['theme'] = {
  colorScheme: 'light',
  tokens: {},
  namespace: 'sl',
};

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

  it('clones the same style once into each distinct shadow root', async () => {
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

      const firstClones = Array.from(
        host.shadowRoot.querySelectorAll('style[data-sl-clone]'),
      ).filter((clone) => clone.textContent === style.textContent);
      const secondClones = Array.from(
        secondHost.shadowRoot.querySelectorAll('style[data-sl-clone]'),
      ).filter((clone) => clone.textContent === style.textContent);

      expect(firstClones).toHaveLength(1);
      expect(secondClones).toHaveLength(1);
      expect(firstClones[0]).not.toBe(secondClones[0]);

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
    const clones = Array.from(
      host.shadowRoot.querySelectorAll('style[data-sl-clone]'),
    ).filter((clone) => clone.textContent === style.textContent);

    expect(clones).toHaveLength(1);

    firstMounted.unmount();
    secondMounted.unmount();
  });
});
