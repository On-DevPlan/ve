# Color Studio Component Design (MVP-B)

> 来源:用户提供的 Color Studio 需求文档 `.claude/repo/_self/color/coler.md`(2026-08-26)
> 本 spec 是该文档的 **MVP 切片**(对齐 doc §四 路线图,只做头部里程碑)
> 性质:实现前的设计契约,不含代码

---

## 0. 基本信息

| 项 | 值 |
|---|---|
| Spec 日期 | 2026-08-26 |
| 范围 | MVP-B 色管工作台(doc 第六章 M1+M2+M3(部分) + §5 加色通道) |
| **不在范围**(明确推迟) | M4 比例视图 / M5 图片主色提取下游 / M6 滤镜栈与 Konva 笔刷 / M7 收尾 |
| 组件位置 | `packages/react-components/src/color-studio/` |
| 存储后端 | `kvV1Service`(`/api/v1/kv`,走 caller 的 default_group_id) |
| 新增依赖 | `culori@^4`、`react-colorful@^5`(+ `happy-dom` dev) |
| 业务封装层 | `apps/showcase/src/api/components/color-studio/` |

---

## 1. 背景与目标

Color Studio 是用户设想中的完整产品(单一作者估算 ~9 周),源于 `.claude/repo/_self/color/coler.md`。本次 MVP-B 切出 doc 中 **不依赖画布与滤镜** 的全部色彩管理核心,目标:

1. **零代码冗余地完成基础闭环** —— 用户能创建/编辑/保存调色板、能通过色盘和取色器添加颜色、能切 5 种和声规则看派生几何
2. **复刻 doc §4 数据规范** —— 全部状态落到一份 JSON,KV 整体读写,预留 schemaVersion
3. **为后续 PR 预留扩展面** —— Konva 画布、滤镜、比例视图各开独立 PR;本次写出来的代码不应被推倒重写

**关键边界**(本次不算"完成"的):
- 不能画 / 涂笔刷
- 不能加滤镜
- 不能拖比例块调整主色权重
- 不能导出 CSS Variables / Tailwind(全局 Token 待办)

---

## 2. 数据模型:ColorStudioDocument(单一 JSON 文档)

### 2.1 字段

```ts
type Hex = string;   // '#RRGGBB',大写,带 #

type HarmonyType =
  | 'complementary'         // 互补
  | 'triadic'               // 三角
  | 'split-complementary'   // 分裂互补
  | 'analogous'             // 类似
  | 'monochromatic';        // 单色(同一色相 5 档明度)

interface ColorEntry {
  id: string;                              // ulid()
  hex: Hex;                                // 唯一存储格式
  weight: number;                          // 0-100,默认 1(存而不用,为比例视图预留)
  locked: boolean;
  note: string;
  tags: string[];
  derivedFrom?: { paletteId: string; rule: HarmonyType };
  createdAt: number;                       // Date.now()
  updatedAt: number;
}

interface PaletteHarmony {
  type: HarmonyType;
  anchorColorId: string;                   // 必填
  autoFill: boolean;                       // 锚色变更自动重派生
}

interface Palette {
  id: string;
  name: string;
  colorIds: string[];                      // 引用 ColorEntry.id,顺序 = 当前排序
  harmony: PaletteHarmony | null;
  sortBy: 'manual' | 'hue' | 'brightness' | 'saturation';
  createdAt: number;
  updatedAt: number;
}

interface PickHistoryItem {
  hex: Hex;
  source: 'wheel' | 'eyedropper' | 'image' | 'paste' | 'shortcut';
  pickedAt: number;
}

interface ColorStudioViewState {
  leftPane: 'palettes' | 'picker' | 'history';
  showHarmony: boolean;
  selectedHarmony: HarmonyType | null;
  brightness: number;                      // 0-100,色盘 V 滑杆会话级
}

interface ColorStudioDocument {
  meta: {
    schemaVersion: '1.0.0';
    createdAt: number;
    updatedAt: number;
    authorEmail: string;                   // jwtUser.email 兜底空串
  };
  activePaletteId: string;
  palettes: Palette[];
  colorEntries: ColorEntry[];              // 池化,palettes 用 id 引用,改一处全联动
  pickHistory: PickHistoryItem[];          // FIFO,上限 12
  viewState: ColorStudioViewState;
}
```

