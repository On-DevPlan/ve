// mount-adapters —— 详情页 ShadowRoot 容器工厂。
// 对应 spec §10.2 "Shadow DOM 仅作用于详情页" + §10.5 "Portal/Teleport 目标"。
//
// 职责:
//   1) 在传入的容器元素上挂一个 ShadowRoot(open/closed 二选一,默认 closed)
//   2) 注入极简 reset 样式(spec §10.6.8:"每个 ShadowRoot 注入极简 reset")
//   3) 在 ShadowRoot 内放一个 portal target div,组件用 Vue Teleport / React createPortal 时挂这里
//   4) 把 theme tokens 写到 portal target 的 inline style,让组件 CSS Variables 能直接读到
//   5) 提供 destroy() 在路由离开时拆掉整个容器,避免泄漏
//   6) 提供 injectCss() 同步注入组件 CSS <style>,ready 作为 CSS 注入完成信号
//
// 注意 卡片层永远不要走这里:spec §10.1 明确"CardGrid 永远 Light DOM",
//   Shadow DOM 只在 DetailPage 由本工厂创建。

import { styleFingerprint } from './style-adoption.ts'; // 复用 djb2 指纹

// 工厂选项
//   - container: 详情页已经准备好的真实 DOM 容器(由 Host 提供)
//   - open:      ShadowRoot 是否 open(默认 false / closed,更严格的隔离)
//   - tokens:    主题 contract 的 CSS Variables,会写到 portal target 的 inline style
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
//   - injectCss:    同步注入组件 CSS <style>,同一文本幂等去重
//   - ready:        CSS 注入完成信号;同步注入下恒为已 resolve 的 Promise
//   - destroy():    路由离开时拆掉整个容器
export interface ShadowRootHost {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  portalTarget: HTMLDivElement;
  injectCss(texts: string[]): void;
  ready: Promise<void>;
  destroy(): void;
}

// 工厂入口
export function createShadowRootHost(opts: ShadowRootHostOptions): ShadowRootHost {
  // 解构 + 默认值:open 默认 closed(spec §4.5 IsolationConfig.open 默认 true,
  // 但本工厂函数层面默认 closed,匹配 spec §10.2 的"更严格隔离"取向)
  const { container, open = true, tokens } = opts;
  // 在容器上挂 ShadowRoot;默认 open,因为 Vue 3 的 patch reconciler 在 closed
  // ShadowRoot 下执行 parentNode.insertBefore 时,浏览器的 closed-mode 验证
  // 比 light DOM 严格,可能导致 NotFoundError。
  const shadowRoot = container.attachShadow({ mode: open ? 'open' : 'closed' });

  // 极简 reset:把所有 box-sizing 统一到 border-box,避免组件内部 reset 缺失时布局崩
  const reset = document.createElement('style');
  reset.textContent = `:host, *, *::before, *::after { box-sizing: border-box; }`;
  shadowRoot.appendChild(reset);

  // 主题 token:写在 shadowRoot 的 :host 上,所有 shadow 内的元素都继承
  if (tokens) {
    const decls = Object.entries(tokens)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
    const themeStyle = document.createElement('style');
    themeStyle.textContent = `:host { ${decls} }`;
    shadowRoot.appendChild(themeStyle);
  }

  // 已注入的 CSS 指纹(Style 节点去重;随 ShadowRoot 生命周期)
  const seenCssFingerprints = new Set<string>();

  // 同步注入组件 CSS:<style data-sl-css="<fp>">,同文本去重,幂等。
  // 由 css-collector 阶段产出 CSS 文本后经此注入;替代旧的 stylesheetUrls fetch 逻辑。
  function injectCss(texts: string[]): void {
    for (const text of texts) {
      if (!text) continue;
      const fp = styleFingerprint(text);
      if (seenCssFingerprints.has(fp)) continue;
      seenCssFingerprints.add(fp);
      if (shadowRoot.querySelector(`style[data-sl-css="${fp}"]`)) continue;
      const style = document.createElement('style');
      style.setAttribute('data-sl-css', fp);
      style.textContent = text;
      shadowRoot.appendChild(style);
    }
  }

  // portal target:Teleport / Portal 的默认挂载点
  const portalTarget = document.createElement('div');
  portalTarget.setAttribute('data-sl-portal', '');
  shadowRoot.appendChild(portalTarget);

  // 销毁函数:从父节点拆掉整个 container,从而 release ShadowRoot 与 portalTarget
  // 路由离开时 Host 必须调用 destroy(),否则会泄漏(spec §8.3 内存要求)
  const destroy = (): void => {
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  return {
    container,
    shadowRoot,
    portalTarget,
    injectCss,
    ready: Promise.resolve(),
    destroy,
  };
}