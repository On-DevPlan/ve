# gaussian-splat-viewer

基于 three.js + `@mkkellogg/gaussian-splats-3d` 的滚动驱动电影感 3D 高斯泼溅查看器,
源自 [3D-web/sharp-3d-viewer](../../../../../3D-web/sharp-3d-viewer)。

## 体验

- 加载时显示 `S H A R P` 标题 + spinner(LoadingScreen)
- 加载完成后底部出现进度条(ProgressBar),屏幕中央有 `↓ SCROLL TO START ↓` 提示
- 滚动鼠标 / 触摸拖动 → 相机沿 CatmullRom 曲线推进
- 进度 ≥ 99% 时右侧滑入 "Muse Dash" 介绍框(IntroBox)
- 鼠标光标是自定义 `1.ico`

## 隔离模式

`isolation.mode: 'global'`——渲染容器是一个全视口 fixed-position div
(`.sl-gsv-canvas-host`),组件捕获 window 级 wheel / touch 事件,覆盖 body 光标和
overflow。host ShadowRoot 仅放叠层 UI(LoadingScreen / ProgressBar / IntroBox),
canvas 由 `useGaussianScene` 直接挂到容器 div。

## 资产

- `apps/showcase/public/splat/image.ply` (66 MB 高斯泼溅)
- `apps/showcase/public/splat/1.ico` (自定义光标)

要替换为其他资产:把新文件放到 `apps/showcase/public/splat/`,在 `component.config.ts`
里把依赖里的 `plyPath` 默认值改为新 URL;或通过 mount props 传入 `plyPath` / `cursorUrl`。
