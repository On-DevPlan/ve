# Manifest / Loader 双轨问题详解

> 这是对 `docs/architecture/framework-architecture-review.md` §5 P1-1 的逐条核查 + 深入分析。
> 目的:讲清楚"为什么它是当前框架最重要的架构缺口","为什么 ESLint 闸门只能缓解而不能根治",以及"实际可行的根治方案"。

---

## 1. 问题是什么

当前 wb 框架有**两条独立的发现路径**把组件接入运行时:

```text
路径 A — Manifest(metadata) 由 manifest-generator 扫描 component.config.ts
路径 B — Loader(代码) 由 import.meta.glob 扫描 index.{vue,tsx}
```

它们各自独立工作,只在**一个隐含的命名约定**上汇合:**目录名 === config.id === manifest.loaderKey === loader map key**。

这两条路径的入口文件、触发时机、失败行为完全不一样:

| 维度 | Manifest 路径(路径 A) | Loader 路径(路径 B) |
|---|---|---|
| 触发位置 | `packages/manifest-generator/src/{scanner,vite-plugin}.ts` | `apps/showcase/src/registry/loaders.ts` |
| 入口文件 | `component.config.ts`(TypeScript 文件) | `index.vue` / `index.tsx`(组件实现) |
| 何时跑 | `pnpm dev` 启动 + watcher add/unlink/change | Vite 编译 `loaders.ts` 时一次性扫描 |
| 失败表现 | 整个 manifest 生成失败 / 卡片不显示 | dev server 报 `Failed to resolve` 错 |
| 校验时机 | 构建期(立即失败) | 运行时(打开详情页才报错) |

---

## 2. 失败的几种形式

### 2.1 Manifest 有,Loader 没

```text
某组件:
  component.config.ts       ← 在 packages/vue-components/src/foo/
  index.vue                ← 缺失(作者忘写)

行为:
  ✓ manifest scanner 扫到 config.ts,manifest 包含该条
  ✓ 路由注册,/components/foo 可访问
  ✓ 卡片显示
  ✗ 用户点卡片 → 详情页 → loaders[foo] = undefined
  ✗ 控制台报错 "No loader registered for foo"
```

错误延迟到用户打开详情页时才暴露——离源代码最远、离用户最近。

### 2.2 Loader 有,Manifest 没

```text
某组件:
  component.config.ts       ← 缺失(作者跳过 metadata)
  index.vue                ← 在 packages/vue-components/src/foo/

行为:
  ✓ import.meta.glob 扫到 index.vue,loader 可用
  ✗ manifest 不含这条
  ✗ 卡片不显示,路由不存在
  ✗ 但开发者以为 loader 已就绪,实际组件永远进不去 showcase
```

比情况 2.1 更危险——组件已部署但永远不可见,**无任何报错**。

### 2.3 命名不一致

```text
某组件:
  packages/vue-components/src/foo/
  component.config.ts: id: 'bar'   ← 改成了 'bar'

行为:
  ✓ manifest 包含 id='bar'
  ✗ import.meta.glob 扫到目录名 'foo' → loader key='foo'
  ✗ loader[bar] = undefined → 详情页 mount 失败
```

### 2.4 framework 不匹配目录包

```text
某组件:
  packages/vue-components/src/foo/   ← 在 vue 包里
  component.config.ts: framework: 'react'

行为:
  ✓ manifest 包含 framework='react'
  ✗ 但目录在 vue 包下,loader 走 vue chunk 还是 react chunk?
  ✗ 当前 import.meta.glob 按目录包区分,manifest 不感知
  ✗ 详情页选择 ReactMountAdapter → 加载一个 Vue 文件 → mount 异常
```

---

## 3. 我做了什么:ESLint 闸门

为了缓解 2.3(命名不一致)这类问题,我加了自定义 ESLint 规则 `style-library/valid-component-config`:

```js
// eslint/rules/valid-component-config.js
create(context) {
  const filename = context.getFilename();
  if (!/(^|[\\/])component\.config\.ts$/.test(filename)) return {};
  const expectedId = expectedIdFromPath(filename);          // 'foo'
  const expectedFramework = detectFrameworkFromPath(filename); // 'vue' | 'react'
  return {
    Program(ast) {
      // 提取 export default { ... } 对象
      const fields = getFieldMap(objectNode);
      // 校验 id === 目录名
      if (fields.id && fields.id.value !== expectedId) {
        context.report({ messageId: 'idMismatch' });
      }
      // 校验 framework === 所在包
      if (fields.framework !== expectedFramework) {
        context.report({ messageId: 'frameworkMismatch' });
      }
      // 校验 route.path === /components/<id>
      // ...
    },
  };
}
```

