---
title: 将 3D-web (sharp-3d-viewer) 复刻为 wb 的 React 组件 gaussian-splat-viewer
date: 2026-07-25
status: approved
---

# 将 sharp-3d-viewer 复刻为 wb 的 React 组件

## 背景

`D:\DevProjects\my\github\3D-web` 是一个独立的 React 19 + Vite 应用 `sharp-3d-viewer`，
使用 `three` + `@mkkellogg/gaussian-splats-3d` 渲染一张 60 MB 的 Gaussian Splatting 点云
(`image.ply`)，通过滚轮 / 触摸驱动相机沿 CatmullRom 曲线推进，配合自定义光标、loading、
hint、progress、intro box 营造电影感。

需要将其作为 wb showcase 的一个 React 组件集成进去，路由 `/components/gaussian-splat-viewer`。

## 目标

- 保留原 3D-web 的视觉与交互体验(电影感滚动相机、自定义光标、loading/hint/progress/intro 叠层)。
- 符合 wb 的"加组件 = 写 `component.config.ts` + `index.tsx`"零配置约定。
- 自动接入 showcase 的卡片列表、详情路由、manifest、dev watcher。
- 不破坏其他组件(data-table / china-map / button)。

## 非目标

- 重构原 3D-web 的相机路径算法、滚动算法或视觉参数——保留原始 magic numbers。
- 提供可复用的通用 3DGS viewer API——只做 1:1 复刻这一份。
- 单元测试(wb 政策:展示组件不写单测)。
- 提交到 origin——本文档只到 spec + 计划为止,实际代码改动在后续 plan 里执行。

## 关键决策(已与用户确认)

| 决策点 | 选择 |
|---|---|
| 渲染模式 | **full-viewport takeover**(`isolation.mode: 'global'`) |
| ply 资源位置 | `apps/showcase/public/splat/image.ply`(运行时 URL: `/splat/image.ply`) |
| git 策略 | 直接 commit(60 MB .ply + 17 KB .ico),一次性入历史 |
| 组件 id | `gaussian-splat-viewer`(描述技术,留扩展空间) |

## 架构

### 目录结构

```
apps/showcase/public/splat/
├── image.ply                              # 60 MB 高斯泼溅资产(commit)
└── 1.ico                                 # 自定义光标(commit)

packages/react-components/
├── package.json                           # 新增依赖: three, @mkkellogg/gaussian-splats-3d
└── src/gaussian-splat-viewer/
    ├── component.config.ts                # 元数据(id / framework / mount / isolation / deps)
    ├── index.tsx                          # 默认导出 GaussianSplatViewer(编排器)
    ├── index.css                          # 叠层 UI 样式(loading / hint / progress / intro)
    ├── README.md                          # 组件说明 + 替换 ply 的方法
    └── src/                               # 内部模块(仅内部可见,不进 import.meta.glob)
        ├── useScrollProgress.ts           # wheel + touch → 平滑 0..1 进度
        ├── useGaussianScene.ts            # three.js renderer + gaussian-splats-3d viewer 生命周期
        ├── cameraPath.ts                  # CatmullRom 曲线:getPosition(t) / getLookAt(t)
        ├── LoadingScreen.tsx              # 加载动画
        ├── ProgressBar.tsx                # 底部进度条
        └── IntroBox.tsx                   # 终点介绍框
```

`import.meta.glob` 只扫 `index.tsx`,内部 `src/` 子目录不会被打包成 chunk——这是对原
3D-web 平铺结构的最小改动(把所有文件从组件根挪到 `src/`),又保持 wb 的"一个目录 =
一个组件"惯例。

### 配置契约

`component.config.ts` 字段(完整草稿见 §"component.config.ts 草案"):

- `id: 'gaussian-splat-viewer'`(与目录名一致,ESLint 强制)
- `framework: 'react'`(与所在包 `react-components` 一致)
- `mount: { kind: 'react', propsMode: 'default' }`
- `isolation: { mode: 'global', globalStyleReason: '...' }`
  - 必须填 `globalStyleReason`(spec §4.5 强制),文案说明:canvas 挂到 document.body、
    捕获 window 级 wheel/touch、覆盖 body 光标与 overflow
