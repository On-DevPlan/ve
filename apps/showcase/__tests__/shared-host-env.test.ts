// shared-host-env.test.ts —— host-env 策略的单元测试。
//
// 最关键的回归项是第 3 个用例：**两个不同的 shadow root 必须各自都拿到样式**。
//
// 如果去重做成模块级 Set（照抄 lightEnv 的写法），第二次挂载到新建的 shadow root
// 时会静默不注入 —— 而 DetailPage 每次进详情页都是**新建**一个 shadow root、
// 离开时 destroy()。所以这个 bug 的表现是「进 A → 返回 → 再进 A，样式没了」，
// 首次开发几乎不可能发现。这条测试就是为了把它钉死。

import { describe, expect, it } from 'vitest';
import { createHostEnvs, selectHostEnv } from '@/shared/components/runtime/host-env';

const CSS_LIGHT = '.host-env-probe-light { color: rgb(1, 2, 3); }';
const CSS_SHADOW_A = '.host-env-probe-shadow-a { color: rgb(4, 5, 6); }';
const CSS_SHADOW_B = '.host-env-probe-shadow-b { color: rgb(7, 8, 9); }';
// detachedEnv 与 lightEnv 共用 document 级去重，所以必须用一份没被别处注过的文本，
// 否则断言会被前面的用例「先注过」影响。
const CSS_DETACHED = '.host-env-probe-detached { color: rgb(10, 11, 12); }';

