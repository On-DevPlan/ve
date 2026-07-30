// html-light 顶层入口 —— 只做组合,业务全在 src/。
//
// 挂载约定(见 component.config.ts):
//   - isolation.mode = 'global' + allowGlobalStyles:样式注入 document.head,
//     全视口 canvas 接管 window 级指针事件。
//   - HtmlLightCanvas 内部:
//       <canvas layoutsubtree>  ← WebGL + html-in-canvas
//         <GuestForm/>           ← 真实可输入表单(canvas 子节点,被绘制成纹理)
//
// 详见 README.md。

import './index.css';
import { HtmlLightCanvas } from './src/HtmlLightCanvas';

export default function HtmlLight() {
  return <HtmlLightCanvas />;
}
