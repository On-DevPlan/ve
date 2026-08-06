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
//
// ⚠️ KNOWN-LIMITATIONS(adoptStylesInto 远程组件兜底路径)
//
// 仓库当前 0 个组件使用 loaderUrl,以下 3 个 latent bug 在远程组件路径下才触发:
//   - P0 白屏:link 在调用前已 error(如 404),l.sheet===null 但 load/error 已 fired
//     → Promise 永不 settle → adapter.mount 永挂 → 白屏
//   - P1 破隔离:收集所有 document.styleSheets → dump 进 shadow → 选择器被 host CSS 意外匹配
//   - P2 静默缺样式:link.sheet 已存在但 cssRules 解析中 → Promise.resolve() 早返 → 注入空文本
//
// 引入首个 loaderUrl 组件前必须修复:
//   - P0:Promise 加超时 race(如 5s 强制 resolve)
//   - P1:限定可识别组件 CSS 白名单(data-attribute 标记 / manifest 声明)
//   - P2:load 后加 microtask 或验证 cssRules.length

// 36 进制 hash-长度指纹,用作跨 shadow 共享 sheet 的 key。
export function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(36)}-${s.length.toString(36)}`;
}

// 检测 raw CSS 文本是否含 @import 规则。
// W3C 规范:CSSStyleSheet.replaceSync() 不允许 @import rule(构造时序与
// raw CSS 规则冲突)。含 @import 的 CSS 文本必须走 <style> clone 路径,
// 浏览器允许 <style> 内 @import。
//
// 匹配:
//   - 行首 @import url(...); 或 @import "...";
//   - 内嵌位置(含前导空白、换行)同样适用
// 简化为:搜索字符串 "@import " 的首次出现(区分大小写、CSS 规范要求)。
// 边界:`@important`(不存在)不会误判;注释里的 `@import ` 极少见,
// 若被命中也只是退化到 <style> 路径,功能上等价。
export function hasAtImportRule(css: string): boolean {
  return /@import\s+/.test(css);
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
    // <style> 降级分支专用 seen 集合(下面会用到),提前准备好
    const seenStyle = new Set(
      [...root.querySelectorAll('style[data-sl-css]')].map(
        (el) => (el as HTMLElement).dataset.slCss!,
      ),
    );
    for (const css of cssTexts) {
      if (!css) continue;
      const key = djb2(css);
      if (hasAtImportRule(css)) {
        // 含 @import 的 raw CSS 不能进 adoptedStyleSheets(否则 replaceSync 抛
        // "@import rules are not allowed here"),整体降级到 <style> clone,
        // 浏览器允许 <style> 内 @import。
        // 代价:失去跨 shadowRoot sheet 共享 —— 仓库当前只有 mobile-nav-v5
        // 一个 @import,影响极小。
        if (seenStyle.has(key)) continue;
        const style = document.createElement('style');
        style.dataset.slCss = key;
        style.textContent = css;
        root.appendChild(style);
        seenStyle.add(key);
        continue;
      }
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