### 2.2 设计决策

| 决策 | 理由 |
|---|---|
| **Hex 作为唯一存储格式** | doc §4.3 一致性约束,避免多格式存储导致的不一致;其余格式(HSL/LAB/LCH/OKLCH)在引擎层实时派生 |
| **`palettes` 与 `colorEntries` 分两张池** | 同色被多调色板引用时避免冗余;改源一处全联动;后续 M4 比例视图也直接复用此池 |
| **`viewState` 嵌入而非用户偏好表** | MVP-B 单用户单设备,简化;未来加多设备同步可拆 |
| **`weight` / `derivedFrom` / `note` 字段保留但 MVP-B 不绘制** | 为 M4/M6 留数据接缝,不需再 schema 迁移 |
| **`schemaVersion` 一开始就放** | doc §7 风险明示,改结构时自动迁移入口 |
| **`pickHistory` 限 12** | 12 槽左右滑栏刚好;超过 FIFO 丢最旧 |

### 2.3 不变量

- `colorEntries` 中所有 `id` 唯一
- 任一 `Palette.colorIds[i]` 引用的 `id` 必存在于 `colorEntries`
- 同一时刻 `activePaletteId` 必在 `palettes` 内
- `pickHistory.length <= 12`

引擎写入路径(`setDoc`)在变更前后自动校验不变量,违反抛 `InvariantViolation`。InvariantViolation 等同于数据损坏 → UI 给出"重置文档"按钮。

---

## 3. 存储契约(host 侧 `apps/showcase/src/api/components/color-studio/`)

### 3.1 文件

```
apps/showcase/src/api/components/color-studio/
├── types.ts                            ← 域类型(与 §2.1 同,canonical)
├── createColorStudioStore.ts           ← load/save/exportJson/importJson 单文件
└── index.ts                            ← barrel:re-export createColorStudioStore + types
```

### 3.2 `createColorStudioStore` 契约

```ts
interface ColorStudioStoreLite {
  load(): Promise<ColorStudioDocument>;
  save(doc: ColorStudioDocument): Promise<void>;
  exportJson(): string;                                  // JSON.stringify(doc, null, 2)
  importJson(raw: string): ColorStudioDocument;          // parse + Zod 校验,失败抛 Error
  readonly authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
}
```

### 3.3 存储策略

- **固定 key**:`'color-studio'`(同 shortcut-library 的 `'shortcut-library'` 同质)
- **固定 tag**:`['color-studio']`(便于 KV list facet 检索)
- **不传 `groupId`** → 后端走 caller 的 `default_group_id`(`default_group_id` 未设返 `code 50`)
- **load 兜底**:`code 50` 或 key 不存在 → 返回 `emptyDoc(authorEmail, now)`(空文档函数)
- **save**:`JSON.stringify(doc)` + `kvV1Service.set({ key, value, tags, ttl: 0 })`
- **importJson**:`JSON.parse` + `docSchema.parse`(Zod),失败抛 `ValidationError`,由 UI 用 toast 提示

### 3.4 与 shortcut-library / user-space 模式对齐

完全复用 shortcut-library 的 store 范式 —— 单 key + 单 tag + 不传 groupId。读不到时降级到空文档。**不另起 HTTP service、不另起 registry、不改任何已封装层**。

---

## 4. 组件拆分(`packages/react-components/src/color-studio/`)

### 4.1 目录

