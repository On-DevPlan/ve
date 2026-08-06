// 单元测试:createShadowRootHost 详情容器工厂。
// 验证不变量:
//   1) 默认 mode === 'open'(Vue 3 patch reconciler 兼容性)
//   2) 配置 open === true 时 mode === 'open'
//   3) portal target 必须是 DIV 且挂在 shadowRoot 上
//   4) tokens 必须被写到 shadowRoot 的 :host 规则
//   5) destroy() 必须把容器从父节点上摘掉
//   6) injectCss 注入组件 CSS(adoptedStyleSheets 优先 / <style data-sl-css> 降级)
//   7) cssReady 一次性 settle:injectCss resolve,failCss reject
//
// 用 jsdom 作为测试环境,在 vitest.config.ts 里配置。
//
// jsdom 29.1.1 adoptedStyleSheets 实测:
//   - CSSStyleSheet 存在,'replaceSync' in CSSStyleSheet.prototype === true
//   - 但 'adoptedStyleSheets' in Document.prototype === false
//   → supportsAdopted === false → adoptCssTexts 走 <style data-sl-css> 降级路径。
//   下面的 shadowCssTexts 按运行时能力适配两条断言路径,避免 jsdom 升级后失效。

import { describe, it, expect, beforeEach, afterEach } from 'vitest'; // vitest 三件套
import { createShadowRootHost } from '../src/ShadowRootHost'; // 被测工厂

const envSupportsAdopted =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in Document.prototype;

// 从 shadowRoot 里收集"已注入的组件 CSS 文本":
//   - adoptedStyleSheets 分支:读每个 sheet 的 cssRules
//   - 降级分支:读 <style data-sl-css> 节点文本(reset/theme 无该属性,天然排除)
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

describe('createShadowRootHost', () => {
  // 用一个 div 作为详情容器,挂到 document.body 上才能让 attachShadow 正常工作
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // 每个用例结束都摘掉容器,避免 jsdom 状态泄漏
    container.remove();
  });

  it('attaches an open-mode ShadowRoot by default', () => {
    // 默认 open=true (Vue 3 patch reconciler 兼容性需求)
    const host = createShadowRootHost({ container });
    expect(host.shadowRoot.mode).toBe('open');
    // host.container 必须就是传入的 container(或至少是它的祖先)
    expect(host.container === container || container.contains(host.container)).toBe(true);
  });

  it('accepts open mode when configured', () => {
    // 显式 open:true → open
    const host = createShadowRootHost({ container, open: true });
    expect(host.shadowRoot.mode).toBe('open');
  });

  it('appends a portal target div into the shadow root', () => {
    const host = createShadowRootHost({ container });
    // portal target 必须是 DIV
    expect(host.portalTarget.tagName).toBe('DIV');
    // portal target 必须挂在 shadowRoot 上(不是 document.body)
    expect(host.portalTarget.parentNode).toBe(host.shadowRoot);
  });

  it('injects CSS variables as :host rules in shadow root', () => {
    const host = createShadowRootHost({
      container,
      tokens: { '--sl-color-primary': 'red', '--sl-radius-md': '4px' },
    });
    // 主题 token 写入 shadowRoot 内的 <style>:host 规则,而不是 portalTarget 的 inline style
    // 原因:Vue/React adapter 会自己创建 div 挂到 shadowRoot,这些 div 是 portalTarget
    // 的兄弟节点,读不到 portalTarget 的 inline style。把 token 写在 :host 上,
    // 所有 shadow 内的元素都继承(包含 portalTarget 与 adapter 新建的 div)。
    const styleNodes = Array.from(host.shadowRoot.querySelectorAll('style'));
    const themeRule = styleNodes
      .map((s) => s.textContent ?? '')
      .find((t) => t.includes(':host') && t.includes('--sl-color-primary'));
    expect(themeRule).toBeDefined();
    expect(themeRule).toContain('--sl-color-primary: red');
    expect(themeRule).toContain('--sl-radius-md: 4px');
  });

  it('destroy() removes the container from its parent', () => {
    const host = createShadowRootHost({ container });
    // 调用 destroy
    host.destroy();
    // 容器已经从 document.body 上摘掉
    expect(container.parentNode).toBeNull();
  });

  it('injectCss injects the given css text into shadowRoot', () => {
    const host = createShadowRootHost({ container });
    host.injectCss(['.inject-test { color: seagreen; }']);
    const texts = shadowCssTexts(host.shadowRoot);
    expect(texts.some((t) => t.includes('.inject-test'))).toBe(true);
  });

  it('injectCss is idempotent for identical css text', () => {
    const host = createShadowRootHost({ container });
    host.injectCss(['.dedup { color: red; }']);
    host.injectCss(['.dedup { color: red; }']);
    // 同一文本两次注入只落一份(adopted:同一 sheet 不重复进数组;降级:同一 style 节点)
    const texts = shadowCssTexts(host.shadowRoot).filter((t) => t.includes('.dedup'));
    expect(texts).toHaveLength(1);
  });

  it('cssReady resolves after injectCss', async () => {
    const host = createShadowRootHost({ container });
    host.injectCss(['.ready-test { color: blue; }']);
    await expect(host.cssReady).resolves.toBeUndefined();
  });

  it('cssReady rejects when failCss is called', async () => {
    const host = createShadowRootHost({ container });
    host.failCss(new Error('css-oom'));
    await expect(host.cssReady).rejects.toThrow('css-oom');
  });

  it('cssReady settles only once (first of injectCss / failCss wins)', async () => {
    const host = createShadowRootHost({ container });
    host.failCss(new Error('boom'));
    // settle 后的 injectCss 不再改变结果
    host.injectCss(['.after-fail { color: red; }']);
    await expect(host.cssReady).rejects.toThrow('boom');
  });

  it('keeps ready as a deprecated alias of cssReady (DetailPage compat)', () => {
    const host = createShadowRootHost({ container });
    expect(host.ready).toBe(host.cssReady);
  });
});
