// mount-adapters —— ShadowRoot 样式 adoption 共享逻辑。
//
// VueMountAdapter 与 ReactMountAdapter 共用本模块:把 Vite 注入 document.head
// 的 <style>(SFC <style scoped> 或 side-effect CSS)克隆进 ShadowRoot。
//
// 背景:Vite 把组件样式注入 document.head,但 ShadowRoot 封装后这些样式
// 跨不进来。我们在组件 mount 后扫描 document.head 的新 <style>,克隆文本进
// ShadowRoot,用 djb2 指纹去重,避免重复克隆同一份样式。
//
// WeakMap 跨两个 adapter 共享:同一个 ShadowRoot 不管被哪个 adapter mount,
// 都共用同一份"已 clone 指纹"集合,避免 Vue/React 各自维护独立状态导致
// 重复克隆。

// djb2 哈希取前 8 个十六进制位 + 文本长度,作为 CSS 属性选择器安全的指纹值
function styleFingerprint(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return `${(hash >>> 0).toString(16)}-${text.length}`;
}

// 每个 ShadowRoot 已 clone 的样式指纹;ShadowRoot 被 GC 时自动清理
const seenStyleFingerprintsByShadowRoot = new WeakMap<ShadowRoot, Set<string>>();

/**
 * 扫描 document.head 的 <style> 和 <link rel="stylesheet">,
 * 把还没 clone 进 shadowRoot 的克隆进去。
 * 幂等:同一 ShadowRoot 多次调用不会重复克隆同一份样式。
 *
 * 为什么也要处理 <link>:
 *   Vite build (mode=production) 把 CSS 拆成外部 .css 文件,通过
 *   <link rel="stylesheet"> 加载;只有 dev 模式才用 <style> 内联。
 *   adoptStylesInto 只扫 <style> 会让 build 产物无样式。
 */
export function adoptStylesInto(shadowRoot: ShadowRoot): void {
  let seen = seenStyleFingerprintsByShadowRoot.get(shadowRoot);
  if (!seen) {
    seen = new Set<string>();
    seenStyleFingerprintsByShadowRoot.set(shadowRoot, seen);
  }

  // 1) 克隆 <style> 标签(dev 模式)
  const styleEls = Array.from(document.head.querySelectorAll('style'));
  for (const s of styleEls) {
    const text = s.textContent ?? '';
    if (!text) continue;
    const fp = styleFingerprint(text);
    if (seen.has(fp)) continue;
    seen.add(fp);
    if (shadowRoot.querySelector(`style[data-sl-clone="${fp}"]`)) continue;
    const cloned = document.createElement('style');
    cloned.setAttribute('data-sl-clone', fp);
    cloned.textContent = text;
    shadowRoot.appendChild(cloned);
  }

  // 2) 克隆 <link rel="stylesheet">(build 模式)
  const linkEls = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of linkEls) {
    const href = link.getAttribute('href') ?? '';
    if (!href) continue;
    // 用 href 做指纹(外部文件内容由服务器决定,URL 足够区分)
    const fp = styleFingerprint(href);
    if (seen.has(fp)) continue;
    seen.add(fp);
    if (shadowRoot.querySelector(`link[data-sl-clone="${fp}"]`)) continue;
    const cloned = document.createElement('link');
    cloned.setAttribute('rel', 'stylesheet');
    cloned.setAttribute('href', href);
    cloned.setAttribute('data-sl-clone', fp);
    shadowRoot.appendChild(cloned);
  }
}
