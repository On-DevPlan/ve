// html-light 组件的 config(对应 spec §4.1 ComponentConfig)。
//
// 这是一个 React + Three.js + three-html-render(HTML-in-Canvas) 的交互式光照场景:
//   - 一张可实时输入的表单(真实 DOM)作为 <canvas layoutsubtree> 的子节点
//   - three-html-render 的 ThreeHTMLRenderer 把表单绘制成 WebGL 纹理贴到 3D 卡片上
//   - 物理仿真的悬挂射灯(Verlet 摆)照亮卡片,可拖拽 / 调光束 / 调色
//
// 注释约定:
//   - id / name 与目录名一致,manifest 扫描器按 id 索引
//   - route.path 必须以 /components/ 开头且末段 == id(见 eslint rules/valid-component-config.js)
//   - mount.kind = 'react' → 详情页用 ReactMountAdapter 挂载
//   - isolation.mode = 'global':全视口 WebGL canvas 接管 window 级指针事件(LMB 拉 / RMB 调光),
//     且表单是 canvas 的 layoutsubtree 子节点,需在 document 层被 html-in-canvas polyfill 命中,
//     故走 global 隔离 + allowGlobalStyles,样式注入 document.head
//   - status = 'experimental':依赖 html-in-canvas(polyfill / chrome://flags/#canvas-draw-element)

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'html-light',
  name: 'HtmlLight',
  title: 'HTML-in-Canvas 光照表单',
  description:
    '基于 Three.js + three-html-render(HTML-in-Canvas):一张可实时输入的表单被渲染进 WebGL 画布,由物理仿真的悬挂射灯照亮。可拖拽灯、调节光束角度/亮度/颜色。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '3D 场景',
  tags: ['three', 'three-html-render', 'html-in-canvas', 'webgl', 'spotlight', 'form', 'interactive'],
  platform: 'pc',
  status: 'experimental',
  route: { path: '/components/html-light', title: 'HTML-in-Canvas 光照表单', keepAlive: false },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: {
    mode: 'global',
    allowGlobalStyles: true,
    globalStyleReason:
      'Renders a full-viewport fixed WebGL canvas that captures window-level pointer events for the hanging-spotlight interaction (LMB pull/aim, RMB beam/color) and overrides the stage cursor; the live HTML form is a layoutsubtree child of the canvas and must be reachable by the html-in-canvas polyfill at the document level.',
  },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'viewport' },
  dependencies: [
    { name: 'three', version: '^0.170.0', sharing: 'component' },
    { name: 'three-html-render', version: '^0.1.2', sharing: 'component' },
  ],
} satisfies ComponentConfig;
