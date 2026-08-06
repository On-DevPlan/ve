// mount-adapters —— 详情页 ShadowRoot 容器工厂。
// 对应 spec §10.2 "Shadow DOM 仅作用于详情页" + §10.5 "Portal/Teleport 目标"。
//
// 职责:
//   1) 在传入的容器元素上挂一个 ShadowRoot(open/closed 二选一,默认 closed)
//   2) 注入极简 reset 样式(spec §10.6.8:"每个 ShadowRoot 注入极简 reset")
//   3) 在 ShadowRoot 内放一个 portal target div,组件用 Vue Teleport / React createPortal 时挂这里
//   4) 把 theme tokens 写到 shadowRoot 的 :host,让组件 CSS Variables 能直接读到
//   5) 提供 injectCss() 同步注入组件 CSS(adoptedStyleSheets 优先,见 style-adoption.ts)
//   6) 提供 cssReady 完成信号(可 reject)与 failCss() 供 adapter 降级
//   7) 提供 destroy() 在路由离开时拆掉整个容器,避免泄漏
//
// 注意 卡片层永远不要走这里:spec §10.1 明确"CardGrid 永远 Light DOM",
//   Shadow DOM 只在 DetailPage 由本工厂创建。

import { adoptCssTexts } from './style-adoption.ts';

// 工厂选项
//   - container: 详情页已经准备好的真实 DOM 容器(由 Host 提供)
//   - open:      ShadowRoot 是否 open(默认 true,匹配 Vue 3 patch reconciler 兼容性)
//   - tokens:    主题 contract 的 CSS Variables,写到 shadowRoot 的 :host
export interface ShadowRootHostOptions {
  container: HTMLElement;
  open?: boolean;
  tokens?: Record<string, string>;
  /** @deprecated 组件样式改由 collect 阶段产出 CSS 文本,经 injectCss() 同步注入。此选项不再参与注入逻辑。 */
  stylesheetUrls?: string[];
}

// 工厂返回的句柄
//   - container:    同一个外部容器(便于追踪/释放)
//   - shadowRoot:   detail 组件实际工作的隔离边界
//   - portalTarget: Teleport / Portal 目标节点(spec §10.5)
//   - injectCss:    同步注入组件 CSS(adoptedStyleSheets 优先;同文本幂等)
//   - cssReady:     CSS 注入完成信号;injectCss 后 resolve,failCss 后 reject
//   - failCss:      标记 CSS 获取失败 → cssReady reject(adapter 降级无样式渲染)
//   - destroy():    路由离开时拆掉整个容器
export interface ShadowRootHost {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  portalTarget: HTMLDivElement;
  injectCss(texts: string[]): void;
  failCss(err: unknown): void;
  readonly cssReady: Promise<void>;
  destroy(): void;
}

// 工厂入口(保留工厂函数形态,不改成 class —— 增量叠加 cssReady/failCss 最小破坏)
export function createShadowRootHost(opts: ShadowRootHostOptions): ShadowRootHost {
  const { container, open = true, tokens } = opts;
  const shadowRoot = container.attachShadow({ mode: open ? 'open' : 'closed' });

  // reset + theme(保持 v1 的 <style> append 方式)
  const reset = document.createElement('style');
  reset.textContent = `:host, *, *::before, *::after { box-sizing: border-box; }`;
  shadowRoot.appendChild(reset);
  if (tokens) {
    const decls = Object.entries(tokens)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
    const themeStyle = document.createElement('style');
    themeStyle.textContent = `:host { ${decls} }`;
    shadowRoot.appendChild(themeStyle);
  }

  // cssReady:一次性(先到先 settle);未 catch 的 reject 不产生 unhandledrejection 噪音
  let settled = false;
  let resolveCss!: () => void;
  let rejectCss!: (e: unknown) => void;
  const cssReady = new Promise<void>((res, rej) => {
    resolveCss = res;
    rejectCss = rej;
  });
  cssReady.catch(() => {});

  function injectCss(texts: string[]): void {
    adoptCssTexts(shadowRoot, texts);
    if (!settled) { settled = true; resolveCss(); }
  }
  function failCss(err: unknown): void {
    if (!settled) { settled = true; rejectCss(err); }
  }

  // portal target:Teleport / Portal 的默认挂载点
  const portalTarget = document.createElement('div');
  portalTarget.setAttribute('data-sl-portal', '');
  shadowRoot.appendChild(portalTarget);

  // 销毁函数:从父节点拆掉整个 container,从而 release ShadowRoot 与 portalTarget
  const destroy = (): void => {
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  return {
    container,
    shadowRoot,
    portalTarget,
    injectCss,
    failCss,
    cssReady,
    destroy,
  };
}
