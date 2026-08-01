---
ref: manifest-loader-reconciliation
parent: architecture
---

# Manifest / Loader 对账 —— 已落地

> **状态**:本文档原始内容是 P0 实施规划(2026-07-26 之前)。**当前代码已全部落地**,对账机制跑在每次 dev server 启动、每次 watcher 触发、每次 production build 上。
>
> 本文档现在承担**三个角色**:
> 1. 解释"为什么需要 Manifest ↔ Loader 对账"(历史背景,§1-3)
> 2. 指向**当前实际代码**(替代原来的示例代码段,§4)
> 3. 标注**剩余改进点**(slug 中文 fallback 之外的边界场景,§6)
>
> 新人优先读 [[protocol]] §5 校验链 + `framework-architecture-review.md` §4.3(下面 §7 关联) —— 后者反映最新状态。

---

## 1. 为什么需要(历史背景)

`wb` 框架曾经有**两条独立的发现路径**把组件接入运行时:

```text
路径 A — Manifest(metadata)由 manifest-generator 扫描 component.config.ts
路径 B — Loader(代码)由 import.meta.glob 扫描 index.{vue,tsx}
```

它们各自独立工作,只在**一个隐含的命名约定**上汇合:**目录名 === config.id === manifest.loaderKey === loader map key**。

两条路径的入口、触发时机、失败行为完全不同:

| 维度 | Manifest(路径 A) | Loader(路径 B) |
|---|---|---|
| 触发位置 | `packages/manifest-generator/src/{scanner,vite-plugin}.ts` | `apps/showcase/src/registry/loaders.ts` |
| 入口文件 | `component.config.ts` | `index.vue` / `index.tsx` |
| 何时跑 | `pnpm dev` 启动 + watcher add/unlink/change | Vite 编译 `loaders.ts` 时一次性扫描 |
| 失败表现 | manifest 生成失败 / 卡片不显示 | dev server 报 `Failed to resolve` |
| 校验时机 | 构建期(立即失败) | 运行时(打开详情页才报错) |

## 2. 不对账会失败的几类(历史教训)

2.1 Manifest 有,Loader 没 → 用户点详情页 → `No loader registered for X`(延迟到运行时)

2.2 Loader 有,Manifest 没 → 组件永远不显示,**无任何报错**(最危险)

2.3 命名不一致(id 与目录名) → loader key 找不到 → mount 失败

2.4 framework 不匹配目录包(vue 包下声明 framework: react) → 加载错文件类型

## 3. ESLint 闸门(已实现,跟对账互补)

`eslint/rules/valid-component-config.js` 在编辑器保存时拦 2.3 / 2.4 类问题(单文件)。但**不能拦 2.1 / 2.2**(需要全局视角)。**Loader Inventory 对账是 ESLint 的补充,不是替代**。

详细对比见原 §5(2026-07-26 之前的论证,现在仍然成立)。

---

## 4. 对账机制 —— 当前实现(代码指针)

### 4.1 Loader Inventory 扫描

**文件**: [`packages/manifest-generator/src/loader-inventory.ts`](../../../packages/manifest-generator/src/loader-inventory.ts)

```ts
// buildLoaderInventory(roots):Promise<LoaderEntry[]>
// 用 fs.readdir(..., withFileTypes) 扫每个 root 下的直接子目录,
// 检查 index.vue / index.tsx 存在性,生成 { id, framework, entryPath, absolutePath }
// framework 从 root 路径字符串推断(vue-components → 'vue',否则 → 'react')
```

测试: `packages/manifest-generator/__tests__/loader-inventory.test.ts`(4 用例)

### 4.2 对账

**文件**: [`packages/manifest-generator/src/reconcile.ts`](../../../packages/manifest-generator/src/reconcile.ts)

```ts
// reconcile(manifest, inventory) → ReconcileReport
//   inManifestButNoLoader: string[]  ← manifest 有但 inventory 无 (硬错)
//   inLoaderButNoManifest: string[]  ← inventory 有但 manifest 无 (警告)
//   consistent:             string[]
```

测试: `packages/manifest-generator/__tests__/reconcile.test.ts`(5 用例)

### 4.3 接入 vite plugin

**文件**: [`packages/manifest-generator/src/vite-plugin.ts`](../../../packages/manifest-generator/src/vite-plugin.ts) `regenerateManifest()`

行为(原 §4.3 描述的真实形态):

```ts
const inventory = await buildLoaderInventory(loaderRoots);
const report = reconcile(manifest, inventory);
if (report.inManifestButNoLoader.length > 0) {
  throw new Error(formatMismatchError(report.inManifestButNoLoader, scanned));
}
if (report.inLoaderButNoManifest.length > 0) {
  console.warn(`[manifestPlugin] Loaders exist without manifest entry: ...`);
}
```

错误信息实例(`formatMismatchError` 实际输出):

```text
[manifestPlugin] Manifest/Loader mismatch detected:

  in manifest but no loader (1):
    - <id> (component.config.ts exists at <path>, but the matching index.{vue,tsx} is missing in the same directory)

These would cause runtime errors like:
  "No loader registered for X" when opening detail page
  silent invisibility — card never shows up

Fix:
  - Create index.{vue,tsx} in the component directory (matching the framework in its config)
  - Or remove the entry from component.config.ts if the component is abandoned

Refusing to provide stale manifest. Exiting.
```

## 5. 不变量与触发时机(更新版)

```text
触发位                不变量
─────────────────────────────────────────────────────
编辑器保存            ESLint: id===目录名? framework===所在包?
git commit            husky pre-commit 调 ESLint
dev server 启动       manifest-plugin buildStart: 扫 + 对账
dev server 运行中     watcher add/change/unlink → 200ms debounce → 重 buildStart → 重对账
production build      同样走 buildStart → 对账 → throw 即 build 失败
详情页 mount          loaders[id](mod) 必须存在(对账拦不住的极端 race)
```

## 6. 剩余改进点

| 改进 | 优先级 | 状态 |
|---|---|---|
| `framework === mount.kind` 校验 | P1 | 未实现(`framework-architecture-review.md` §5 P1#2) |
| `entry` 文件存在性校验 | P1 | 未实现(同 §5 P1#3,loader 仍写死 `index.{vue,tsx}`) |
| Manifest Schema 完整校验 | P1 | 未实现(`manifest.schema.json` 只校验顶层,§5 P1#4) |
| 中文 group ID 兜底 | P0 | **已实现**(`generator.ts:115-128` ASCII → empty → `group-${hash8}-${len}`) |
| Vite Plugin 集成测试覆盖 reconcile / watcher / dev middleware | P2 | 未实现(§5 P4#1) |

---

## 7. 关联文档

- 审计与 P0/P1/P2 完整清单: [`docs/architecture/framework-architecture-review.md`](../../../docs/architecture/framework-architecture-review.md)
- 契约图(字段状态 + 校验链): [[protocol]]
- 加组件教程: [[how-to-add-component]]
- Dev-only proxy 模式: [[component-level-dev-proxy]]