- `dependencies`:
  - `three` `^0.170.0` `sharing: 'component'`(host 不依赖 three)
  - `@mkkellogg/gaussian-splats-3d` `^0.4.7` `sharing: 'component'`
- `capabilities: { fullscreen: true, fullscreenMode: 'viewport' }`
  - 声明组件想要占满整个视口,host 的全屏按钮应触发 viewport 全屏

### 公开组件 API

```ts
// packages/react-components/src/gaussian-splat-viewer/index.tsx
export default function GaussianSplatViewer(props: {
  plyPath?: string;       // 默认 '/splat/image.ply'
  cursorUrl?: string;     // 默认 '/splat/1.ico'
}): JSX.Element;
```

Props 都给默认值,默认即开箱即用,props 主要给将来替换资产用。mount-adapters 注入的
props 来自 `MountContext.props`(目前为空对象),所以 `default` 模式正常工作。

## 运行时行为

### Mount 流程(`ReactMountAdapter.mount()` 之后)

1. `createRoot` 在 host ShadowRoot 的 portal div 上挂载 `GaussianSplatViewer`。
2. 组件立即执行副作用(空 anchor div 也无所谓):
   - 创建 `<canvas>`,**直接 append 到 `document.body`**(全视口渲染,host 容器不是全视口)
   - 设置 `document.body.style.overflow = 'hidden'`(记录旧值以便恢复)
   - 向 `document.head` 注入 `<style>`:
     ```css
     body, body * { cursor: url('/splat/1.ico'), default !important; }
     ```
     标记 `data-gsv-cursor="true"` 方便清理
   - `window.addEventListener('wheel', onWheel, { passive: false })`
   - `window.addEventListener('touchstart' / 'touchmove', onTouch..., { passive: false })`
   - `window.addEventListener('resize', onResize)`
   - 构造 `THREE.PerspectiveCamera(60, w/h, 0.1, 1000)` + `THREE.WebGLRenderer({ antialias: true })`,尺寸取 `window.innerWidth/innerHeight`,`pixelRatio = min(devicePixelRatio, 2)`,把 renderer.domElement 挂到 body 上的 canvas 槽
   - 构造 `GaussianSplats3D.Viewer({ selfDrivenMode: false, renderer, camera, useBuiltInControls: false, sharedMemoryForWorkers: false })`
   - `viewer.addSplatScene('/splat/image.ply', { splatAlphaRemovalThreshold: 5, showLoadingUI: false, position: [0,0,0], rotation: [0,0,1,0] })`,then 回调里 setIsLoaded(true)
3. `useScrollProgress` 把 wheel/touch deltaY 累加并 clamp 到 [0, 1],再用
   `smoothFactor: 0.06` 做指数平滑,RAF 推到 state。
4. `progress` 变化时:若 > 0.02,setShowHint(false)。
5. `isLoaded === true && camera.current !== null` 时启动 RAF 循环:
   - `camera.current.position.copy(defaultPath.getPosition(progress))`
   - `camera.current.lookAt(defaultPath.getLookAt(progress))`
   - `viewer.update()` + `viewer.render()`
6. `progress >= 0.99` 时 `IntroBox` 滑入。

### Unmount 流程(`ReactMountAdapter.unmount()` → `root.unmount()`)

1. `cancelAnimationFrame` 取消相机循环。
2. `window.removeEventListener('wheel' | 'touchstart' | 'touchmove' | 'resize')`。
3. `viewer.dispose()`(如该库提供),`renderer.dispose()`。
4. 把 body 上的 canvas 移除。
5. 把 `document.head` 里带 `data-gsv-cursor="true"` 的 `<style>` 移除。
6. `document.body.style.overflow = 原值`(用 useRef 记录 mount 前的旧值)。
7. host `signal.abort` 路径同样触发,ReactMountAdapter 已监听 abort → root.unmount。