```
color-studio/
├── index.tsx                            # ≤ 200 行,顶层组合
├── component.config.ts
├── index.css                            # ← 顶部 import './index.css' 必须存在
├── README.md
└── src/
    ├── engine/                          # 纯函数,可独立测
    │   ├── colorMath.ts                # ~140 行,culori wrap
    │   ├── harmony.ts                  # ~80 行,5 种和声派生
    │   ├── contrast.ts                 # ~40 行,WCAG
    │   ├── colorExtraction.ts          # ~70 行,K-means 主色
    │   └── docSchema.ts                # ~100 行,Zod schema
    ├── state/
    │   └── ColorStudioProvider.tsx     # ~50 行,顶层 React state + 不变量校验 + setDoc 加固
    ├── components/                      # UI 子组件,各 60-200 行
    │   ├── ColorWheel.tsx              # ← SVG HSB 圆盘,核心
    │   ├── HarmonyOverlay.tsx          # SVG 几何叠加
    │   ├── ColorDetailPanel.tsx        # 6 格式并列
    │   ├── PaletteSidebar.tsx          # CRUD + 拖拽
    │   ├── ColorChip.tsx
    │   ├── PickerPanel.tsx             # EyeDropper + 图片入口
    │   ├── ImageColorPicker.tsx        # canvas 取色 + K-means
    │   ├── QuickAddBar.tsx             # 粘贴 + Add
    │   ├── HistoryStrip.tsx            # 12 槽环形
    │   └── KeyboardHints.tsx
    ├── hooks/
    │   ├── useColorStudioDoc.ts        # load + debounced save
    │   ├── useKeyboardShortcuts.ts     # P / A / C / X / ↑↓
    │   ├── useHarmony.ts               # 从 active palette 算派生 hex[]
    │   └── useEyedropper.ts            # API 探测
    └── utils/
        ├── id.ts                       # ulid()
        ├── clipboard.ts                # writeText + 容错
        └── constants.ts                # HARMONY_ANGLE_TABLE

apps/showcase/src/api/components/color-studio/   # 业务封装层
├── types.ts
├── createColorStudioStore.ts
└── index.ts
```

### 4.2 `index.tsx` 形态(顶层组合,无业务逻辑)

```tsx
import './index.css';
import { useState } from 'react';
import { ColorStudioProvider, useColorStudio } from './src/state/ColorStudioProvider';
import { ColorWheel } from './src/components/ColorWheel';
import { ColorDetailPanel } from './src/components/ColorDetailPanel';
import { PaletteSidebar } from './src/components/PaletteSidebar';
import { QuickAddBar } from './src/components/QuickAddBar';
import { PickerPanel } from './src/components/PickerPanel';
import { HistoryStrip } from './src/components/HistoryStrip';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';

export default function ColorStudio() {
  return (
    <ColorStudioProvider>
      <Shell />
    </ColorStudioProvider>
  );
}

function Shell() {
  const { doc, status } = useColorStudio();
  useKeyboardShortcuts();
  return (
    <div className="sl-cs">
      <header className="sl-cs__bar">
        <h1>Color Studio</h1>
        <StatusPill status={status} />
      </header>
      <aside className="sl-cs__left"><PaletteSidebar /></aside>
      <main className="sl-cs__main">
        <ColorWheel />
        <ColorDetailPanel />
        <HistoryStrip />
      </main>
      <aside className="sl-cs__right"><PickerPanel /></aside>
      <footer className="sl-cs__bottom"><QuickAddBar /></footer>
    </div>
  );
}
```

### 4.3 `engine/colorMath.ts` 对外契约

```ts
import type { Hex } from '@api/components/color-studio/types';

export const toHex:        (c: HSL | RGB | OKLCH | HSV | LAB | LCH) => Hex;
export const fromHex:      (hex: Hex) => { rgb, hsl, lab, lch, oklch, hsv };
export const parseUserInput: (s: string) => Hex | null;     // 容错 #abc/0xff/red/hsl(...)/大小写
export const interpolate:  (hexA: Hex, hexB: Hex, t: number) => Hex;
export const contrastRatio: (a: Hex, b: Hex) => number;     // WCAG,精确到 0.01
```