**它能阻止的失败模式**:
- ✅ 命名不一致(2.3)——`id !== 目录名` 立即 lint 报错
- ✅ framework 不匹配(2.4)——`framework !== vue-components 包` 立即报错
- ✅ route.path 与 id 不一致——编辑器红线

**它不能阻止的失败模式**:
- ❌ `index.vue` 缺失(2.1)——ESLint 看不到文件系统
- ❌ Loader 与 Manifest 的"实际对账"——ESLint 不跑时不知道 glob 扫到了什么
- ❌ Loader 没但 Manifest 有(2.2 的反例)——配置存在,ESLint 通过,但 Loader 缺失

**它的根本局限**:**ESLint 规则只在文件写入时跑、且只看单个 config 文件**。它不能跨文件系统读所有 `index.vue` 文件,也不能跑 import.meta.glob 实际看扫到了什么。

---

## 4. 真正的根治:Loader Inventory 对账

正确做法是**让两条发现路径在构建期对账**——生成一份"Loader Inventory",然后和 Manifest 交叉验证。

### 4.1 目标架构

```text
component.config.ts  →  scanner  →  Manifest (元数据)
                                  ↘
                                   validateManifest vs LoaderInventory
                                  ↗
index.{vue,tsx}     →  glob     →  LoaderInventory (实际可加载)
```

### 4.2 实施步骤

#### 步骤 1 — 生成 Loader Inventory

在 manifest-generator 包里新增一个函数,扫描所有 `index.{vue,tsx}`:

```ts
// packages/manifest-generator/src/loader-inventory.ts

export interface LoaderEntry {
  id: string;              // 从目录名提取
  framework: 'vue' | 'react'; // 从目录所在包提取
  entryPath: string;       // 相对路径,如 '../../packages/vue-components/src/foo/index.vue'
  absolutePath: string;    // 物理绝对路径,用于验证存在性
}

export async function buildLoaderInventory(roots: string[]): Promise<LoaderEntry[]> {
  const entries: LoaderEntry[] = [];
  for (const root of roots) {
    // root 形如 '../../packages/vue-components/src'
    const framework = root.includes('vue-components') ? 'vue' : 'react';
    const dirs = await fs.readdir(root, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const indexVue = path.join(root, dir.name, 'index.vue');
      const indexTsx = path.join(root, dir.name, 'index.tsx');
      const entryPath = fs.existsSync(indexVue) ? indexVue
                     : fs.existsSync(indexTsx) ? indexTsx
                     : null;
      if (!entryPath) continue;  // 没有 entry,跳过(不报错——可能是子目录或其他用途)
      entries.push({
        id: dir.name,
        framework,
        entryPath,
        absolutePath: path.resolve(entryPath),
      });
    }
  }
  return entries;
}
```

#### 步骤 2 — 对账

```ts
// packages/manifest-generator/src/reconcile.ts

export interface ReconcileReport {
  inManifestButNoLoader: string[];   // manifest 有,Loader 没
  inLoaderButNoManifest: string[];   // Loader 有,manifest 没
  consistent: string[];              // 两边都有
}

export function reconcile(
  manifest: ComponentManifest,
  loaderInventory: LoaderEntry[],
): ReconcileReport {
  const manifestIds = new Set(manifest.components.map((c) => c.id));
  const loaderIds = new Set(loaderInventory.map((l) => l.id));

  const inManifestButNoLoader = [...manifestIds].filter((id) => !loaderIds.has(id));
  const inLoaderButNoManifest = [...loaderIds].filter((id) => !manifestIds.has(id));
  const consistent = [...manifestIds].filter((id) => loaderIds.has(id));

  return { inManifestButNoLoader, inLoaderButNoManifest, consistent };
}
```

#### 步骤 3 — 在 build 时强制一致

```ts
// packages/manifest-generator/src/vite-plugin.ts

async function regenerateManifest() {
  // 1. 扫配置
  const scanned = await scanConfigs({ roots: opts.componentRoots });

  // 2. 扫 Loader
  const loaderInventory = await buildLoaderInventory([
    path.resolve(opts.cwd ?? process.cwd(), 'packages/vue-components/src'),
    path.resolve(opts.cwd ?? process.cwd(), 'packages/react-components/src'),
  ]);

  // 3. 生成 Manifest
  const manifest = generateManifest(scanned, { buildId: ..., outDir: ... });

  // 4. 对账 + 阻断
  const report = reconcile(manifest, loaderInventory);
  if (report.inManifestButNoLoader.length > 0) {
    throw new Error(
      `Manifest references components with no loader: ${report.inManifestButNoLoader.join(', ')}\n` +
      `Either create index.{vue,tsx} in the component directory, or remove from component.config.ts`,
    );
  }
  // inLoaderButNoManifest 不是错误——可能是新写的 index.vue 还没加 config.ts
  // 但应警告
  if (report.inLoaderButNoManifest.length > 0) {
    console.warn(
      `[manifestPlugin] Found loader but no manifest entry: ${report.inLoaderButNoManifest.join(', ')}`,
    );
  }

  plugin.cachedManifest = manifest;
}
```

