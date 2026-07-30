# html-light · HTML-in-Canvas 光照表单

一张**可实时输入的表单**被渲染进 WebGL 画布,由一盏物理仿真的悬挂射灯照亮。
模仿 [jinruozai/HTML-Light-Demo](https://github.com/jinruozai/HTML-Light-Demo) 的技术栈
(React + Three.js + [`three-html-render`](https://www.npmjs.com/package/three-html-render) /
HTML-in-Canvas),但把原页面静态营销内容换成了一张真实可输入的表单。

## 它展示了什么

- **HTML-in-Canvas**:表单是 `<canvas layoutsubtree>` 的真实 DOM 子节点。浏览器把它
  绘制成 Three.js 纹理贴到 3D 卡片上,因此你能用真实光标点亮它。
- **可输入**:Name / Email / Note(`textarea`)/ Mood(`select`)/ 复选框,全部真实可输入、
  可聚焦、可选中、带 IME。每次按键 → 下一帧 `paint` 重新上传纹理 → 卡片上的文字实时更新。
- **物理灯光**:Verlet 约束摆求解器驱动的吊灯,真实摆动 + 释放惯量。

## 交互

| 操作 | 效果 |
| --- | --- |
| 左键拖拽 | 拉 / 瞄准灯,松手带摆动惯量 |
| 右键拖拽 | 调节光束角度 |
| 右键单击 | 循环灯色 |
| 双击 | 复位灯 |

灯光面板(右侧)还能开关灯、调亮度、选色(含自定义)。表单区域点击/输入不会触发拉灯。

## 技术栈与关键决策

- **Three.js + `three-html-render`**:用同库的 `ThreeHTMLRenderer`(`three-html-render/renderer`)
  集成,而非 `THREE.HTMLTexture`——`three-html-render@0.1.2` 并未在 `THREE` 上挂 `HTMLTexture`,
  `ThreeHTMLRenderer` 是更稳健的集成层:它把表单 div 通过 `matrix3d` 定位到卡片 mesh 的屏幕
  投影(解决"点哪打哪"的命中问题),上传为 WebGL 纹理,并在表单上 `stopPropagation` 指针事件,
  使"拖灯"与"填表"互不干扰。
- **移除** `three/addons/interaction/InteractionManager`(原 demo 里仅作摆设,无实际命中消费)。
- **`onPointerDown` 守卫**:`event.target !== canvas` 时直接返回,确保点在表单上不会触发拉灯。
- **`isolation: 'global'` + `allowGlobalStyles`**:全视口 WebGL canvas 接管 window 级指针事件,
  且表单是 canvas 的 `layoutsubtree` 子节点,需在 document 层被 polyfill 命中。
- **`status: 'experimental'`**:依赖 HTML-in-Canvas,需 polyfill 或 Chrome 开启
  `chrome://flags/#canvas-draw-element`。

## 浏览器支持

HTML-in-Canvas 目前仅在 Chromium 中实验性可用。组件会在挂载时动态安装
`three-html-render` 的 polyfill;若环境仍不支持(WebGL 缺失或 polyfill 失败),会显示降级提示。

## 文件结构

```
html-light/
├── index.tsx              # 顶层入口(只组合)
├── component.config.ts    # 元数据(framework: react, isolation: global)
├── index.css              # 全部样式(sl-hl- 前缀,--sl-* token)
└── src/
    ├── HtmlLightCanvas.tsx  # Three.js 场景 + 物理灯 + 渲染循环 + 交互
    ├── GuestForm.tsx        # 可输入表单卡片(被绘制进 canvas 的真实 DOM)
    ├── lightConfig.ts       # 灯光 / 心情常量与类型
    └── threeHtmlCompat.ts   # texElementImage2D 重载桥接
```

## 来源与致谢

- 原始创意与美术方向:[@kaolti](https://x.com/kaolti)
- 参考实现:[jinruozai/HTML-Light-Demo](https://github.com/jinruozai/HTML-Light-Demo)(MIT)
- 提案:[WICG/html-in-canvas](https://github.com/WICG/html-in-canvas)

本组件为学习 / 演示用途的独立实现,与原作者无官方关联。