### Hook 实现要点

- **useScrollProgress** 直接复用 3D-web 的实现,默认值:
  `sensitivity: 0.0012`(原 `GaussianViewer` 调用方传的),`touchSensitivity: 0.002`,
  `smoothFactor: 0.06`。`reset` callback 保留(虽然当前不用)。
- **useGaussianScene** 直接复用 3D-web 的实现,但要在 cleanup 里多做两件事:
  `viewer.dispose()`(若 API 存在)、`renderer.dispose()`。原版只 dispose renderer。
- **cameraPath** 直接复用 3D-web 的实现,采样 20 点、首尾 t ∈ [0, 0.32] 的曲线逻辑
  原样保留。原文件叫 `cameraPath.js`(.js 因为 3D-web 是纯 JS),在 wb 里改成 `.ts`
  并添加 `import * as THREE from 'three'` 的显式导入(原来文件隐式依赖全局)。

### 样式规范

- `index.css` 内所有类名以 `sl-gsv-` 前缀(避免与 showcase 其他组件冲突,且
  `style-adoption.ts` 会扫所有 `<style>` 进 ShadowRoot,前缀确保命名空间清晰)。
- 颜色 / 间距用 `--sl-*` token(原 3D-web 是写死的黑/粉,在 wb 里走 token 但保留视觉
  等价:loading screen 背景 = `--sl-color-bg / #1A1A1D`、progress fill = `--sl-color-primary
  / #E6397C`、intro box = `--sl-color-primary`)。允许 fallback 字面量以保持原观感。

### 错误处理

- `viewer.addSplatScene(...)` Promise reject 时:`useGaussianScene` 在内部 catch,
  把 error 写到 `loadError` state 返回给 `index.tsx`;`index.tsx` 检测到
  `loadError` 时渲染 fallback 文本("无法加载高斯泼溅资产,请检查
  `/splat/image.ply` 是否存在"),并隐藏 LoadingScreen / ProgressBar / IntroBox。
  不抛错到 host(否则 ErrorBoundary 会接管,体验更差)。
- WebGL 不可用时:`renderer = new WebGLRenderer(...)` 抛错,组件 mount 失败;
  React error boundary 在 host 侧捕获,显示 ErrorPage。这是已有行为,本组件不额外
  做兼容。

## component.config.ts 草案

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'gaussian-splat-viewer',
  name: 'GaussianSplatViewer',
  title: '3D 高斯泼溅查看器',
  description:
    '基于 three.js + @mkkellogg/gaussian-splats-3d 的滚动驱动电影感 3D 场景查看器,源自 sharp-3d-viewer。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '3D 场景',
  tags: ['three', 'gaussian-splat', '3dgs', 'cinematic', 'scroll-driven', 'fullscreen'],
  status: 'stable',
  route: { path: '/components/gaussian-splat-viewer', title: '3D 高斯泼溅查看器' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: {
    mode: 'global',
    globalStyleReason:
      'Canvas is appended to document.body for true full-viewport rendering; the component captures window-level wheel/touch events and overrides the body cursor / overflow. The host ShadowRoot portal only hosts an empty anchor.',
  },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'viewport' },
  dependencies: [
    { name: 'three', version: '^0.170.0', sharing: 'component' },
    { name: '@mkkellogg/gaussian-splats-3d', version: '^0.4.7', sharing: 'component' },
  ],
} satisfies ComponentConfig;
```

## package.json 改动

`packages/react-components/package.json` 新增依赖:

```json
{
  "dependencies": {
    "@style-library/component-contract": "workspace:*",
    "@mkkellogg/gaussian-splats-3d": "^0.4.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0"
  }
}
```

`apps/showcase/package.json` 不动——本组件的 deps 是 `sharing: 'component'`,Vite 把
three 和 gaussian-splats-3d 打进组件自己的 chunk。

## 验证(端到端)

1. **Lint**:`pnpm lint` 必须 0 error 0 warning,尤其
   `style-library/valid-component-config` 必须过(id 等于目录名、framework 等于
   'react'、`route.path == /components/gaussian-splat-viewer`)。ajv 必须接受 config
   形状。
2. **Dev 自动发现**:`pnpm --filter @style-library/showcase dev`,等 ~8 秒,
   `curl -s http://localhost:5173/__component-manifest.json | grep gaussian-splat-viewer`
   必须出现 `id: "gaussian-splat-viewer"` 条目。
