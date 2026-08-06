// style-adoption.ts —— 把组件 CSS 文本注入 ShadowRoot(adoptedStyleSheets 优先)。
//
// 两个对外能力:
//   1) adoptCssTexts(root, cssTexts):把 CSS 文本同步注入 ShadowRoot。
//      优先 adoptedStyleSheets + 全局 sheet 缓存(跨 shadowRoot 共享同一 sheet,
//      零重复解析);不支持时降级 <style data-sl-css> clone。
//   2) adoptStylesInto(shadowRoot):远程组件兜底 —— 等 document.head 的
//      <link rel="stylesheet"> 真正 load 完,收集 document.styleSheets 的
//      cssRules 文本,再 adoptCssTexts 进 shadowRoot。
//
// 为什么等 link load:v1 是同步快照 head 的 <link>,prod 下 link 未加载完就
// 捕获空 CSS → "DOM 先到、样式后到"。等 load 完再收集,消除该时序竞态。

// 36 进制 hash-长度指纹,用作跨 shadow 共享 sheet 的 key。
export function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(36)}-${s.length.toString(36)}`;
}

// 全局 sheet 缓存:同一 CSS 文本 → 同一 CSSStyleSheet,跨所有 shadowRoot 复用。
const sheetCache = new Map<string, CSSStyleSheet>();

const supportsAdopted =
  typeof CSSStyleSheet !== 'undefined' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in Document.prototype;

export function adoptCssTexts(root: ShadowRoot, cssTexts: string[]): void {
  if (!cssTexts.length) return;

  if (supportsAdopted) {
    const existing = new Set(root.adoptedStyleSheets);
    const next = [...root.adoptedStyleSheets];
    for (const css of cssTexts) {
      if (!css) continue;
      const key = djb2(css);
      let sheet = sheetCache.get(key);
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        sheetCache.set(key, sheet);
      }
      if (!existing.has(sheet)) next.push(sheet);
    }
    root.adoptedStyleSheets = next;
    return;
  }

  // 降级:<style> clone(Safari < 16.4 等)
  const seen = new Set(
    [...root.querySelectorAll('style[data-sl-css]')].map(
      (el) => (el as HTMLElement).dataset.slCss!,
    ),
  );
  for (const css of cssTexts) {
    if (!css) continue;
    const key = djb2(css);
    if (seen.has(key)) continue;
    const style = document.createElement('style');
    style.dataset.slCss = key;
    style.textContent = css;
    root.appendChild(style);
    seen.add(key);
  }
}

/** 远程组件兜底:等 head 的 <link> load 完,收集 styleSheets 文本进 shadow。 */
export async function adoptStylesInto(shadowRoot: ShadowRoot): Promise<void> {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  );
  await Promise.all(
    links.map((l) =>
      l.sheet
        ? Promise.resolve()
        : new Promise<void>((res) => {
            l.addEventListener('load', () => res(), { once: true });
            l.addEventListener('error', () => res(), { once: true });
          }),
    ),
  );

  const texts: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      texts.push([...sheet.cssRules].map((r) => r.cssText).join('\n'));
    } catch {
      // 跨域 sheet,cssRules 读不到,跳过
    }
  }
  adoptCssTexts(shadowRoot, texts);
}
