// host-env.ts —— 共享组件的「宿主环境」策略。
//
// 背景：shared/components 下的组件会出现在两种完全不同的样式作用域里：
//
//   E1 Light DOM     宿主 chrome（App.vue 布局层）消费，样式作用域是 document。
//                    典型件：返回键这类全局通用 UI。
//   E2 ShadowRoot 内 被 demo 组件消费，而 demo 由 DetailPage 挂在 ShadowRoot 里。
//                    典型件：文件选择按钮（React 的 ImportModal 要用）。
//   E0 游离子树       anchor 还在一棵尚未接入文档的子树里。样式作用域最终仍是
//                    document，所以落点与去重域都同 E1。
//
// E0 不是理论情形，是接第一个真实消费点（game-skin-admin）时测试直接撞出来的：
// `@vue/test-utils` 的 mount() 默认把组件挂到一个游离 div 上；离屏渲染、导出截图
// （html2canvas 这类先建游离容器再绘制）同理。此时 `getRootNode()` 返回那棵游离
// 子树的**根元素**（或普通 DocumentFragment），既不是 document 也不是 ShadowRoot
// —— 前两个策略都不命中。修复前这里是直接抛错，等于「组件一进游离容器就炸」。
//
// 两者的**挂载代码完全相同**（都是 createApp(...).mount(div)），真正不同的是
// 「样式落点」与「去重域」：
//
//   E1：注一次进 document.head 即可 —— document 全局唯一，模块级 Set 去重正确。
//   E2：必须注进「当前这一层」shadow root。DetailPage 每次进详情页都**新建**
//       shadow root、离开时 destroy()。若沿用模块级 Set 记「已注入」，第二次
//       进入同一个详情页就不会再注入 → 样式永久丢失，且只在「进 A → 返回 →
//       再进 A」时才暴露，首次开发极难发现。
//
// 所以这里用策略模式把差异收口。形状与 mount-adapters 的 AdapterFactory 对齐：
//   工厂返回列表 → canHandle 判定 → 选择器遍历 → 找不到抛错。
//
// 策略的边界：只覆盖「样式落点」，不包挂载流程 —— 挂载在两个环境下是同一行
// 代码，包进策略只会得到一个只有一个实现体的空抽象。
//
// 注意：主题 token 不需要策略。CSS 自定义属性会继承穿透 shadow 边界，
// :root（E1）与 :host（E2，由 ShadowRootHost 写入）上的变量都能被组件读到。
//
// 引入路径刻意走**子路径入口**而非包根 barrel：
// barrel（packages/mount-adapters/src/index.ts）`export * from './ReactMountAdapter.ts'`，
// 会把 react-dom 拉进本模块的静态依赖图；而本模块在两个框架之间共用（它是 Vue 侧与
// React 侧共享的底层 chunk），被它拖着加载 192 KB 的 react-vendor 是错的。
// 直接引叶子模块，Rollup 才能把 ReactMountAdapter 摇掉。

import { adoptCssTexts, djb2 } from '@style-library/mount-adapters/style-adoption';

/** 宿主环境策略：回答「这个 anchor 的样式该注到哪、去重域多大」。 */
export interface HostEnvStrategy {
  /** 策略标识，用于日志与测试断言。 */
  readonly name: 'light' | 'shadow' | 'detached';
  /** 该 anchor 是否属于本策略管辖的样式作用域。 */
  canHandle(anchor: Element): boolean;
  /** 把共享组件的 CSS 注入 anchor 所处的样式作用域。必须幂等。 */
  injectCss(anchor: Element, cssTexts: string[]): void;
}

/**
 * document 级已注入指纹集合。
 *
 * lightEnv 与 detachedEnv 共用 —— 两者的目标作用域都是 document，而 document
 * 全局唯一，所以模块级去重对二者都成立。
 * shadowEnv 绝不能引用它（见文件头注释里的样式永久丢失场景）。
 */
const documentInjected = new Set<string>();

/** 注入 document.head。lightEnv / detachedEnv 共用的实际落点。 */
function injectIntoDocumentHead(cssTexts: string[]): void {
  for (const css of cssTexts) {
    if (!css) continue;
    const key = djb2(css);
    if (documentInjected.has(key)) continue;
    documentInjected.add(key);
    const style = document.createElement('style');
    // data 标记与 mount-adapters 的 style[data-sl-css] 刻意区分：
    // 后者是「详情页注入的组件样式」，前者是「共享组件样式」，便于排查。
    style.dataset.slSharedCss = key;
    style.textContent = css;
    document.head.appendChild(style);
  }
}

