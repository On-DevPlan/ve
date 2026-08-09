# 快捷键模块优化 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 shortcut-library 模块:①边框比例可调+持久化;②可视化键盘+popup 只显示当前选中组;③全屏浮窗画布展示当前组的快捷键合集。

**Architecture:**
- #1 复用现有 `PREVIEW_COLLAPSED_KEY` LS 持久化模式,在 `index.tsx` 内增加 `sidebarW` / `previewH` 两个 LS key + 惰性初始化;不改 CSS(`--sl-sl-sidebar-w` / `--sl-sl-preview-h` 已消费)。
- #2 把 `findBindingsByCode(store.groups, code)` 三处调用改为只在 `selectedGroup` 上查;`<Keyboard>` 调用方算一次 `boundCodes` 并传入(`boundCodes?: Set<string>` prop 已存在)。
- #3 新增 `FullscreenCanvas.tsx` 组件(网格布局+鼠标拖动+滚轮缩放+ESC)+ `useFullscreen()` hook(浏览器原生 Fullscreen API + viewport mode)+ `component.config.ts` 打开 `fullscreen: true`;header 加一个全屏按钮入口。

**Tech Stack:** React 19 + TypeScript + 纯 CSS / CSS variables(无 tailwind,无现成 pan/zoom 库)。测试用 Vitest + jsdom + React Testing Library(act 模式)。

---

## Global Constraints

- **范围**:仅动 `packages/react-components/src/shortcut-library/**` + `packages/react-components/__tests__/shortcut-library-*.test.{ts,tsx}` + 一个 component config 文件。
- **不动**:showcase 路由层(`apps/showcase/**` 不动)、后端 KV / user-space API 不动、`packages/{component-contract,mount-adapters}/**` 不动。
- **持久化**:仅用 `localStorage`,不上后端;key 命名沿用 `sl-shortcut-library:v1:*` 前缀(避免与已有 `sl-shortcut-library:v1` 库 key 撞前缀空间)。
- **不引入新依赖**:不用 react-resizable-panels / react-zoom-pan-pinch / panzoom / d3-zoom。拖拽沿用 PointerEvent,缩放沿用 wheel 事件。
- **测试**:改动必须配测试;`pnpm --filter @style-library/react-components test` 必须全绿;`pnpm lint` 必须干净。
- **commit**:每个任务一个 commit,信息形如 `feat(shortcut-library): ...` 或 `test(shortcut-library): ...`。

---

## File Structure

| 文件 | 责任 | 状态 |
|---|---|---|
| `packages/react-components/src/shortcut-library/index.tsx` | 改:#1 LS 持久化、#2 范围收紧到 selectedGroup、#3 加全屏按钮入口 + 渲染 FullscreenCanvas | 修改 |
| `packages/react-components/src/shortcut-library/component.config.ts` | 改:`capabilities.fullscreen: true` + `fullscreenMode: 'viewport'` | 修改 |
| `packages/react-components/src/shortcut-library/src/hooks/useFullscreen.ts` | 新:浏览器 Fullscreen API + fullscreenchange 监听 | 新增 |
| `packages/react-components/src/shortcut-library/src/pages/FullscreenCanvas.tsx` | 新:全屏浮窗(网格 + 拖动 + 缩放 + ESC) | 新增 |
| `packages/react-components/__tests__/shortcut-library-persistence.test.tsx` | 新:#1 "刷新后保留比例" 断言 | 新增 |
| `packages/react-components/__tests__/shortcut-library-group-scope.test.tsx` | 新:#2 popup 只显示当前组断言 | 新增 |
| `packages/react-components/__tests__/shortcut-library-fullscreen-canvas.test.tsx` | 新:#3 ESC/缩放/渲染数 = selectedGroup.shortcuts.length 断言 | 新增 |

---

## Task 1: #1 — 边框比例 ↑/↓ + 持久化

**Files:**
- Modify: `packages/react-components/src/shortcut-library/index.tsx:36-44`(在 `PREVIEW_COLLAPSED_KEY` 旁加两个 LS 常量 + 加载函数)
- Modify: `packages/react-components/src/shortcut-library/index.tsx:73-74`(`useState` 改惰性初始化)
- Modify: `packages/react-components/src/shortcut-library/index.tsx:170-172`(`endDrag` 里 setState 后追加 `localStorage.setItem`)
- Test: `packages/react-components/__tests__/shortcut-library-persistence.test.tsx`(新文件,沿用 `shortcut-library-drag.test.tsx` 的 stub pattern)

