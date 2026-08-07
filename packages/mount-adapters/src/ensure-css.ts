// ensure-css.ts —— adapter 公共前置:render 前保证 CSS 就绪,失败降级不白屏。
//
// 语义:
//   - 有 cssReady(本地组件,host 已注入):await;若 reject → console.error 降级为
//     无样式渲染(评审 #8:宁可无样式,不能白屏)。
//   - 无 cssReady(远程组件):adoptStylesInto 等 document.head 的 link 加载完。

import type { MountContext } from '@style-library/component-contract';
import { adoptStylesInto } from './style-adoption.ts';

export async function ensureCss(ctx: MountContext): Promise<void> {
  if (ctx.cssReady) {
    try {
      await ctx.cssReady;
    } catch (e) {
      console.error('[mount-adapters] CSS 加载失败,降级为无样式渲染', e);
    }
    return;
  }
  await adoptStylesInto(ctx.shadowRoot).catch(() => {});
}