/** E1：anchor 在 Light DOM 里，样式注入 document.head。 */
const lightEnv: HostEnvStrategy = {
  name: 'light',
  canHandle(anchor) {
    return anchor.getRootNode() === document;
  },
  injectCss(_anchor, cssTexts) {
    injectIntoDocumentHead(cssTexts);
  },
};

/**
 * E2：anchor 在某个 ShadowRoot 内，样式就地注入该 shadow root。
 *
 * 直接复用 adoptCssTexts，不自己实现，因为它已经是对的实现：
 *   - 按 root 局部幂等（读 root.adoptedStyleSheets 与 root 内 style[data-sl-css]），
 *     新建的 shadow root 天然拿到全新一份 —— 正是 E2 需要的语义；
 *   - 模块级 sheetCache 让同一 CSS 文本跨所有 shadow root 共享同一个
 *     CSSStyleSheet 对象，零重复解析；
 *   - @import 规则的降级、以及不支持 adoptedStyleSheets 的浏览器降级，
 *     它都已经处理。
 */
const shadowEnv: HostEnvStrategy = {
  name: 'shadow',
  canHandle(anchor) {
    return anchor.getRootNode() instanceof ShadowRoot;
  },
  injectCss(anchor, cssTexts) {
    adoptCssTexts(anchor.getRootNode() as ShadowRoot, cssTexts);
  },
};

/**
 * E0：anchor 还在一棵尚未接入文档的子树里（游离元素树 / 普通 DocumentFragment）。
 *
 * 为什么落到 document.head 而不是抛错或跳过：
 *   - 游离子树此刻不可见，有没有样式都无所谓；
 *   - 但它绝大多数情况下最终会被 append 进 document，届时 head 里的规则正好生效
 *     —— 等于把注入提前做了，不会漏样式。
 *   - 反过来若是抛错，等于「组件一被放进游离容器就炸」，代价远大于收益。
 *
 * 已知限制：若这棵子树最终被 append 进某个 ShadowRoot（而非 document），head 里的
 *   规则进不去。真实链路不会这样 —— ShadowRoot 一定先建好再把组件挂进去
 *   （ShadowRootHost 的 portalTarget 就是这么来的），挂载时 anchor 已在 shadow 内，
 *   自然命中 shadowEnv。所以这里不做处理。
 *
 * 去重域与 lightEnv 相同（document 全局唯一），故复用同一份 documentInjected。
 */
const detachedEnv: HostEnvStrategy = {
  name: 'detached',
  canHandle(anchor) {
    const root = anchor.getRootNode();
    // 游离子树的根只有两种形态：元素自身，或普通 DocumentFragment。
    // ShadowRoot 也是 DocumentFragment 的子类，必须先排除（上面已由 shadowEnv 拦下，
    // 但 canHandle 需独立成立 —— 测试断言三者两两互斥）。
    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return !(root instanceof ShadowRoot);
    return root.nodeType === Node.ELEMENT_NODE;
  },
  injectCss(_anchor, cssTexts) {
    injectIntoDocumentHead(cssTexts);
  },
};

/** 工厂：返回全部宿主环境策略。形状对齐 AdapterFactory.createAdapters()。 */
export function createHostEnvs(): HostEnvStrategy[] {
  // 顺序即优先级：light / shadow 精确命中，detached 兜住「尚未接入文档」的子树。
  return [lightEnv, shadowEnv, detachedEnv];
}

/**
 * 选择器：挑出 canHandle(anchor) 为真的策略。
 *
 * 三个策略穷尽了 `getRootNode()` 的返回形态：本文件所在 document、ShadowRoot、
 * 以及游离根（元素 / 普通 DocumentFragment）。抛错是防御性的：将来若引入第四种
 * 根类型（例如 iframe 的 document —— 它 nodeType 是 DOCUMENT_NODE 但不是本文件的
 * document），我们希望它立刻炸出来，而不是静默把样式注到错误的文档里。
 */
export function selectHostEnv(envs: HostEnvStrategy[], anchor: Element): HostEnvStrategy {
  const found = envs.find((e) => e.canHandle(anchor));
  if (!found) {
    throw new Error('[shared/components] no HostEnvStrategy matched for anchor');
  }
  return found;
}