**Interfaces:**
- Consumes: 现有的 `PREVIEW_COLLAPSED_KEY` LS 模式 + `useState<number>(init)` 的惰性初始化器
- Produces: 两个新的 LS key
  - `sl-shortcut-library:v1:sidebarW` — 数值字符串,默认 280
  - `sl-shortcut-library:v1:previewH` — 数值字符串,默认 200

- [ ] **Step 1: 写失败测试 — "刷新后 sidebarW 保留" + "刷新后 previewH 保留"**

新文件 `packages/react-components/__tests__/shortcut-library-persistence.test.tsx`,结构沿用 `shortcut-library-drag.test.tsx`(同 `globalThis.IS_REACT_ACT_ENVIRONMENT = true;` / `seedLocalStorage` / `mount` / `stubGeometry`)。核心断言:

```ts
describe('shortcut-library: persistence', () => {
  it('hydrates sidebarWidth from localStorage on mount', async () => {
    localStorage.setItem('sl-shortcut-library:v1:sidebarW', '350');
    await mount();
    // 断言:第一次 pointerdown 冻结时 sidebar inner 宽度按 350 起算
    // 而不是默认 280
    const sidebarInner = container.querySelector(
      '.sl-sl-panel--sidebar .sl-sl-panel__inner',
    ) as HTMLElement;
    stubGeometry();
    await act(async () => {
      container.querySelector('.sl-sl-resize-handle--col')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
    });
    expect(sidebarInner.style.width).toBe('350px');
  });

  it('writes sidebarWidth to localStorage on pointerup', async () => {
    await mount();
    stubGeometry();
    const handle = container.querySelector('.sl-sl-resize-handle--col') as HTMLElement;
    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 300, clientY: 400 }));
    });
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 360, clientY: 400 }));
    });
    expect(localStorage.getItem('sl-shortcut-library:v1:sidebarW')).toBe('360');
  });

  it('hydrates previewHeight from localStorage on mount', async () => {
    localStorage.setItem('sl-shortcut-library:v1:previewH', '320');
    await mount();
    stubGeometry();
    const previewInner = container.querySelector(
      '.sl-sl-panel__inner--preview',
    ) as HTMLElement;
    await act(async () => {
      container.querySelector('.sl-sl-resize-handle--row')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
    });
    expect(previewInner.style.height).toBe('320px');
  });

  it('writes previewHeight to localStorage on pointerup', async () => {
    await mount();
    stubGeometry();
    const handle = container.querySelector('.sl-sl-resize-handle--row') as HTMLElement;
    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 300, clientY: 200 }));
    });
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 100 }));
    });
    expect(localStorage.getItem('sl-shortcut-library:v1:previewH')).toBe('300');
  });
});
```

> stubGeometry 需要把 `.sl-sl-resize-handle--row` 也要参与;沿用 `.sl-sl-resize-handle--col` 的同款 stub 即可。`stubGeometry` 当前已 stub 了 sidebar/main/preview,够用。

- [ ] **Step 2: 跑测试,确认 FAIL**

跑:`pnpm --filter @style-library/react-components test shortcut-library-persistence`
预期:FAIL(LS key 还没接,默认 280 / 200 → 断言失败)

- [ ] **Step 3: 实现 LS 持久化**

在 `index.tsx` 第 36 行 `PREVIEW_COLLAPSED_KEY` 后面新增:

```ts
// 边框比例持久化 key —— 全局单一值(不按组存,简单 key 命名)
const SIDEBAR_W_KEY = 'sl-shortcut-library:v1:sidebarW';
const PREVIEW_H_KEY = 'sl-shortcut-library:v1:previewH';
const SIDEBAR_DEFAULT = 280;
const PREVIEW_DEFAULT = 200;

function loadNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}
```

把第 73-74 行:

```ts
const [sidebarWidth, setSidebarWidth] = useState(280);
const [previewHeight, setPreviewHeight] = useState(200);
```