### 4.4 顶层 hook `useColorStudioDoc` 契约

```ts
export function useColorStudioDoc(): {
  doc: ColorStudioDocument;
  setDoc: React.Dispatch<React.SetStateAction<ColorStudioDocument>>;
  status: 'idle' | 'loading' | 'saving' | 'synced' | 'error';
  authState: 'logged-in' | 'logged-out';
  forceReload: () => Promise<void>;
};
```

- mount 时调 `store.load()`,状态切 `'loading'` → 成功后 `'idle'`
- `setDoc` 触发 `useEffect` 监听到 doc 变化 → 600ms debounce → `store.save(doc)`,状态切 `'saving'` → `'synced'`
- 未登录(`authState === 'logged-out'`)时只渲染提示,所有 setDoc 操作加显式"登录后保存"toast

---

## 5. 组件元数据(`component.config.ts`)

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'color-studio',
  name: 'ColorStudio',
  title: '色彩管理工作台',
  description: 'HSB 圆盘 + 取色 + 调色板 + 和声派生 + JSON 整体读写。',
  version: '0.1.0',
  framework: 'react',
  entry: './index.tsx',
  platform: 'both',
  group: '设计',
  category: '色彩管理',
  tags: ['color', 'picker', 'palette', 'harmony'],
  status: 'experimental',
  route: { path: '/components/color-studio', title: '色彩管理工作台' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { fullscreen: true, fullscreenMode: 'viewport', resizable: false },
} satisfies ComponentConfig;
```

---

## 6. 包依赖新增

在 `packages/react-components/package.json` 的 `dependencies` 加:

```jsonc
"culori": "^4.0.0",          // MIT,~22 KB min,零依赖,色彩空间互转 + 插值
"react-colorful": "^5.6.1",  // MIT,~16 KB min,Hex/Picker 组件
```

以及(若 `__tests__` 需要)在 `devDependencies` 加 `happy-dom`(替换 jsdom,体积更小)。

> 颜色互转走 culori、当前色 pick 走自实现 SVG 圆盘、Hex 输入走 react-colorful。三方各司其职,避免重叠。

---

## 7. 别名引用(无须新增)

复用既有别名:

| 在 color-studio 文件中引 | 实际路径 |
|---|---|
| `import { useJwtAuth } from '@/shared/auth-store'` | `apps/showcase/src/shared/auth-store` |
| `import { createColorStudioStore } from '@api/components/color-studio/createColorStudioStore'` | `apps/showcase/src/api/components/color-studio/createColorStudioStore.ts` |
| `import type { ColorStudioDocument } from '@api/components/color-studio/types'` | `apps/showcase/src/api/components/color-studio/types.ts` |

`apps/showcase/tsconfig.json`、`packages/react-components/tsconfig.json`、`apps/showcase/vite.config.ts`、`vitest.workspace.ts` 四处均已配齐,**本次不动别名配置**。

---

## 8. 验证清单

```bash
# 1. ESLint 必过(包括 style-library/valid-component-config)
pnpm lint
# 期待:0 errors,0 warnings

# 2. dev 自动发现
pnpm --filter @style-library/showcase dev &
sleep 8
curl -s http://localhost:5173/__component-manifest.json | grep -q '"id":"color-studio"' \
  && echo "manifest OK" || echo "MISSING"

# 3. 生产构建独立 chunk
pnpm --filter @style-library/showcase build
ls apps/showcase/dist/assets/ | grep -q 'rc-color-studio' \
  && echo "chunk OK" || echo "MISSING"