3. **构建**:`pnpm --filter @style-library/showcase build`,
   `ls apps/showcase/dist/assets/ | grep gaussian-splat-viewer` 必须出现
   `rc-gaussian-splat-viewer-*.js` 和对应 CSS 文件。
4. **运行时 smoke 测试**(浏览器打开 `/components/gaussian-splat-viewer`):
   - LoadingScreen 显示 "S H A R P" 文字 + spinner
   - 加载 ~5–30 秒后(60 MB ply)LoadingScreen 淡出
   - body 与 canvas 显示 `1.ico` 自定义光标
   - 滚轮推动相机沿曲线前进
   - 触摸拖动(移动端或 DevTools touch emulation)推动相机
   - 调整窗口大小,相机 aspect + renderer 尺寸同步更新
   - 首次滚动后,"↓ SCROLL TO START ↓" 提示淡出
   - 进度条随进度填充
   - `progress ≥ 0.99` 时 Muse Dash intro box 从右侧滑入
   - 离开详情页再返回:无遗留 canvas、无遗留监听、body overflow 已恢复
5. **chunk size sanity**:`ls -lh apps/showcase/dist/assets/rc-gaussian-splat-viewer-*.js`
   不应包含 60 MB ply(ply 是静态资源,应由 showcase 的 public 静态服务提供,
   `curl -I http://localhost:5173/splat/image.ply` 返回 200)。

不写单元测试(wb 政策:展示组件不写单测)。

## 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| 60 MB ply 加载时间长(5–30 秒) | 用户体验:长时间 loading | LoadingScreen 自带 spinner;后续可加进度事件订阅 |
| `isolation.mode: 'global'` 破坏 wb 隔离惯例 | 与其他 shadow-dom 组件不一致 | 这是 spec 明确允许的 escape hatch(Monaco 也是),且本组件的体验**就是**要全视口 |
| three.js + gaussian-splats-3d 体积大 | 组件 chunk 估计 1–2 MB | 已知代价,功能必需;`sharing: 'component'` 让多个 3DGS 组件之间不共享 |
| Vite 是否能正确打包 three 的 worker | Gaussian Splats 3D 用 web worker | `sharedMemoryForWorkers: false` 避开 SharedArrayBuffer(否则需要 COOP/COEP);需在 dev 上验证 worker 路径 |
| 用户快速进出详情页 | 中途 unmount 导致 viewer 半初始化 | cleanup 路径覆盖 dispose + listener 移除;React StrictMode 双 mount 应也能正常处理 |
| 自定义光标在 shadow root 之外 | 光标不生效 | 已用 `document.head` 注入全局 `<style>` 而非 ShadowRoot style |

## 提交

```bash
git add apps/showcase/public/splat \
        packages/react-components/package.json \
        packages/react-components/src/gaussian-splat-viewer

git commit -m "feat(react-components): add gaussian-splat-viewer

Replicates D:\\DevProjects\\my\\github\\3D-web\\sharp-3d-viewer as a wb
React component. Uses three.js + @mkkellogg/gaussian-splats-3d to render
a scroll-driven cinematic 3DGS scene in full-viewport mode
(isolation.mode: 'global')."
```

## 不在本文档范围内(留给后续 plan)

- 具体的实现步骤、commit 拆分、文件落地顺序——交给 writing-plans skill。
- 是否需要 Storybook / docs 站点条目——暂不创建,README.md 足够。