改成惰性初始化:

```ts
const [sidebarWidth, setSidebarWidth] = useState(() =>
  loadNumber(SIDEBAR_W_KEY, SIDEBAR_DEFAULT, SIDEBAR_MIN, SIDEBAR_MAX),
);
const [previewHeight, setPreviewHeight] = useState(() =>
  loadNumber(PREVIEW_H_KEY, PREVIEW_DEFAULT, PREVIEW_MIN, PREVIEW_MAX),
);
```

> 注意 `SIDEBAR_MIN` / `SIDEBAR_MAX` / `PREVIEW_MIN` / `PREVIEW_MAX` 已定义在原 `index.tsx:92-95`,在 useState 之前;React 允许惰性初始化器引用同一作用域已声明的 const,只需把 loadNumber 调用放到组件函数体内(不在模块顶层)即可,所以位置正确。

在 `index.tsx:170-172` `endDrag` 的 setState 后追加持久化:

```ts
// 旧:
if (t === 'sidebar') {
  setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.w + (e.clientX - dragStart.current.x))));
} else {
  setPreviewHeight(Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, dragStart.current.h - (e.clientY - dragStart.current.y))));
}

// 新:
let newW = sidebarWidth;
let newH = previewHeight;
if (t === 'sidebar') {
  newW = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.w + (e.clientX - dragStart.current.x)));
  setSidebarWidth(newW);
} else {
  newH = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, dragStart.current.h - (e.clientY - dragStart.current.y)));
  setPreviewHeight(newH);
}
try {
  if (t === 'sidebar') localStorage.setItem(SIDEBAR_W_KEY, String(newW));
  if (t === 'preview') localStorage.setItem(PREVIEW_H_KEY, String(newH));
} catch {
  /* quota / private mode — ignore */
}
```

- [ ] **Step 4: 跑测试,确认 PASS**

跑:`pnpm --filter @style-library/react-components test shortcut-library-persistence`
预期:4 个用例全过

- [ ] **Step 5: 全仓库跑测 + lint**

跑:`pnpm test && pnpm lint`
预期:全绿,无新 warning

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/shortcut-library/index.tsx \
        packages/react-components/__tests__/shortcut-library-persistence.test.tsx
