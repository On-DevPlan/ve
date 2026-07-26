# gaussian-splat-viewer 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `D:\DevProjects\my\github\3D-web\sharp-3d-viewer` 1:1 复刻为 wb showcase 的 React 组件 `gaussian-splat-viewer`,路由 `/components/gaussian-splat-viewer`,通过 lint / manifest / build / 运行时 smoke 验证。

**Architecture:** 单个 React 组件 + 内部 hooks/utils,挂在 `packages/react-components/src/gaussian-splat-viewer/` 下;公开表面只有 `index.tsx` / `component.config.ts` / `index.css` / `README.md`,hooks/utils/子组件放内部 `src/` 子目录。`isolation.mode: 'global'` 让 canvas 挂到 `document.body` 实现全视口渲染。资产放 `apps/showcase/public/splat/`。

**Tech Stack:** React 19 + TypeScript + Vite (wb 现有栈);新增依赖 `three@^0.170.0` + `@mkkellogg/gaussian-splats-3d@^0.4.7`;复用 wb 的 `ReactMountAdapter` / `style-adoption` / 自定义 ESLint 规则。

## 全局约束(摘自 spec)

- **目录名 == 组件 id**:目录必须叫 `gaussian-splat-viewer`。
- **framework == 所在包**:`packages/react-components/` → `framework: 'react'`(ESLint 强制)。
- **route.path == `/components/<id>`**:`route.path` 必须字面量等于 `/components/gaussian-splat-viewer`(ESLint 强制)。
- **isolation.mode == 'global' 时必须填 `globalStyleReason`**(spec §4.5 强制)。
- **不写组件单测**(wb 政策:展示组件不写单测)。
- **不修改 main / master 分支**——所有改动走 feature 分支。
- **Conventional Commits**:`feat(react-components): ...` / `feat(showcase): ...`。
- **依赖 `sharing: 'component'`**:`three` 与 `@mkkellogg/gaussian-splats-3d` 仅本组件需要,`apps/showcase/package.json` 不动。
- **样式类名以 `sl-` 前缀**(`style-adoption.ts` 按 `.sl-` 命名空间过滤);本组件叠层类名用 `sl-gsv-` 前缀避免与现有组件冲突。

## 文件结构(本次新增/修改)

```
新增:
apps/showcase/public/splat/image.ply             (66 MB,从 3D-web 复制,commit)
apps/showcase/public/splat/1.ico                  (17 KB,从 3D-web 复制,commit)
packages/react-components/src/gaussian-splat-viewer/component.config.ts
packages/react-components/src/gaussian-splat-viewer/index.tsx
packages/react-components/src/gaussian-splat-viewer/index.css
packages/react-components/src/gaussian-splat-viewer/README.md
packages/react-components/src/gaussian-splat-viewer/src/useScrollProgress.ts
packages/react-components/src/gaussian-splat-viewer/src/useGaussianScene.ts
packages/react-components/src/gaussian-splat-viewer/src/cameraPath.ts
packages/react-components/src/gaussian-splat-viewer/src/LoadingScreen.tsx
packages/react-components/src/gaussian-splat-viewer/src/ProgressBar.tsx
packages/react-components/src/gaussian-splat-viewer/src/IntroBox.tsx

修改:
packages/react-components/package.json            (新增 three + @mkkellogg/gaussian-splats-3d 依赖)
```

---

## Task 1: 资产复制

**Files:**
- Create: `apps/showcase/public/splat/image.ply` (from `D:\DevProjects\my\github\3D-web\image.ply`)
- Create: `apps/showcase/public/splat/1.ico` (from `D:\DevProjects\my\github\3D-web\1.ico`)

**Interfaces:** 无依赖,后续 Task 假定 `apps/showcase/public/splat/image.ply` 与 `apps/showcase/public/splat/1.ico` 已存在。

- [ ] **Step 1: 创建 splat 目录**