function makeLightAnchor(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/**
 * 构造「尚未接入文档」的 anchor —— 真实来源：@vue/test-utils 的 mount() 默认把组件
 * 挂到游离 div 上；离屏渲染 / 导出截图同理。此时 getRootNode() 返回游离根，
 * 既不是 document 也不是 ShadowRoot。
 */
function makeDetachedAnchor(): HTMLElement {
  const el = document.createElement('div');
  return el;
}

function makeShadowAnchor(): { anchor: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  const anchor = document.createElement('div');
  root.appendChild(anchor);
  return { anchor, root };
}

/**
 * 判断某段 CSS 是否已落到该 shadow root。
 * adoptCssTexts 优先走 adoptedStyleSheets，环境不支持时降级 <style data-sl-css>，
 * 两种路径都要认。jsdom 的 adoptedStyleSheets 可能是 undefined，用 ?? [] 兜住。
 */
function shadowHasCss(root: ShadowRoot, marker: string): boolean {
  const sheets = root.adoptedStyleSheets ?? [];
  const viaSheets = sheets.some((sheet) => {
    try {
      return [...sheet.cssRules].some((rule) => rule.cssText.includes(marker));
    } catch {
      return false;
    }
  });
  if (viaSheets) return true;
  return [...root.querySelectorAll('style')].some((el) =>
    (el.textContent ?? '').includes(marker),
  );
}

describe('selectHostEnv', () => {
  it('Light DOM 的 anchor 命中 lightEnv', () => {
    const anchor = makeLightAnchor();
    expect(selectHostEnv(createHostEnvs(), anchor).name).toBe('light');
  });

  it('ShadowRoot 内的 anchor 命中 shadowEnv', () => {
    const { anchor } = makeShadowAnchor();
    expect(selectHostEnv(createHostEnvs(), anchor).name).toBe('shadow');
  });

  it('尚未接入文档的 anchor 命中 detachedEnv（修复前这里直接抛错）', () => {
    const anchor = makeDetachedAnchor();
    expect(selectHostEnv(createHostEnvs(), anchor).name).toBe('detached');
  });

  it('三个策略的 canHandle 两两互斥', () => {
    const envs = createHostEnvs();
    const light = makeLightAnchor();
    const { anchor: shadow } = makeShadowAnchor();
    const detached = makeDetachedAnchor();
    expect(envs.filter((e) => e.canHandle(light))).toHaveLength(1);
    expect(envs.filter((e) => e.canHandle(shadow))).toHaveLength(1);
    expect(envs.filter((e) => e.canHandle(detached))).toHaveLength(1);
    expect(envs).toHaveLength(3);
  });

  it('普通 DocumentFragment 里的 anchor 也命中 detachedEnv（不算 ShadowRoot）', () => {
    const fragment = document.createDocumentFragment();
    const anchor = document.createElement('div');
    fragment.appendChild(anchor);
    expect(selectHostEnv(createHostEnvs(), anchor).name).toBe('detached');
  });
});

describe('lightEnv', () => {
  it('注入到 document.head，带 data-sl-shared-css 标记', () => {
    const anchor = makeLightAnchor();
    const marker = 'host-env-probe-light';
    selectHostEnv(createHostEnvs(), anchor).injectCss(anchor, [CSS_LIGHT]);

    const styles = [...document.head.querySelectorAll('style[data-sl-shared-css]')];
    const hit = styles.filter((el) => (el.textContent ?? '').includes(marker));
    expect(hit).toHaveLength(1);
  });

  it('同一份 CSS 文本只注入一次（document 全局唯一，模块级去重成立）', () => {
    const anchor = makeLightAnchor();
    const marker = 'host-env-probe-light';
    const env = selectHostEnv(createHostEnvs(), anchor);
    env.injectCss(anchor, [CSS_LIGHT]);
    env.injectCss(anchor, [CSS_LIGHT]);

    const hit = [...document.head.querySelectorAll('style[data-sl-shared-css]')].filter((el) =>
      (el.textContent ?? '').includes(marker),
    );
    expect(hit).toHaveLength(1);
  });
});

describe('shadowEnv', () => {
  it('注入到 anchor 所在的 shadow root，不泄漏到 document.head', () => {
    const { anchor, root } = makeShadowAnchor();
    selectHostEnv(createHostEnvs(), anchor).injectCss(anchor, [CSS_SHADOW_A]);

    expect(shadowHasCss(root, 'host-env-probe-shadow-a')).toBe(true);
    const leaked = [...document.head.querySelectorAll('style[data-sl-shared-css]')].some((el) =>
      (el.textContent ?? '').includes('host-env-probe-shadow-a'),
    );
    expect(leaked).toBe(false);
  });

  it('两个不同的 shadow root 各自都拿到样式 —— 去重域必须是 root 局部', () => {
    const first = makeShadowAnchor();
    const second = makeShadowAnchor();
    const envs = createHostEnvs();

    selectHostEnv(envs, first.anchor).injectCss(first.anchor, [CSS_SHADOW_B]);
    // 模拟「返回列表 → 再次进入详情页」：anchor 属于另一个全新的 shadow root
    selectHostEnv(envs, second.anchor).injectCss(second.anchor, [CSS_SHADOW_B]);

    expect(shadowHasCss(first.root, 'host-env-probe-shadow-b')).toBe(true);
    expect(shadowHasCss(second.root, 'host-env-probe-shadow-b')).toBe(true);
  });

  it('同一个 shadow root 内重复注入同一份 CSS 保持幂等', () => {
    const { anchor, root } = makeShadowAnchor();
    const env = selectHostEnv(createHostEnvs(), anchor);
    env.injectCss(anchor, [CSS_SHADOW_A]);
    env.injectCss(anchor, [CSS_SHADOW_A]);

    const viaStyleTags = [...root.querySelectorAll('style[data-sl-css]')].filter((el) =>
      (el.textContent ?? '').includes('host-env-probe-shadow-a'),
    );
    expect(viaStyleTags.length).toBeLessThanOrEqual(1);
  });
});

describe('detachedEnv', () => {
  it('落点是 document.head（游离子树最终会接入文档，提前注入不漏样式）', () => {
    const anchor = makeDetachedAnchor();
    selectHostEnv(createHostEnvs(), anchor).injectCss(anchor, [CSS_DETACHED]);

    const hit = [...document.head.querySelectorAll('style[data-sl-shared-css]')].filter((el) =>
      (el.textContent ?? '').includes('host-env-probe-detached'),
    );
    expect(hit).toHaveLength(1);
  });

  it('去重域与 lightEnv 一致：同一份 CSS 只注入一次', () => {
    const anchor = makeDetachedAnchor();
    const env = selectHostEnv(createHostEnvs(), anchor);
    env.injectCss(anchor, [CSS_DETACHED]);
    env.injectCss(anchor, [CSS_DETACHED]);

    const hit = [...document.head.querySelectorAll('style[data-sl-shared-css]')].filter((el) =>
      (el.textContent ?? '').includes('host-env-probe-detached'),
    );
    expect(hit).toHaveLength(1);
  });
});