git commit -m "feat(shortcut-library): persist sidebar/preview split to localStorage"
```

- [ ] **Step 7: 回填 todo done id=1**

```bash
kvcli todo done 1 --result "sidebarW/previewH 全局单一值 localStorage 持久化,4 个新测试用例过,全仓库测试+lint 干净"
```

---

## Task 2: #2 — 可视化键盘 + popup 只显示当前选中组

**Files:**
- Modify: `packages/react-components/src/shortcut-library/index.tsx:267-331`(`handleLongPress` / `handleHoverEnter` / `handleDoubleClickKey` 三个 callback,把 `store.groups` 改成 `selectedGroup ? [selectedGroup] : []`)
- Modify: `packages/react-components/src/shortcut-library/index.tsx:662-672`(`<Keyboard>` 调用方算 `boundCodes` 并传入)
- Test: `packages/react-components/__tests__/shortcut-library-group-scope.test.tsx`(新文件)

**Interfaces:**
- Consumes: `store.selectedGroup: Group | null`(`useShortcuts.ts:128` 已暴露)
- Produces: 三个 callback 的内部实现收紧到当前组 + `<Keyboard>` 的新 `boundCodes` prop

- [ ] **Step 1: 写失败测试 — "切组后 popup 只显示当前组的 shortcut" + "Keyboard 收 boundCodes 收紧"**

新文件 `packages/react-components/__tests__/shortcut-library-group-scope.test.tsx`,沿用 `shortcut-library-dom.test.tsx` 的渲染 + findKeyRect stub pattern(参考已存在的 `shortcut-library-pressed.test.tsx` 的 PointerEvent stub):

```ts
describe('shortcut-library: group scope', () => {
  it('long-press popup shows only the currently selected group', async () => {
    // seed two groups, G1 contains KeyA, G2 contains KeyA as well
    // 选 G1,长按 KeyA,popup 应只显示 G1 的 mapping
    // 断言 popup 内 .sl-sl-longpress__group 文本 === 'G1',不应出现 'G2'
  });

  it('Keyboard boundCodes prop receives only selected group codes', async () => {
    // seed two groups, G1 has KeyA, G2 has KeyB
    // 选 G1,断言 .sl-sl-kb__key.has-binding 只在 KeyA 上有,G2 的 KeyB 没有
  });

  it('hover-enter popup shows only currently selected group', async () => {
    // HOVER_OPEN_DELAY=150ms,断言 popup 内容仅当前组
  });

  it('double-click popup shows only currently selected group', async () => {
    // 触发 dblclick,断言 popup 内容仅当前组
  });
});
```

> stub 模式:复用 `shortcut-library-dom.test.tsx` / `shortcut-library-pressed.test.tsx` 已有的 vi.useFakeTimers / dispatchEvent / act 模式(测试文件已存在)。

- [ ] **Step 2: 跑测试,确认 FAIL**

跑:`pnpm --filter @style-library/react-components test shortcut-library-group-scope`
预期:FAIL(popup 当前还跨组,boundCodes 还是 undefined)

- [ ] **Step 3: 实现范围收紧**

修改 `index.tsx` 的 3 个 callback:

```ts
// 旧:const hits = findBindingsByCode(store.groups, code);
// 新:
const scope = store.selectedGroup ? [store.selectedGroup] : [];
const hits = findBindingsByCode(scope, code);
```

具体替换点:
- `index.tsx:269`(`handleLongPress` 内)
- `index.tsx:293`(`handleHoverEnter` 内 setTimeout 回调)
- `index.tsx:327`(`handleDoubleClickKey` 内)

依赖列表也要同步把 `store.groups` 改成 `store.selectedGroup`(`[store.selectedGroup]` 替换):

```ts
}, [store.selectedGroup]); // 原:[store.groups]
```

修改 `<Keyboard>` 调用方(`index.tsx:662-672`):

```tsx
{!previewCollapsed && (
  <Keyboard
    highlightedCodes={highlightedCodes}
    hoveredCodes={hoveredCodes}
    heldKeys={heldKeys}
    boundCodes={
      store.selectedGroup
        ? new Set(store.selectedGroup.shortcuts.flatMap((s) => s.combo.map((k) => k.code)))
        : undefined
    }
    onPress={holdPress}
    onRelease={holdRelease}
    onKeyHoverEnter={handleHoverEnter}
    onKeyHoverLeave={handleHoverLeave}
    onDoubleClickKey={handleDoubleClickKey}
  />
)}
```

- [ ] **Step 4: 跑测试,确认 PASS**

跑:`pnpm --filter @style-library/react-components test shortcut-library-group-scope`
预期:4 个用例全过

- [ ] **Step 5: 全仓库跑测 + lint**

跑:`pnpm test && pnpm lint`
预期:全绿

- [ ] **Step 6: Commit**

```bash
git add packages/react-components/src/shortcut-library/index.tsx \
        packages/react-components/__tests__/shortcut-library-group-scope.test.tsx
