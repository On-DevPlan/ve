---
ref: large-component-layout
parent: web-work-flow
---

# Large Component Directory Layout

`index.{vue,tsx}` 之外的子文件该放哪、何时拆、按什么约定拆。**只在组件"够大"时读这个 ref**——小组件单文件就够,提前拆只会增加心智成本。

---

## 1. 何时拆(判断标准)

满足以下任一即可拆:

| 信号 | 阈值 |
|---|---|
| `index.vue` / `index.tsx` 行数 | > 300 行 |
| 模板里的子视图 / 子组件 | ≥ 3 个 |
| 纯逻辑模块(composables / hooks / engine / util) | ≥ 2 个,各自 ≥ 80 行 |
| CSS 行数 | > 200 行 |

**未满足拆分标准时**:不要提前拆。一文件 ≤ 300 行比"目录漂亮"重要——多一层目录就多一次 import 心智,成本只有在大组件上才划算。

---

## 2. 关键约束(拆之前必须知道)

`import.meta.glob` 的字面量路径只匹配**顶层** `index.{vue,tsx}`,不会扫子目录:

```ts
// apps/showcase/src/registry/loaders.ts
const vueModules = import.meta.glob(
  '../../../../packages/vue-components/src/*/index.vue',
);
const reactModules = import.meta.glob(
  '../../../../packages/react-components/src/*/index.tsx',
);
```

也就是说:

1. **`index.{vue,tsx}` 必须在组件根目录**,不能挪进 `src/`。挪了之后 glob 扫不到,详情页 `No loader registered for "<id>"`。
2. **`component.config.ts` 也在组件根目录**——`manifestPlugin` 扫 `packages/*/src/*/component.config.ts`(`packages/manifest-generator/src/vite-plugin.ts` 的 `componentRoots`),把 config 挪进 `src/` 会导致卡片不显示。
3. **不要在 `<id>/` 下另开 `index.ts` 作为 barrel**——glob 字面量写死只扫 `<id>/index.{vue,tsx}` 一层,barrel 多此一举。
4. 组件内部怎么拆,只要 `index.{vue,tsx}` + `component.config.ts` 还在根目录,**外层零感知**——manifest 不变、loader 不变、卡片/详情路由不变。

---

## 3. 约定模板

本仓库已有先例:`react-components/src/shortcut-library/`、`react-components/src/car-battle/`、`react-components/src/gaussian-splat-viewer/`。

```
packages/{vue,react}-components/src/<id>/
├── index.{vue,tsx}        # ← 唯一顶层入口,保持薄(只组合)
├── component.config.ts
├── index.css              # React 必备;Vue 用 SFC <style> 也行
├── README.md
└── src/                   # ← 内部子目录,自行组织,不影响 glob
    ├── pages/             # 视图/页面级子组件(Vue: .vue;React: .tsx)
    ├── components/        # 可复用小组件(KeyChip.tsx、Sidebar.tsx、IntroBox.tsx)
    ├── hooks/             # React: useShortcuts.ts、useScrollProgress.ts
    │                      # Vue: composables/useXxx.ts
    ├── engine/            # 业务逻辑层(物理/算法/解析)— 无 UI 依赖
    │                      # 例: car-battle/src/Physics.ts、shortcut-library/import-parser.ts
    ├── types.ts           # 跨子模块共享的类型定义
    └── utils.ts           # 纯函数工具
```

---

## 4. 真实例子

### 4.1 `react-components/src/shortcut-library/`

```
shortcut-library/
├── index.tsx              # 顶层入口: <Keyboard><Sidebar/><ShortcutTable/></Keyboard>
├── component.config.ts
├── index.css
├── Keyboard.tsx           # ← 顶层页面壳,直接放在组件根目录
├── Sidebar.tsx            # ← 顶层页面壳,直接放在组件根目录
├── ShortcutTable.tsx      # ← 顶层页面壳,直接放在组件根目录
├── CapturePopover.tsx     # ← 顶层页面壳
├── ImportModal.tsx        # ← 顶层页面壳
├── KeyChip.tsx            # ← 子组件
├── keymap.ts              # ← 数据/常量
├── import-parser.ts       # ← 业务逻辑(无 UI)
├── types.ts               # ← 共享类型
├── useShortcuts.ts        # ← hook
└── __tests__/             # ← 测试可以放这里,不需要 src/
    └── shortcut-library-pressed.test.tsx
```