# 4. 单元测试
pnpm exec vitest run
# 期待用例:
#   engine/colorMath.ts:parseUserInput - 接受 #abc / 0xff5733 / red / hsl(...)
#                                      / 大小写 / 非法返 null
#   engine/colorMath.ts:fromHex - 输出含 rgb/hsl/oklch/lab/lch/hsv 全字段
#   engine/colorMath.ts:interpolate - 端点值与端点相等,中点平滑
#   engine/harmony.ts:5 种规则分别输入 anchor,色相差精确到 ±0.5°
#   engine/contrast.ts:contrastRatio(#000,#FFF) === 21(±0.05)
#   engine/colorExtraction.ts:合成 6 像素图 → K-means 提取主色
#   engine/docSchema.ts:合法 doc validate pass,缺字段 fail
#   createColorStudioStore:mock fetch,验证 set body 字段 + load 走 code 50 兜底

# 5. 手动浏览器
#   打开 /components/color-studio:
#     - 加载无 console error / network 4xx 5xx
#     - 点色盘 → ColorDetailPanel 6 格式实时变
#     - V 滑杆 → 色环明度梯度变化
#     - 切和声 → 色盘出现几何标记
#     - 加一色 → 刷新浏览器,色仍在(KV 持久化生效)
#     - 未登录:store 走空文档兜底,所有写操作弹"登录后保存"提示
```

---

## 9. 风险点与对策

| 风险 | 对策 |
|---|---|
| EyeDropper API 仅 Chromium 系支持(Firefox/Safari 无) | `useEyedropper` 用 `'EyeDropper' in window` 探测;缺失时按钮 disabled + 灰色提示;仅 Image picker 兜底 |
| KV 单 blob 大小:12 板 × 20 色 ≈ 36 KB,加 viewState < 60 KB | 远低于默认 KV 限额;超阈值由后端 413 处理,UI toast |
| 首次用户 default_group_id 未设 | `load()` catch `ApiError code 50` → 返 `emptyDoc()`(同 shortcut-library);`save` 走空文档无要求 |
| 跨标签页并发覆盖 | MVP-B 不实现乐观锁,接受 last-write-wins;spec §未来工作登记 |
| `dnd-kit` 与 React 19 兼容性 | 失败则降级为"上下移按钮"再提交 |
| `react-colorful` 与自写 ColorWheel 选色逻辑重叠 | `react-colorful` 仅用于 PickerPanel 的 Hex 单字段;主交互走自写 ColorWheel |
| ShadowRoot 下 SVG fill 走 inline 颜色 | 几何元素用 token,色盘 fill 用 hex(由计算给出,合理) |
| Zod 体积 | Zod v3 一份约 50KB min,demo 体量可接受;不通过 store 拉到组件,只在 `engine/docSchema.ts` 内 import |

---

## 10. 不做范围(明确推后,留给后续 PR)

- ❌ Konva 笔刷画布 / 混合模式笔刷 → 下一 PR
- ❌ 滤镜栈(亮度/对比度/饱和度/灰度等非破坏性滤镜) → 下一 PR
- ❌ 比例视图 / 权重可视化 → `weight` 字段存而不用,等 M4
- ❌ 全局 Token / CSS Variables 导出 → 等 M4
- ❌ Pantone 最近似色 → 等 M7
- ❌ IndexedDB 离线缓存(localStorage 兜底也不做) → 等 M7
- ❌ 跨标签页乐观锁 → 等 M7

---

## 11. 后续工作(spec 完成后)

- 用 writing-plans skill 输出实现计划文档,分 M1-M5 子计划对应 MVP-B 各模块
- 实现时严格 TDD:engine 层先写测后写实现;UI 层写 happy-dom 集成测
- 每完成一块(Engine / ColorWheel / ColorDetail / Palette / EyeDropper+Image / QuickAdd+Hooks),单独一次 atomic commit
- 完成所有后跑 `pnpm exec superpowers:requesting-code-review` 让 superpowers:code-review skill 接力
