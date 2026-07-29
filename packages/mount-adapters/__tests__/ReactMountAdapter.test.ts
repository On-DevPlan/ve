import type { MountContext } from '@style-library/component-contract';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReactMountAdapter } from '../src/ReactMountAdapter';
import { createShadowRootHost, type ShadowRootHost } from '../src/ShadowRootHost';

const ADAPTER_PORTAL_SELECTOR = 'div:not([data-sl-portal])';
const TEST_THEME: MountContext['theme'] = {
  colorScheme: 'light',
  tokens: {},
  namespace: 'sl',
};

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

  it('clones the same style once into each distinct shadow root', async () => {
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

      const firstClones = Array.from(
        host.shadowRoot.querySelectorAll('style[data-sl-clone]'),
      ).filter((clone) => clone.textContent === style.textContent);
      const secondClones = Array.from(
        secondHost.shadowRoot.querySelectorAll('style[data-sl-clone]'),
      ).filter((clone) => clone.textContent === style.textContent);

      expect(firstClones).toHaveLength(1);
      expect(secondClones).toHaveLength(1);
      expect(firstClones[0]).not.toBe(secondClones[0]);

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
    const clones = Array.from(
      host.shadowRoot.querySelectorAll('style[data-sl-clone]'),
    ).filter((clone) => clone.textContent === style.textContent);

    expect(clones).toHaveLength(1);

    await act(async () => {
      firstMounted!.unmount();
      secondMounted!.unmount();
    });
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
});