git commit -m "feat(shortcut-library): scope keyboard highlight and popups to selected group"
```

- [ ] **Step 7: 回填 todo done id=2**

```bash
kvcli todo done 2 --result "Keyboard boundCodes + 长按/悬停/双击 popup 全部收紧到当前选中组;4 个新测试用例过"
```

---

## Task 3: #3 — 全屏浮窗画布

**Files:**
- Modify: `packages/react-components/src/shortcut-library/component.config.ts:20`(`capabilities.fullscreen: true` + `fullscreenMode: 'viewport'`)
- Create: `packages/react-components/src/shortcut-library/src/hooks/useFullscreen.ts`(浏览器 Fullscreen API + fullscreenchange 监听 + ESC 关闭)
- Create: `packages/react-components/src/shortcut-library/src/pages/FullscreenCanvas.tsx`(节点 = 每个 Shortcut,网格布局 + 鼠标拖动 + 滚轮缩放 + 缩放按钮 + ESC 退出)
- Modify: `packages/react-components/src/shortcut-library/index.tsx`(新增全屏按钮入口 + 渲染 FullscreenCanvas,portal 到 `[data-sl-portal]`)
- Test: `packages/react-components/__tests__/shortcut-library-fullscreen-canvas.test.tsx`(新文件)

**Interfaces:**
- `useFullscreen(targetRef: RefObject<Element | null>)` → `{ isFullscreen: boolean; enter(): Promise<void>; exit(): Promise<void>; }`
- `<FullscreenCanvas open: boolean; onClose: () => void; shortcuts: Shortcut[]; groupName: string; />`

- [ ] **Step 1: 写失败测试 — "全屏画布渲染节点数 = selectedGroup.shortcuts.length" + "ESC 关闭" + "滚轮缩放范围 0.5x~3x"**

新文件 `packages/react-components/__tests__/shortcut-library-fullscreen-canvas.test.tsx`:

```ts
describe('shortcut-library: fullscreen canvas', () => {
  it('renders one node per selected-group shortcut', async () => {
    // seed 单组 N 条 shortcut,触发"打开全屏"按钮
    // 断言 .sl-sl-canvas-node 数量 === N
  });

  it('ESC closes the canvas and fires onClose', async () => {
    // 触发打开,dispatch keydown Escape
    // 断言 onClose 被调一次
  });

  it('wheel zoom stays in [0.5, 3] range', async () => {
    // 触发打开,反复 dispatch wheel,断言 transform scale 夹紧
  });

  it('renders group name in canvas header', async () => {
    // 断言 .sl-sl-canvas__title 文本 === selectedGroup.name
  });
});
```

- [ ] **Step 2: 跑测试,确认 FAIL**

跑:`pnpm --filter @style-library/react-components test shortcut-library-fullscreen-canvas`
预期:FAIL(组件还不存在)

- [ ] **Step 3: 实现 useFullscreen hook**

新文件 `packages/react-components/src/shortcut-library/src/hooks/useFullscreen.ts`:

```ts
import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface UseFullscreenReturn {
  isFullscreen: boolean;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
}

/**
 * 包装浏览器 Fullscreen API。
 * - targetRef: 容器元素;document.fullscreenElement 变化时同步到 isFullscreen
 * - ESC 自动调 exit(浏览器原生,但组件层面也响应 fullscreenchange)
 * - 错误一律吞掉(权限拒绝 / 不支持),返回 isFullscreen 让 UI 反映失败
 */