### 4.3 错误信息示例

```text
[manifestPlugin] Manifest/Loader mismatch detected:

  in manifest but no loader (1):
    - remote-chart (component.config.ts exists, but packages/vue-components/src/remote-chart/index.vue missing)

  in loader but no manifest (2):
    - temp-test (index.vue exists, but no component.config.ts — maybe you forgot to add metadata?)
    - gis (index.vue exists, but no component.config.ts — maybe renamed component.config.ts?)

These would cause runtime errors like:
  ✗ "No loader registered for X" when opening detail page
  ✗ silent invisibility — card never shows up

Fix:
  - For "in manifest but no loader": create index.{vue,tsx} in the component directory
  - For "in loader but no manifest": add component.config.ts (run `pnpm lint` to see required fields)

Refusing to provide stale manifest. Exiting.
```

这种错误信息在 dev server 启动时**立刻**出现,而不是延迟到用户点详情页。

---

## 5. 为什么 ESLint 闸门不能取代 Loader Inventory 对账

### 5.1 视角不同

| 维度 | ESLint `valid-component-config` | Loader Inventory 对账 |
|---|---|---|
| 触发时机 | 编辑器保存时、commit 时 | dev server 启动时、`pnpm build` 时 |
| 看多少 | 单个 `component.config.ts` 文件 | 整个 `packages/{vue,react}-components/src/*/` 目录树 |
| 错误粒度 | "id 不等于目录名" | "manifest 有但 Loader 缺失,具体哪个组件" |
| 失败后果 | commit 被 lint 拦住 | dev server 启动失败、build 失败 |

### 5.2 互补,不互斥

两个机制一起用:

```text
编辑器保存 config.ts 时:
  ESLint 校验: id === 目录名? framework === 所在包?
  → 命名/字段问题在编辑时立刻拦截

dev server 启动 / build 时:
  Loader Inventory 对账: 实际 loader 与 manifest 是否一致?
  → "index.vue 缺失" / "目录无 config" 类问题在启动时拦截
```

ESLint 是**单点校验**,Loader Inventory 是**全局一致性校验**。两者解决的问题空间不重叠。

### 5.3 一个具体的边界场景

```text
组件作者做这些事:
  1. 写 packages/vue-components/src/foo/component.config.ts(id='foo')
  2. 写 packages/vue-components/src/foo/index.vue
  3. git commit
  → ESLint 通过(单文件检查,id 合法)
  → 下一行命令: pnpm dev
  → Loader Inventory 应该扫到 foo/index.vue ✓
  → Manifest 应该有 foo ✓
  → 对账:consistent
  → 一切正常

但如果作者:
  1. 写 packages/vue-components/src/foo/component.config.ts(id='foo')
  2. 忘记写 index.vue
  3. git commit
  → ESLint 通过(只看 config.ts,不看文件系统其他文件)
  → pnpm dev
  → Loader Inventory 扫 foo/ → 没有 index.vue → 不纳入 inventory
  → Manifest 有 foo,Inventory 无 foo → inManifestButNoLoader
  → dev server 启动失败,错误指向具体缺失文件
  → 作者修
```

**只有 Loader Inventory 能抓第 2 种情况**。

---

## 6. 实施优先级建议

按 ROI 排序:

| 优先级 | 工作量 | 收益 | 说明 |
|---|---|---|---|
| P0 | 1 天 | 极大 | 实现 Loader Inventory 对账,在 build/dev 启动时报错。这是当前架构最致命的洞——它把错误延迟到运行时 |
| P1 | 0.5 天 | 中 | Loader Inventory 写入 `manifest.components[]._loaderRef`(运行时校验用),让 `loaders[id]` 与 inventory 同步 |
| P2 | 1 天 | 小 | 对账结果输出到 `eslint-report-summary.json`,聚合到 lint summary |

**先做 P0**:实现 `buildLoaderInventory` + `reconcile` + 在 `vite-plugin.ts` 的 `regenerateManifest` 里调用。代码量 ~50 行,收益是"运行时消失的一类 bug"。

---

## 7. 结论

评审的 P1-1 评分准确:这是当前框架**最重要的抽象缺口**。我加的 ESLint 闸门**缓解了命名不一致类问题**,但**没有根治** Loader 与 Manifest 的对账缺口。

根治方案明确:**让 manifest-generator 包同时生成 Loader Inventory,与 Manifest 交叉验证,在 dev/build 阶段阻断不一致**。代码不复杂,收益是消除"运行时消失的 bug"。

完整方案见 §4。