注意:这个组件**没有走 `src/` 子目录**——它直接把"顶层页面壳"放在组件根目录,把"业务逻辑 + 类型 + hook"也放在根目录。这是另一种合法形态:当子文件总数在 5–10 之间,`src/` 子目录反而增加跳转成本,平铺更直接。

### 4.2 `react-components/src/car-battle/`

```
car-battle/
├── index.tsx              # ← 只组合,从 src/engine 拿状态
├── component.config.ts
├── index.css
└── src/                   # ← 业务逻辑(无 UI)全在这里
    ├── Arena.ts           # 场景/地图
    ├── Car.ts             # 实体
    ├── GameEngine.ts      # 主循环
    ├── InputManager.ts    # 输入
    ├── Physics.ts         # 物理
    ├── Renderer.ts        # 渲染
    ├── particle.ts        # 粒子系统
    └── types.ts           # 共享类型
```

注意:这个组件是**纯逻辑拆**——UI 部分小,但业务层(物理 + 游戏循环 + 渲染)需要独立测试,所以放进 `src/`。这说明:`src/` 不一定要拆 UI 子组件,只要存在需要独立单元测试或被复用的纯逻辑层,就该放进 `src/`。

### 4.3 `react-components/src/gaussian-splat-viewer/`

```
gaussian-splat-viewer/
├── index.tsx              # ← 顶层入口
├── component.config.ts
├── index.css
└── src/
    ├── IntroBox.tsx       # 子组件
    ├── LoadingScreen.tsx  # 子组件
    ├── ProgressBar.tsx    # 子组件
    ├── cameraPath.ts      # 相机轨迹数据
    ├── gaussian-splats-3d.d.ts  # 类型声明
    ├── useGaussianScene.ts      # hook(3D 场景)
    └── useScrollProgress.ts     # hook(滚动进度)
```

混合形态:UI 子组件 + 业务逻辑层都在 `src/` 下,但没有再细分子目录(`components/` / `engine/` / `hooks/`)——因为单个分类的文件数 ≤ 3,平铺即可。

---

## 5. 写入原则

1. **`index.{vue,tsx}` 只做组合,不写业务逻辑**。`car-battle/index.tsx` 只 `import { useGameEngine } from './src/useGameEngine'` 然后渲染。
2. **子目录里再拆 `pages/`、`components/`、`hooks/`、`engine/`** 按职责。子目录名不限制,但跨组件要一致(本页的命名是建议基线)。
3. **不要硬塞 `src/components/` 这种 Vite 默认心智**——本约定里 `src/` 是"组件自己的内部 src",跟 Host 的 `apps/showcase/src/components/` 完全无关,不要混淆。
4. **`__tests__/` 可放组件根目录或 `src/` 同级**——见 `shortcut-library/__tests__/`。
5. **单文件逻辑 ≥ 300 行** 时即使没拆组件也应考虑再拆文件——见 §6。

---

## 6. 目录模板速查

| 你要拆什么 | 放哪 |
|---|---|
| 顶层页面壳(直接被 `index.{vue,tsx}` 渲染) | 组件根目录:`<id>/Keyboard.tsx` |
| 通用子组件(被页面壳组合) | `<id>/src/components/KeyChip.tsx` 或 `<id>/KeyChip.tsx`(取决于粒度) |
| 多视图/多页面(组件内部有路由切换) | `<id>/src/pages/` |
| 业务逻辑层(物理/算法/解析/状态机) | `<id>/src/engine/` 或 `<id>/src/<name>.ts`(无 UI 依赖文件) |
| React hooks / Vue composables | `<id>/src/hooks/` 或 `<id>/useXxx.ts` |
| 类型定义 | `<id>/src/types.ts`(单一文件时)或 `<id>/src/types/`(模块多时) |
| 测试 | `<id>/__tests__/` |

---

## 7. 何时**不**读这个 ref

- 单文件组件(整组件 < 300 行,模板内 < 3 个子视图)— 直接按 [[how-to-add-component]] §1 平铺即可。
- 远程 loader 组件(`loaderUrl` 在 config 里)— 远程 URL 不归本仓库管,跟目录结构无关。
- Host 应用本身(`apps/showcase/`)的目录约定——那是另一套(见 [[architecture-and-design-philosophy]] §9)。