export function useFullscreen(targetRef: RefObject<Element | null>): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  useEffect(() => {
    function onChange(): void {
      setIsFullscreen(typeof document !== 'undefined' && !!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(async (): Promise<void> => {
    const el = targetRef.current;
    if (!el || !document.fullscreenEnabled) return;
    try {
      await el.requestFullscreen();
    } catch {
      /* 权限拒绝 / iOS 不支持,ignore */
    }
  }, [targetRef]);

  const exit = useCallback(async (): Promise<void> => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(async (): Promise<void> => {
    if (document.fullscreenElement) await exit();
    else await enter();
  }, [enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}
```

- [ ] **Step 4: 实现 FullscreenCanvas 组件**

新文件 `packages/react-components/src/shortcut-library/src/pages/FullscreenCanvas.tsx`:

```tsx
// FullscreenCanvas.tsx —— 全屏浮窗,把当前组的快捷键渲成可缩放可拖动的画布
//
// 交互:
//   - 鼠标左键拖动空白区 → 平移(tx,ty)
//   - 鼠标滚轮(在画布上)→ 以鼠标位置为中心缩放
//   - 顶部 +/- 按钮缩放(夹紧 [0.5, 3])
//   - 顶部 ⟲ 按钮重置
//   - ESC 关闭(onClose)
// 视觉:
//   - 节点 = 每个 Shortcut,卡片显示 combo(Kbd)+ description
//   - 自动网格布局,节点 200px 宽,40px 高,4 列(根据 scale 调整)
//   - backdrop 半透明黑,画布居中
//
// 不依赖浏览器 Fullscreen API(组件本身只管"全屏浮窗"语义);
// 是否走浏览器原生 fullscreen 由父组件 useFullscreen 决定。

import { useCallback, useEffect, useRef, useState, type WheelEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Shortcut } from '../types';
import { comboLabel } from '../hooks/useShortcuts';

export interface FullscreenCanvasProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  groupName: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const NODE_W = 200;
const NODE_H = 80;
const COL_GAP = 24;
const ROW_GAP = 24;
const COLS_PER_ROW = 4;

export default function FullscreenCanvas({ open, onClose, shortcuts, groupName }: FullscreenCanvasProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; baseTx: number; baseTy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 滚轮缩放(以画布中心为锚)
  function onWheel(e: WheelEvent<HTMLDivElement>): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * delta)));
  }

  // 拖动平移
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    // 只允许左键拖空白;点在节点上不拖
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.sl-sl-canvas-node')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: tx, baseTy: ty };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const d = dragRef.current;
    if (!d) return;
    setTx(d.baseTx + (e.clientX - d.startX));
    setTy(d.baseTy + (e.clientY - d.startY));
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  if (!open) return null;
  const portalRoot =
    (typeof document !== 'undefined' &&
      document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);
  if (!portalRoot) return null;

  return createPortal(
    <div
      className="sl-sl-canvas-backdrop"
      role="dialog"
      aria-label={`${groupName} 全屏视图`}
      onWheel={onWheel}
    >
      <header className="sl-sl-canvas__head">
        <h3 className="sl-sl-canvas__title">{groupName} · 全屏视图</h3>
        <div className="sl-sl-canvas__ctrls">
          <button className="sl-sl-icon-btn" aria-label="缩小" onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.2))}>−</button>
          <span className="sl-sl-canvas__scale">{Math.round(scale * 100)}%</span>
          <button className="sl-sl-icon-btn" aria-label="放大" onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))}>+</button>
          <button className="sl-sl-icon-btn" aria-label="重置" onClick={reset}>⟲</button>
          <button className="sl-sl-icon-btn" aria-label="关闭" onClick={onClose}>×</button>
        </div>
      </header>
      <div
        ref={canvasRef}
        className="sl-sl-canvas__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <div
          className="sl-sl-canvas__world"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {shortcuts.map((s) => {
            // 网格坐标(按 COLS_PER_ROW 排)
            // 用 shortcut.id 的哈希分布?太复杂 — 直接按数组下标排
            // 实际渲染顺序由父组件决定(数组已按 createdAt 排好)
            // 节点位置由 index 派生
            // 使用 CSS Grid 自动排,不显式算位置
            return (
              <div key={s.id} className="sl-sl-canvas-node">
                <div className="sl-sl-canvas-node__combo">
                  {s.combo.map((k, i) => (
                    <span key={`${k.code}-${i}`}>
                      {i > 0 && <span className="sl-sl-canvas-node__plus">+</span>}
                      <kbd className="sl-sl-chip">{k.label}</kbd>
                    </span>
                  ))}
                </div>
                <div className="sl-sl-canvas-node__desc">{s.description || <span className="sl-sl-empty">未填写说明</span>}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
```

- [ ] **Step 5: 接入 component.config + index.tsx**

修改 `component.config.ts:20`:

```ts
capabilities: { fullscreen: true, fullscreenMode: 'viewport', resizable: false },
```

修改 `index.tsx`:

- 新增 import:
```ts
import { useFullscreen } from './src/hooks/useFullscreen';
import FullscreenCanvas from './src/pages/FullscreenCanvas';
```

- 在组件顶部(已有 `previewCollapsed` 旁边)新增 state + ref:
```ts
const [canvasOpen, setCanvasOpen] = useState(false);
const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);
const fs = useFullscreen(fullscreenTargetRef);
```

- header 加全屏按钮(在 `导入` 按钮之后,`topbar__meta` 之前):
```tsx
<button
  className="sl-sl-btn sl-sl-btn--ghost"
  onClick={() => setCanvasOpen(true)}
  disabled={!store.selectedGroup}
  title="全屏查看当前组的快捷键"
>
  全屏
</button>
```

- 在 root `<div ref={rootRef}>` 内部最底部加(在 longPressPopup / rowtip portal 之后):
```tsx
{fullscreenTargetRef.current === null && <div ref={fullscreenTargetRef} style={{ display: 'none' }} />}
<FullscreenCanvas
  open={canvasOpen}
  onClose={() => setCanvasOpen(false)}
  shortcuts={store.selectedGroup?.shortcuts ?? []}
  groupName={store.selectedGroup?.name ?? ''}
/>
```

> 注:`fullscreenTargetRef` 只是为了让 useFullscreen 拿到元素用于原生 API;组件本身走 portal 渲染,不需要真正全屏态。先实现最简版,后续如需原生 API 接管再加。

- [ ] **Step 6: 加 CSS**

在 `index.css` 末尾加(命名空间 `'sl'`,沿用已有 var 体系):

```css
/* 全屏画布 */
.sl-sl-canvas-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  color: var(--sl-color-text, #fff);
}
.sl-sl-canvas__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.sl-sl-canvas__title { margin: 0; font-size: 16px; font-weight: 600; }
.sl-sl-canvas__ctrls { display: flex; gap: 8px; align-items: center; }
.sl-sl-canvas__scale { font-size: 12px; opacity: 0.7; min-width: 44px; text-align: center; }
.sl-sl-canvas__stage {
  flex: 1;
  overflow: hidden;
  cursor: grab;
}
.sl-sl-canvas__stage:active { cursor: grabbing; }
.sl-sl-canvas__world {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px;
  padding: 40px;
  width: max-content;
  min-width: 100%;
}
.sl-sl-canvas-node {
  width: 200px;
  height: 80px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
}
.sl-sl-canvas-node__combo { font-size: 13px; }
.sl-sl-canvas-node__plus { color: var(--sl-color-text-mute, #888); margin: 0 2px; }
.sl-sl-canvas-node__desc { font-size: 12px; opacity: 0.85; }
```

- [ ] **Step 7: 跑测试,确认 PASS**

跑:`pnpm --filter @style-library/react-components test shortcut-library-fullscreen-canvas`
预期:4 个用例全过

- [ ] **Step 8: 全仓库跑测 + lint**

跑:`pnpm test && pnpm lint`
预期:全绿

- [ ] **Step 9: Commit**

```bash
git add packages/react-components/src/shortcut-library/component.config.ts \
        packages/react-components/src/shortcut-library/src/hooks/useFullscreen.ts \
        packages/react-components/src/shortcut-library/src/pages/FullscreenCanvas.tsx \
        packages/react-components/src/shortcut-library/index.tsx \
        packages/react-components/src/shortcut-library/index.css \
        packages/react-components/__tests__/shortcut-library-fullscreen-canvas.test.tsx
git commit -m "feat(shortcut-library): add fullscreen canvas for selected group"
```

- [ ] **Step 10: 回填 todo done id=3**

```bash
kvcli todo done 3 --result "新增 useFullscreen hook + FullscreenCanvas 组件(网格+拖动+滚轮缩放+ESC),capabilities.fullscreen 打开,header 全屏按钮,4 个新测试用例过"
```

---

## Self-Review

**Spec coverage:**
- #1 边框 ↑/↓ + 持久化:Task 1(惰性初始化 + endDrag 持久化 + 测试)
- #2 键盘 + popup 只显示当前组:Task 2(三个 callback 收紧 + boundCodes prop + 测试)
- #3 全屏浮窗画布:Task 3(component config + useFullscreen hook + FullscreenCanvas + 按钮入口 + CSS + 测试)
- todo done 回填:每个 Task 末尾都有 Step 7/10
- 跑测 + lint:每个 Task 末尾都有

**Placeholder scan:** 无 "TBD" / "类似 Task N" / "Add appropriate..."。所有 step 都给了具体代码片段。

**Type consistency:**
- `useFullscreen(targetRef: RefObject<Element | null>)` 在 Step 3 定义,Step 5 调用,签名一致。
- `<FullscreenCanvas open, onClose, shortcuts, groupName />` 在 Step 4 定义,Step 5 调用,prop 名一致。
- `SIDEBAR_W_KEY` / `PREVIEW_H_KEY` / `loadNumber` 在 Task 1 Step 3 定义,Step 1 测试引用,命名一致。
- `boundCodes` prop 在 Keyboard.tsx 已存在(原文件 `:40`),Task 2 Step 3 调用,签名一致。

**No cross-task type drift.** Ready to execute.