Run (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path "D:\DevProjects\my\github\wb\apps\showcase\public\splat"
```

Expected: 目录已存在(可能为空)。

- [ ] **Step 2: 复制 image.ply**

Run (PowerShell):

```powershell
Copy-Item "D:\DevProjects\my\github\3D-web\image.ply" "D:\DevProjects\my\github\wb\apps\showcase\public\splat\image.ply"
```

Expected: 文件复制成功,大小 ~66 MB。

- [ ] **Step 3: 复制 1.ico**

Run (PowerShell):

```powershell
Copy-Item "D:\DevProjects\my\github\3D-web\1.ico" "D:\DevProjects\my\github\wb\apps\showcase\public\splat\1.ico"
```

Expected: 文件复制成功,大小 ~17 KB。

- [ ] **Step 4: 验证文件可由 dev server 提供**

Run (后台启动 dev server):

```bash
cd /d/DevProjects/my/github/wb && pnpm --filter @style-library/showcase dev
```

等 8 秒,然后:

```bash
curl -I http://localhost:5173/splat/image.ply
curl -I http://localhost:5173/splat/1.ico
```

Expected: 两个 URL 都返回 `HTTP/1.1 200 OK`,Content-Length 与本地文件一致。

- [ ] **Step 5: 停止 dev server**

后台进程用 TaskStop 终止(后续 Task 4 重新启动)。

- [ ] **Step 6: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add apps/showcase/public/splat
git commit -m "feat(showcase): add splat assets for gaussian-splat-viewer

60 MB image.ply Gaussian splat point cloud + 17 KB 1.ico cursor,
sourced from D:\\DevProjects\\my\\github\\3D-web. Served as static
assets at /splat/* by the showcase's public dir."
```

---

## Task 2: package.json 新增依赖

**Files:**
- Modify: `packages/react-components/package.json` (在 `dependencies` 里新增两个包)

**Interfaces:** 后续 Task 3+ 假定 `three` 与 `@mkkellogg/gaussian-splats-3d` 可从 `@style-library/react-components` 的依赖里 import。

- [ ] **Step 1: 编辑 package.json**

读取当前 `packages/react-components/package.json`,在 `dependencies` 里新增两个条目,版本号与原 3D-web 一致:

```json
{
  "dependencies": {
    "@mkkellogg/gaussian-splats-3d": "^0.4.7",
    "@style-library/component-contract": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0"
  }
}
```

注意:`three` 与 `@mkkellogg/gaussian-splats-3d` 放在 `dependencies`(不是 `devDependencies`),因为它们是运行时需要的,ESM `import` 在 build 时由 Vite 打进组件 chunk。

- [ ] **Step 2: 安装依赖**

```bash
cd /d/DevProjects/my/github/wb
pnpm install
```

Expected: 0 error。`node_modules/.pnpm` 下出现 `three@0.170.x` 与 `@mkkellogg.gaussian-splats-3d@0.4.x` 软链。

- [ ] **Step 3: 验证导入可用**

```bash
cd /d/DevProjects/my/github/wb
node -e "console.log(require.resolve('three/package.json')); console.log(require.resolve('@mkkellogg/gaussian-splats-3d/package.json'));"
```

Expected: 两条路径输出,无 MODULE_NOT_FOUND。

- [ ] **Step 4: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add packages/react-components/package.json pnpm-lock.yaml
git commit -m "feat(react-components): add three and gaussian-splats-3d deps

Required runtime deps for gaussian-splat-viewer. Both bundled into
the component's chunk via Vite (sharing: 'component')."
```

---

## Task 3: component.config.ts + 公开表面骨架

**Files:**
- Create: `packages/react-components/src/gaussian-splat-viewer/component.config.ts`
- Create: `packages/react-components/src/gaussian-splat-viewer/index.tsx` (占位,后续 Task 替换)
- Create: `packages/react-components/src/gaussian-splat-viewer/index.css` (空骨架,后续 Task 填充)
- Create: `packages/react-components/src/gaussian-splat-viewer/README.md`

**Interfaces:** 后续 Task 4–6 在 `component.config.ts` 指明的 `./index.tsx` 路径实现真正的组件;Task 4 实现 hooks/utils/子组件。

- [ ] **Step 1: 创建 component.config.ts**

写入 `packages/react-components/src/gaussian-splat-viewer/component.config.ts`:

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

- [ ] **Step 2: 创建占位 index.tsx**

写入 `packages/react-components/src/gaussian-splat-viewer/index.tsx`(占位,后续 Task 6 替换为真实实现):

```tsx
// gaussian-splat-viewer placeholder — replaced in Task 6.
export default function GaussianSplatViewer(): null {
  return null;
}
```

- [ ] **Step 3: 创建空 index.css**

写入 `packages/react-components/src/gaussian-splat-viewer/index.css`:

```css
/* gaussian-splat-viewer overlay styles — populated in Task 7. */
```

- [ ] **Step 4: 创建 README.md**

写入 `packages/react-components/src/gaussian-splat-viewer/README.md`:

````markdown
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

`isolation.mode: 'global'`——canvas 挂到 `document.body` 实现全视口渲染,组件捕获
window 级 wheel / touch 事件,覆盖 body 光标和 overflow。host ShadowRoot 仅放一个
空 anchor。

## 资产

- `apps/showcase/public/splat/image.ply` (66 MB 高斯泼溅)
- `apps/showcase/public/splat/1.ico` (自定义光标)

要替换为其他资产:把新文件放到 `apps/showcase/public/splat/`,在 `component.config.ts`
里把依赖里的 `plyPath` 默认值改为新 URL;或通过 mount props 传入 `plyPath` / `cursorUrl`。
````

- [ ] **Step 5: 跑 lint 验证 config 合法**

```bash
cd /d/DevProjects/my/github/wb
pnpm lint
```

Expected: 0 error 0 warning,尤其 `style-library/valid-component-config` 必须过
(id 等于目录名 `gaussian-splat-viewer`、framework 等于 `react`、
`route.path == /components/gaussian-splat-viewer`)。

- [ ] **Step 6: 启动 dev server 验证 manifest 出现该组件**

```bash
cd /d/DevProjects/my/github/wb
pnpm --filter @style-library/showcase dev
```

后台启动,等 8 秒:

```bash
curl -s http://localhost:5173/__component-manifest.json | grep -E '"id":\s*"gaussian-splat-viewer"'
```

Expected: 输出 `"id":"gaussian-splat-viewer"`。

- [ ] **Step 7: 停止 dev server**

后台进程用 TaskStop 终止。

- [ ] **Step 8: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add packages/react-components/src/gaussian-splat-viewer
git commit -m "feat(react-components): add gaussian-splat-viewer skeleton

Wires component.config.ts + empty index.tsx + README + empty CSS so the
showcase can auto-discover the route. Full implementation follows in
the next tasks."
```

---

## Task 4: 内部 hooks / utils / 子组件(原 3D-web 逻辑)

**Files:**
- Create: `packages/react-components/src/gaussian-splat-viewer/src/useScrollProgress.ts`
- Create: `packages/react-components/src/gaussian-splat-viewer/src/useGaussianScene.ts`
- Create: `packages/react-components/src/gaussian-splat-viewer/src/cameraPath.ts`
- Create: `packages/react-components/src/gaussian-splat-viewer/src/LoadingScreen.tsx`
- Create: `packages/react-components/src/gaussian-splat-viewer/src/ProgressBar.tsx`
- Create: `packages/react-components/src/gaussian-splat-viewer/src/IntroBox.tsx`

**Interfaces:**

```ts
// useScrollProgress.ts
export function useScrollProgress(opts?: {
  sensitivity?: number;        // default 0.0012
  touchSensitivity?: number;   // default 0.002
  smoothFactor?: number;       // default 0.06
}): { progress: number; reset: () => void };

// useGaussianScene.ts
export function useGaussianScene(
  containerRef: React.RefObject<HTMLDivElement>,
  plyPath: string,
): {
  camera: React.RefObject<THREE.PerspectiveCamera>;
  renderer: React.RefObject<THREE.WebGLRenderer>;
  isLoaded: boolean;
  loadError: Error | null;
  render: () => void;
};

// cameraPath.ts
export const defaultPath: {
  getPosition(t: number): THREE.Vector3;
  getLookAt(t: number): THREE.Vector3;
};

// 子组件(纯展示)
export function LoadingScreen(props: { visible: boolean }): JSX.Element;
export function ProgressBar(props: { progress: number }): JSX.Element;
export function IntroBox(props: { visible: boolean }): JSX.Element;
```

- [ ] **Step 1: 实现 cameraPath.ts**

写入 `packages/react-components/src/gaussian-splat-viewer/src/cameraPath.ts`,
内容直接复用原 3D-web 的 `src/utils/cameraPath.js`,改成 `.ts` 并保留 magic numbers:

```ts
import * as THREE from 'three';

// 原始曲线(不要改)
const originalCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, -4),
  new THREE.Vector3(1.5, -0.3, -1),
  new THREE.Vector3(-1, 0.2, 2),
  new THREE.Vector3(0.5, -0.5, 5),
  new THREE.Vector3(0.99, -0.19, -0.15),
]);

// 从原曲线的 0% ~ 32% 精确采样 20 个点
const SAMPLE_COUNT = 20;
const END_T = 0.32;
const sampledPoints: THREE.Vector3[] = [];
for (let i = 0; i <= SAMPLE_COUNT; i++) {
  const t = (i / SAMPLE_COUNT) * END_T;
  sampledPoints.push(originalCurve.getPoint(t));
}

// 用采样点构建新曲线(完美还原原始形状)
const truncatedCurve = new THREE.CatmullRomCurve3(sampledPoints);

export function createCurvePath() {
  return {
    getPosition(t: number): THREE.Vector3 {
      return truncatedCurve.getPoint(t);
    },
    getLookAt(t: number): THREE.Vector3 {
      // 映射回原曲线的 t 范围 [0, 0.32]
      const originalT = t * END_T;
      // 在原曲线上往前看一小段
      const lookT = Math.min(originalT + 0.05, 0.37);
      return originalCurve.getPoint(lookT);
    },
  };
}

export const defaultPath = createCurvePath();
```

- [ ] **Step 2: 实现 useScrollProgress.ts**

写入 `packages/react-components/src/gaussian-splat-viewer/src/useScrollProgress.ts`,
直接复用原 3D-web 的 `src/hooks/useScrollProgress.js`:

```ts
import { useState, useEffect, useRef, useCallback } from 'react';

export function useScrollProgress({
  sensitivity = 0.0012,
  touchSensitivity = 0.002,
  smoothFactor = 0.06,
}: {
  sensitivity?: number;
  touchSensitivity?: number;
  smoothFactor?: number;
} = {}) {
  const targetRef = useRef(0);
  const smoothRef = useRef(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // 滚轮事件
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetRef.current += e.deltaY * sensitivity;
      targetRef.current = Math.max(0, Math.min(1, targetRef.current));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [sensitivity]);

  // 触摸事件
  useEffect(() => {
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      targetRef.current += deltaY * touchSensitivity;
      targetRef.current = Math.max(0, Math.min(1, targetRef.current));
    };
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [touchSensitivity]);

  // 平滑动画循环
  useEffect(() => {
    const tick = () => {
      smoothRef.current += (targetRef.current - smoothRef.current) * smoothFactor;
      setSmoothProgress(smoothRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [smoothFactor]);

  const reset = useCallback(() => {
    targetRef.current = 0;
    smoothRef.current = 0;
    setSmoothProgress(0);
  }, []);

  return { progress: smoothProgress, reset };
}
```

- [ ] **Step 3: 实现 useGaussianScene.ts**

写入 `packages/react-components/src/gaussian-splat-viewer/src/useGaussianScene.ts`,
基于原 3D-web 的 `src/hooks/useGaussianScene.js`,补上 `loadError` state 和
`viewer.dispose()` cleanup:

```ts
import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

export function useGaussianScene(
  containerRef: RefObject<HTMLDivElement>,
  plyPath: string,
) {
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 相机
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Gaussian Splatting Viewer
    const viewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      renderer,
      camera,
      useBuiltInControls: false,
      sharedMemoryForWorkers: false,
    });

    viewer
      .addSplatScene(plyPath, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        position: [0, 0, 0],
        rotation: [0, 0, 1, 0],
      })
      .then(() => {
        viewerRef.current = viewer;
        setIsLoaded(true);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    // 窗口缩放
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      // viewer.dispose 若库提供则调用,否则跳过(用 try/catch 兜底)
      try {
        const maybeDispose = (viewer as { dispose?: () => void }).dispose;
        if (typeof maybeDispose === 'function') maybeDispose.call(viewer);
      } catch {
        /* noop */
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef, plyPath]);

  const render = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.update();
      viewerRef.current.render();
    }
  }, []);

  return {
    camera: cameraRef,
    renderer: rendererRef,
    isLoaded,
    loadError,
    render,
  };
}
```

- [ ] **Step 4: 实现 LoadingScreen.tsx**

写入 `packages/react-components/src/gaussian-splat-viewer/src/LoadingScreen.tsx`,
内容直接复用原 3D-web 的 `src/components/LoadingScreen.jsx`,但类名加 `sl-gsv-`
前缀避免与 showcase 其他组件冲突:

```tsx
import type { JSX } from 'react';

export function LoadingScreen({ visible }: { visible: boolean }): JSX.Element {
  return (
    <div className={`sl-gsv-loading ${!visible ? 'sl-gsv-loading--out' : ''}`}>
      <div className="sl-gsv-loading__title">S H A R P</div>
      <div className="sl-gsv-loading__spinner" />
    </div>
  );
}
```

- [ ] **Step 5: 实现 ProgressBar.tsx**

写入 `packages/react-components/src/gaussian-splat-viewer/src/ProgressBar.tsx`:

```tsx
import type { JSX } from 'react';

export function ProgressBar({ progress }: { progress: number }): JSX.Element {
  const percent = Math.round(progress * 100);
  return (
    <div className="sl-gsv-progress">
      <div className="sl-gsv-progress__track">
        <div className="sl-gsv-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="sl-gsv-progress__text">SCROLL TO EXPLORE · {percent}%</div>
    </div>
  );
}
```

- [ ] **Step 6: 实现 IntroBox.tsx**

写入 `packages/react-components/src/gaussian-splat-viewer/src/IntroBox.tsx`,
直接复用原 3D-web 的 `src/components/IntroBox.jsx`,类名前缀加 `sl-gsv-`:

```tsx
import type { JSX } from 'react';

export function IntroBox({ visible }: { visible: boolean }): JSX.Element {
  return (
    <div className={`sl-gsv-intro ${visible ? 'sl-gsv-intro--visible' : ''}`}>
      <div className="sl-gsv-intro__title">Muse Dash</div>
      <div className="sl-gsv-intro__desc">
        当战斗与演奏间的屏障被打破
        <br />
        你可否听到来自另一个世界的呼唤?
        <br />
        <br />
        Game Starts Now!!
      </div>
      <div className="sl-gsv-intro__tag">★★★</div>
    </div>
  );
}
```

- [ ] **Step 7: TypeScript 检查通过**

```bash
cd /d/DevProjects/my/github/wb
pnpm exec tsc -p packages/react-components/tsconfig.json --noEmit
```

Expected: 0 error。如果报错,优先检查 `useGaussianScene.ts` 的类型签名
(`Viewer` 类型从 `@mkkellogg/gaussian-splats-3d` 导出;若库未提供 dispose 类型,
用 `(viewer as { dispose?: () => void })` 兜底,本计划已采用此写法)。

- [ ] **Step 8: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add packages/react-components/src/gaussian-splat-viewer/src
git commit -m "feat(react-components): add gaussian-splat-viewer internal modules

Ported useScrollProgress, useGaussianScene, cameraPath, LoadingScreen,
ProgressBar, IntroBox from 3D-web/sharp-3d-viewer to TypeScript. Class
names prefixed sl-gsv- to avoid collision with other showcase
components; loadError state added so the orchestrator can render a
fallback when the .ply fails to load."
```

---

## Task 5: index.css 叠层样式

**Files:**
- Modify: `packages/react-components/src/gaussian-splat-viewer/index.css` (Task 3 创建的空骨架,这里填样式)

**Interfaces:** 叠层类名已在 Task 4 固定:`sl-gsv-loading` / `sl-gsv-loading__title` /
`sl-gsv-loading__spinner` / `sl-gsv-progress` / `sl-gsv-progress__track` /
`sl-gsv-progress__fill` / `sl-gsv-progress__text` / `sl-gsv-intro` /
`sl-gsv-intro--visible` / `sl-gsv-intro__title` / `sl-gsv-intro__desc` /
`sl-gsv-intro__tag`。

- [ ] **Step 1: 写入 index.css**

完整替换 `packages/react-components/src/gaussian-splat-viewer/index.css`:

```css
/* gaussian-splat-viewer overlay styles.
   Visual parity with 3D-web/sharp-3d-viewer/src/App.css, but class names
   prefixed sl-gsv- to avoid colliding with other showcase components.
   Colors / spacing use --sl-* tokens with hard-coded fallbacks so the
   viewer keeps its dark cinematic look regardless of host theme. */

/* ---- Loading screen ---- */

.sl-gsv-loading {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--sl-color-bg, #1A1A1D);
  z-index: 100;
  transition: opacity 0.6s ease;
}

.sl-gsv-loading--out {
  opacity: 0;
  pointer-events: none;
}

.sl-gsv-loading__title {
  color: var(--sl-color-text-inverse, #fff);
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 4px;
  margin-bottom: 24px;
}

.sl-gsv-loading__spinner {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--sl-color-text-inverse, #fff);
  border-radius: 50%;
  animation: sl-gsv-spin 1s linear infinite;
}

@keyframes sl-gsv-spin {
  to { transform: rotate(360deg); }
}

/* ---- Progress bar ---- */

.sl-gsv-progress {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sl-gsv-progress__text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  letter-spacing: 2px;
}

.sl-gsv-progress__track {
  width: 200px;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 1px;
  overflow: hidden;
}

.sl-gsv-progress__fill {
  height: 100%;
  background: var(--sl-color-primary, #E6397C);
  border-radius: 1px;
  transition: width 0.1s ease-out;
  box-shadow: 0 0 10px var(--sl-color-primary, #E6397C);
}

/* ---- Scroll hint ---- */

.sl-gsv-hint {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  letter-spacing: 2px;
  animation: sl-gsv-pulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: 10;
  transition: opacity 0.6s ease;
}

@keyframes sl-gsv-pulse {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.8; }
}

/* ---- Intro box ---- */

.sl-gsv-intro {
  position: fixed;
  right: -400px;
  top: 50%;
  transform: translateY(-50%);
  width: 450px;
  padding: 32px;
  background: linear-gradient(135deg, var(--sl-color-primary, #E6397C) 0%, #c92d65 100%);
  border-radius: 24px 0 0 24px;
  z-index: 20;
  opacity: 0;
  transition: right 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease;
  box-shadow: -10px 0 40px rgba(230, 57, 124, 0.4);
}

.sl-gsv-intro--visible {
  right: 0;
  opacity: 1;
}

.sl-gsv-intro__title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 16px;
  letter-spacing: 2px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.sl-gsv-intro__desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.8;
  letter-spacing: 1px;
}

.sl-gsv-intro__tag {
  display: inline-block;
  margin-top: 20px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 12px;
  color: #fff;
  backdrop-filter: blur(10px);
}

/* ---- Error fallback ---- */

.sl-gsv-error {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  letter-spacing: 2px;
  text-align: center;
  padding: 24px;
  z-index: 100;
}
```

- [ ] **Step 2: 确认文件结构**

```bash
cd /d/DevProjects/my/github/wb
ls -la packages/react-components/src/gaussian-splat-viewer/index.css
```

Expected: 文件存在,行数 ~140。

- [ ] **Step 3: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add packages/react-components/src/gaussian-splat-viewer/index.css
git commit -m "feat(react-components): add gaussian-splat-viewer overlay styles

Visual parity with 3D-web App.css: loading screen, progress bar, scroll
hint, intro box, error fallback. Class names prefixed sl-gsv-; colors
spaced via --sl-* tokens with cinematic dark fallbacks."
```

---

## Task 6: 主组件 index.tsx(编排器)

**Files:**
- Modify: `packages/react-components/src/gaussian-splat-viewer/index.tsx` (替换 Task 3 的占位)

**Interfaces:**

```tsx
export default function GaussianSplatViewer(props?: {
  plyPath?: string;     // default '/splat/image.ply'
  cursorUrl?: string;   // default '/splat/1.ico'
}): JSX.Element;
```

- [ ] **Step 1: 替换 index.tsx**

完整替换 `packages/react-components/src/gaussian-splat-viewer/index.tsx`:

```tsx
// gaussian-splat-viewer — full-viewport 3D Gaussian splat viewer.
//
// Architecture (see spec):
//   - Renders into a host ShadowRoot portal (one empty <div>) provided by
//     ReactMountAdapter, but the actual <canvas> is appended directly to
//     document.body for true full-viewport rendering.
//   - Captures window-level wheel + touch events; overrides body cursor
//     and overflow via document.head <style>.
//   - All side effects are reverted on unmount so re-mounting is clean.

import './index.css';
import { useRef, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useGaussianScene } from './src/useGaussianScene';
import { useScrollProgress } from './src/useScrollProgress';
import { defaultPath } from './src/cameraPath';
import { LoadingScreen } from './src/LoadingScreen';
import { ProgressBar } from './src/ProgressBar';
import { IntroBox } from './src/IntroBox';

const DEFAULT_PLY = '/splat/image.ply';
const DEFAULT_CURSOR = '/splat/1.ico';
const CURSOR_STYLE_ATTR = 'data-gsv-cursor';

export default function GaussianSplatViewer(
  props: { plyPath?: string; cursorUrl?: string } = {},
): JSX.Element {
  const plyPath = props.plyPath ?? DEFAULT_PLY;
  const cursorUrl = props.cursorUrl ?? DEFAULT_CURSOR;

  // host ShadowRoot portal — used by ReactMountAdapter as the React root
  const containerRef = useRef<HTMLDivElement>(null);

  // body-appended canvas + scroll state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousOverflowRef = useRef<string>('');
  const cursorStyleRef = useRef<HTMLStyleElement | null>(null);
  const [showHint, setShowHint] = useState(true);

  const { camera, isLoaded, loadError, render } = useGaussianScene(containerRef, plyPath);
  const { progress } = useScrollProgress({
    sensitivity: 0.0012,
    smoothFactor: 0.06,
  });

  // 全视口 canvas + 光标 / overflow 副作用
  useEffect(() => {
    // 1. body 接管 overflow
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 2. body-attached canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '0';
    canvas.style.display = 'block';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    // 3. 自定义光标(注入 document.head,而不是 ShadowRoot,因为光标生效范围
    //    超出组件容器)
    const style = document.createElement('style');
    style.setAttribute(CURSOR_STYLE_ATTR, 'true');
    style.textContent = `body, body * { cursor: url('${cursorUrl}'), default !important; }`;
    document.head.appendChild(style);
    cursorStyleRef.current = style;

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
      if (canvasRef.current && document.body.contains(canvasRef.current)) {
        document.body.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
      if (cursorStyleRef.current && document.head.contains(cursorStyleRef.current)) {
        document.head.removeChild(cursorStyleRef.current);
        cursorStyleRef.current = null;
      }
    };
  }, [cursorUrl]);

  // 滚动后隐藏 hint
  useEffect(() => {
    if (progress > 0.02) setShowHint(false);
  }, [progress]);

  // RAF 相机循环
  useEffect(() => {
    if (!isLoaded || !camera.current) return;

    let rafId = 0;
    const animate = () => {
      const position = defaultPath.getPosition(progress);
      const lookAt = defaultPath.getLookAt(progress);
      camera.current!.position.copy(position);
      camera.current!.lookAt(lookAt);
      render();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isLoaded, progress, camera, render]);

  // 错误 fallback
  if (loadError) {
    return (
      <div className="sl-gsv-error">
        无法加载高斯泼溅资产,请检查 {plyPath} 是否存在。
        <br />
        {loadError.message}
      </div>
    );
  }

  return (
    <>
      <LoadingScreen visible={!isLoaded} />
      {/* useGaussianScene 把 renderer.domElement append 到这个 div;
          canvas 实际已经挂到 body 上,所以这个 div 在视觉上是空的 */}
      <div ref={containerRef} style={{ display: 'none' }} />
      {isLoaded && <ProgressBar progress={progress} />}
      {isLoaded && showHint && (
        <div className="sl-gsv-hint">↓ SCROLL TO START ↓</div>
      )}
      {isLoaded && <IntroBox visible={progress >= 0.99} />}
    </>
  );
}
```

注意:`useGaussianScene` 把 `renderer.domElement` append 到 `containerRef.current`,
但视觉上 canvas 已经挂到 body——本组件用 `display: 'none'` 隐藏这个 div,保留
three.js 的 DOM 引用图完整性,不让 viewer 的内部 `container.contains(...)` 检查失败。

- [ ] **Step 2: TypeScript 检查通过**

```bash
cd /d/DevProjects/my/github/wb
pnpm exec tsc -p packages/react-components/tsconfig.json --noEmit
```

Expected: 0 error。

- [ ] **Step 3: 跑 lint**

```bash
cd /d/DevProjects/my/github/wb
pnpm lint
```

Expected: 0 error 0 warning。

- [ ] **Step 4: Commit**

```bash
cd /d/DevProjects/my/github/wb
git add packages/react-components/src/gaussian-splat-viewer/index.tsx
git commit -m "feat(react-components): implement gaussian-splat-viewer orchestrator

Full-viewport canvas via document.body append + window-level
wheel/touch capture + custom cursor injected into document.head.
Cleanup removes canvas, cursor style, and restores body overflow on
unmount. Falls back to a readable error message when the .ply fails
to load instead of throwing to the host error boundary."
```

---

## Task 7: 端到端验证

**Files:** 无新增/修改文件,只跑命令。

- [ ] **Step 1: 全量 lint**

```bash
cd /d/DevProjects/my/github/wb
pnpm lint
```

Expected: 0 error 0 warning。

- [ ] **Step 2: 全量构建**

```bash
cd /d/DevProjects/my/github/wb
pnpm --filter @style-library/showcase build
```

Expected: 0 error,0 warning。控制台无 "Failed to resolve" 或 "Could not load"
相关 three / gaussian-splats-3d 报错。

- [ ] **Step 3: 检查组件 chunk 生成**

```bash
cd /d/DevProjects/my/github/wb
ls -lh apps/showcase/dist/assets/ | grep gaussian-splat-viewer
```

Expected: 至少 `rc-gaussian-splat-viewer-*.js` 一个文件,**不**包含 60 MB ply
(ply 是静态资源,不走 JS chunk)。

- [ ] **Step 4: 检查 manifest 包含组件**

```bash
cd /d/DevProjects/my/github/wb
cat apps/showcase/dist/component-manifest.json | grep -E '"id":\s*"gaussian-splat-viewer"'
```

Expected: 出现该 id。

- [ ] **Step 5: 启动 dev server**

```bash
cd /d/DevProjects/my/github/wb
pnpm --filter @style-library/showcase dev
```

后台启动。

- [ ] **Step 6: 检查 manifest 出现在 dev**

```bash
curl -s http://localhost:5173/__component-manifest.json | grep -E '"id":\s*"gaussian-splat-viewer"'
```

Expected: 输出 `"id":"gaussian-splat-viewer"`。

- [ ] **Step 7: 检查静态资源可由 dev 提供**

```bash
curl -I http://localhost:5173/splat/image.ply
curl -I http://localhost:5173/splat/1.ico
```

Expected: 两个都返回 200,Content-Length 与文件实际大小一致(image.ply ~66 MB,
1.ico ~17 KB)。

- [ ] **Step 8: 浏览器手动 smoke 测试**

在 IDE 打开的 `package.json` 旁启动浏览器(用 `/browse` skill 或人工):

1. 打开 `http://localhost:5173/components/gaussian-splat-viewer`
2. 验证 LoadingScreen 显示 "S H A R P" + spinner
3. 等 ~5–30 秒,LoadingScreen 淡出
4. 验证 body 与 canvas 显示自定义 `1.ico` 光标
5. 滚动鼠标 → 相机沿曲线推进,progress bar 填充
6. 进度 ≥ 99% → 右侧滑入 Muse Dash intro box
7. DevTools Console 无报错
8. 返回首页 → 重新进入,确认无残留 canvas / 监听器 / 样式

记录任何问题,回到对应 Task 修复后重跑本 Step。

- [ ] **Step 9: 停止 dev server**

TaskStop 后台进程。

- [ ] **Step 10: 最终汇总 commit(如无新修改则跳过)**

如果前面 Task 没产生新 commit,本 Task 也没改文件,无需 commit。如果 Step 8 修过
bug,在 bug fix 上单独 commit(沿用 Conventional Commits)。

---

## 自审

1. **Spec 覆盖**:
   - 资产位置 ✓ Task 1
   - package.json 依赖 ✓ Task 2
   - component.config.ts ✓ Task 3
   - hooks / utils / 子组件从原 3D-web 移植 ✓ Task 4
   - 叠层样式 ✓ Task 5
   - 编排器(mount/unmount 副作用)✓ Task 6
   - 端到端验证 ✓ Task 7
2. **占位符扫描**:没有 TBD / TODO / "implement later" / "类似 Task N";每个 Step 都给了具体的命令 / 代码块。
3. **类型一致性**:`useScrollProgress` / `useGaussianScene` / `defaultPath` / `LoadingScreen` / `ProgressBar` / `IntroBox` 的签名在 Task 4 固定,Task 6 直接 import 并按签名使用,无重命名或参数不一致。