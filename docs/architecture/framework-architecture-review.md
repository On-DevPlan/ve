# 框架架构复审

> 评审范围：仅检查框架基础设施，不评价 `packages/vue-components/` 和 `packages/react-components/` 内部的具体组件实现。
>
> 复审日期：2026-07-26  
> 基线提交：`4bd33de`  
> 文档状态：基于当前源码重新核验，不直接沿用上一版结论

## 1. 结论摘要

当前框架的总体方向是正确的：包边界清晰、依赖基本单向，Host 由 Manifest 驱动，Vue/React 的运行时差异通过 Adapter 隔离，Vite 插件也已加入 Manifest 与 Loader Inventory 的构建期对账。

本次复审修正了两个已经过期的旧结论：

1. Manifest 与 Loader **不再完全缺少对账**，当前已有 `loader-inventory.ts`、`reconcile.ts`，并已接入 `vite-plugin.ts`。
2. `no-card-loader` **已经覆盖真实卡片层路径**，提交 `4bd33de` 已将 `apps/showcase/src/components/` 和非 Detail 页面纳入规则范围。

但是，框架仍未完全闭合。当前最重要的问题已经从“完全没有自动发现对账”转为：

```text
Manifest 与 Loader 已经按 ID 对账
但 Contract、Entry、Isolation、Asset 和 Runtime 行为仍未围绕同一语义闭合
```

综合评价：

| 维度 | 评价 |
|---|---:|
| 分层与依赖方向 | 8/10 |
| 自动发现闭合度 | 7.5/10 |
| 契约可信度 | 5.5/10 |
| 运行时生命周期 | 6.5/10 |
| 测试保障 | 6/10 |
| 综合成熟度 | 6.8/10 |

**最终判断：框架值得继续演进，不需要重写；下一步应优先修复真实数据错误和契约失真，而不是继续增加新的抽象字段。**

## 2. 评审范围

### 包含

- `packages/component-contract/`
- `packages/manifest-generator/`
- `packages/mount-adapters/`
- `apps/showcase/src/registry/`
- `apps/showcase/src/pages/DetailPage.vue`
- `apps/showcase/src/manifest-loader.ts`
- `apps/showcase/src/main.ts`
- `apps/showcase/vite.config.ts`
- 框架级 ESLint 规则
- Vitest workspace 与框架测试
- 已生成的 `apps/showcase/dist/component-manifest.json`

### 不包含

- Vue/React 组件内部业务逻辑
- 组件内部文件大小、UI 质量、重复领域代码
- 组件专属外部 API 或资源配置

## 3. 当前架构概览

```text
component.config.ts
        ↓
Scanner + AJV
        ↓
Manifest Generator
        ↓
Loader Inventory
        ↓
Manifest / Loader Reconcile
        ↓
Vite Plugin
  ├── Dev Middleware
  ├── Watcher
  └── Production Emit
        ↓
Host Registry / Router / Search / Loaders
        ↓
DetailPage Mount Lifecycle
        ↓
Vue / React Adapter
        ↓
ShadowRootHost
```

### 3.1 模块职责评价

| 模块 | 职责 | 复审评价 |
|---|---|---|
| `component-contract` | Type、Schema、运行时协议 | 边界正确，但定义面明显大于真实运行时 |
| `manifest-generator` | 配置扫描、Manifest 生成、Loader 对账 | 已比上一版完整，但静态不变量仍未闭合 |
| `mount-adapters` | Vue/React 挂载差异 | 抽象合理，但错误、Portal、Theme、Isolation 语义不统一 |
| `showcase/registry` | Registry、Search、Router、Loader | 分工清楚，复杂度适中 |
| `DetailPage` | 挂载生命周期编排 | 位置正确，但资源所有权仍由多个变量协调 |
| ESLint 规则 | 目录约束和首屏加载边界 | 真实路径覆盖已修复，但调用表达式覆盖仍不完整 |

## 4. 已确认的优点

### 4.1 包边界和依赖方向合理

当前 Contract、构建工具、运行时 Adapter 和 Host 基本保持单向依赖。框架没有把组件发现、路由注册、挂载实现和页面状态全部放进一个模块。

这为后续增加以下能力保留了合理扩展点：

- 新的组件包；
- 新的 Host；
- 新的框架 Adapter；
- 远程 Loader；
- 其他 Manifest 消费者。

### 4.2 Manifest 驱动 Host 的方向正确

首页卡片、搜索、分组和详情路由都来自 Manifest 元数据，组件实现只在详情页加载。这保持了明确的首屏边界：

```text
首页 → 元数据
详情页 → 实现代码
```

### 4.3 Manifest / Loader 已有构建期对账

当前已经存在：

- `packages/manifest-generator/src/loader-inventory.ts`
- `packages/manifest-generator/src/reconcile.ts`
- `packages/manifest-generator/src/vite-plugin.ts:51-70` 的对账接入

其行为是：

```text
Manifest 有，Loader 无 → 构建失败
Loader 有，Manifest 无 → 警告但不阻断
两边都有 → 一致
```

这个设计是合理的。它将原本只能在详情页出现的 `No loader registered` 提前到了构建阶段。

### 4.4 Adapter 是真实的变化点

Vue 使用 `createApp`，React 使用 `createRoot`。将两种生命周期隐藏在 `MountAdapter` 后面是合理抽象，而不是为了使用设计模式而设计。

### 4.5 DetailPage 已考虑异步切换

`DetailPage.vue` 使用 `AbortController` 处理路由快速切换，避免旧 Loader 完成后继续挂载到当前页面。这说明框架已经考虑了异步生命周期，而不是只处理理想顺序。

## 5. 主要发现

## P0 — 中文 group 会生成空 ID，且产物已证实

### 证据

`packages/manifest-generator/src/generator.ts:102-107`：

```ts
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

纯中文文本会先被替换成 `-`，随后首尾 `-` 被删除，最终得到空字符串。

当前构建产物 `apps/showcase/dist/component-manifest.json:399-447` 已经出现：

```json
{ "id": "", "title": "导航" }
{ "id": "", "title": "数据可视化" }
{ "id": "", "title": "基础" }
{ "id": "", "title": "数据展示" }
```

### 影响

当前 UI 主要使用 group title，因此尚未直接崩溃。但 `ManifestGroup.id` 已失去唯一标识语义。未来一旦用于 Vue key、URL、缓存或过滤，就会发生冲突。

### 建议

必须保证：

```text
不同 group title → 不同且非空的 group ID
```

推荐方案：

```text
优先生成 ASCII slug
如果为空，则使用稳定 hash
```

长期可以把 group 从字符串拆成：

```ts
interface GroupRef {
  id: string;
  title: string;
}
```

## P1 — 静态不变量仍未形成统一校验阶段

当前 AJV 只负责 `ComponentConfig` 的基础形状，generator 也只实现了部分仓库关系检查。

仍未校验：

- `framework === mount.kind`；
- `entry` 文件存在；
- `entry` 扩展名与 framework 一致；
- 完整 SemVer；
- group ID 非空且唯一；
- Manifest 输出是否符合完整 Schema。

### 风险

例如以下配置可以进入构建链：

```ts
{
  framework: 'vue',
  mount: { kind: 'react' }
}
```

错误最终会在 Adapter 挂载阶段出现，报错位置离根因过远。

### 建议

增加独立的 Repository Invariant Validator：

```text
扫描配置
  ↓
AJV 校验数据形状
  ↓
校验仓库关系不变量
  ↓
生成 Manifest
  ↓
校验 Manifest 输出
  ↓
Loader 对账
  ↓
提供 / Emit
```

## P1 — `entry` 仍然不是组件入口的事实来源

### 当前状态

`ComponentConfig.entry` 是必填字段，但：

- `scanner.ts` 不检查对应文件是否存在；
- `generator.ts` 不使用它生成 Loader；
- `loaders.ts` 仍通过固定的 `index.vue` / `index.tsx` glob 发现实现；
- Loader key 仍从目录名推导。

### 评价

当前框架同时表达了两套互相冲突的语义：

```text
契约语义：entry 可配置
运行时语义：入口必须是固定 index 文件
```

Loader Inventory 解决了“ID 集合是否一致”，但没有解决“配置的 entry 是否真的是 Loader 入口”。

### 建议

必须二选一：

#### 方案 A：真正支持 `entry`

- 校验文件存在；
- 校验扩展名；
- Loader Inventory 按 `entry` 构建；
- Loader 与 Manifest 使用同一入口信息。

#### 方案 B：采用固定约定

固定：

```text
src/<id>/index.vue
src/<id>/index.tsx
```

然后删除作者可配置的 `entry`，或将它改为生成器派生字段。

## P1 — Manifest Schema 没有形成真实输出保障

`packages/component-contract/src/manifest.schema.json` 当前存在两个问题：

1. 仓库没有实际代码编译或调用它；
2. Schema 只检查顶层字段和容器类型，没有描述 `ManifestEntry`、`ManifestGroup` 和 `SearchManifest` 的内部结构。

`generateBundle` 直接执行：

```ts
JSON.stringify(plugin.cachedManifest)
```

然后 Emit，生成结果没有再经过校验。

### 影响

`slugify()` 的空 ID 就是一个已经穿过生成流程并进入产物的实例。

### 建议

增加 `validateManifest()`：

```text
generateManifest()
  ↓
validateManifest()
  ↓
reconcile()
  ↓
emit
```

并让 Manifest Schema 完整定义内部结构，而不是只校验数组或对象类型。

## P1 — Contract 声明的能力大于运行时能力

以下字段当前存在明显的“写入但无消费者”或“只实现一部分”问题：

```text
MountConfig.exportName
MountConfig.propsMode
MountConfig.eventPrefix
MountConfig.requiresReactRoot
MountConfig.unmountTimeoutMs
IsolationConfig.mode
IsolationConfig.delegatesFocus
IsolationConfig.adoptedStyleSheets
IsolationConfig.allowGlobalStyles
RouteConfig.query
PropsConfig
ThemeConfig.requiredTokens
CapabilityConfig
DocsConfig
```

### 关键例子：`IsolationConfig.mode`

`DetailPage.vue` 无论 `entry.isolation.mode` 是什么，都会创建 `ShadowRootHost`。

因此：

```text
shadow-dom
css-module
global
```

目前没有真正选择不同 Host 策略。

### 评价

这些字段不应全部归类为“Bug”，但它们降低了 Contract 的可信度。类型和 Schema 允许填写某项能力时，下游作者会自然认为该能力已生效。

### 建议

拆分：

```text
Active Contract：已实现且有测试
Planned Contract：仅设计阶段
```

如果当前只可靠支持 `shadow-dom`，则应暂时只允许这一种模式，或者明确拒绝其他模式，而不是接受配置后静默忽略。

## P1 — Mount 上下文存在重复和未消费通道

### 当前状态

`ShadowRootHost` 创建 `portalTarget`，`DetailPage` 将其作为 `context.container` 传给 Adapter；但 Vue/React Adapter 都没有使用 `context.container`，而是重新在 `context.shadowRoot` 下创建自己的 `<div>`。

同时：

- `MountContext.theme` 被构造；
- `ShadowRootHost` 也直接接收 `tokens`；
- Adapter 不消费 `context.theme`。

### 影响

Contract 中同时存在两套挂载目标和两套主题通道：

```text
host.portalTarget vs adapter 自建 portal
MountContext.theme vs ShadowRootHost.tokens
```

这使责任边界不清楚。

### 建议

收敛为：

```text
ShadowRootHost
  ├── 创建并拥有 portalTarget
  ├── 注入主题 token
  └── 注入当前 entry 的样式

Adapter
  ├── 使用 context.container 挂载
  └── 只负责 mount / unmount
```

## P1 — Vue 运行时错误无法完整传播给 Host

当前 `VueMountAdapter` 已经比旧版本更好：

- 已知 ShadowRoot patch 错误会被过滤；
- 未知同步 `app.mount()` 错误会记录并重新抛出。

但 Vue `app.config.errorHandler` 捕获的渲染期或生命周期错误只能 `console.error`，无法重新进入 `mount()` 的同步 try/catch。因此文档中“重新抛给 Host ErrorBoundary”的表述仍不准确。

### 建议

框架应明确两类错误语义：

```text
同步挂载失败 → mount() reject，由 DetailPage 显示
挂载后的运行时错误 → Adapter Error Channel / Host Reporter
```

不要声称所有 Vue 错误都能通过 `mount()` Promise 传播。若需要统一处理，应给 `MountContext` 增加显式 `reportError(error)`，而不是依赖框架内部异常重新抛出。

## P1 — Manifest 中的构建信息和资源字段不可信

### `buildId`

`apps/showcase/vite.config.ts` 调用 `manifestPlugin()` 时没有传 `buildId`，因此生产构建也使用默认值：

```json
"buildId": "dev"
```

### `assets.entryChunk`

Generator 写入：

```text
assets/<id>.js
```

实际 Vite 产物使用：

```text
vc-<id>-<hash>.js
rc-<id>-<hash>.js
```

`vite.config.ts` 没有传 `resolveAssetUrl`，因此 Manifest 中的 `entryChunk` 不对应真实文件。

### 当前影响

Host 目前通过 `import.meta.glob` Loader 加载组件，并不消费 `assets.entryChunk`，所以当前不会直接 404。

### 评价

这是明确的契约失真：字段存在于产物中，但值不能作为真实资源定位使用。

### 建议

二选一：

- 在 Rollup 生成 chunk 后写入真实资源文件名；
- 在没有消费者之前删除 `entryChunk` 和空的 `cssChunks`，避免产生虚假资产清单。

生产 `buildId` 应来自 commit SHA、构建流水线 ID 或明确传入的稳定标识。

## P2 — 挂载资源所有权仍需收敛

`DetailPage.vue` 仍分别维护：

```ts
currentAbort
currentHost
currentUnmount
```

当前 Abort 检查已经覆盖多数快速切换场景，但资源所有权需要跨多个变量和多个 return 分支推理。

### 建议

引入单一 `MountSession`：

```ts
interface MountSession {
  controller: AbortController;
  host: ShadowRootHost;
  mounted?: MountedComponent;
  cleanup(): void | Promise<void>;
}
```

Host 只保存：

```ts
let currentSession: MountSession | null;
```

每次挂载尝试负责清理自己创建的全部资源。

## P2 — Shadow DOM 样式有两套重叠机制

当前存在：

1. `ShadowRootHost.stylesheetUrls`：拉取 CSS 后注入；
2. `style-adoption.ts`：扫描 `document.head` 并复制全部 style。

当前第一条路径没有接线，第二条路径真实生效，但无法区分样式属于 Host 还是当前组件。

### 建议

短期只保留一条明确路径；长期让 Manifest/Loader 提供 entry-scoped style assets：

```text
当前 entry
  ├── Runtime Loader
  └── Style Assets
```

不要依赖扫描整个 `document.head` 推断样式归属。

## P2 — `no-card-loader` 的路径覆盖已修复，但语义覆盖仍不完整

### 已修复

提交 `4bd33de` 已将以下真实路径纳入卡片层：

- `apps/showcase/src/components/`
- `apps/showcase/src/pages/` 中非 Detail 页面
- `*Card.vue/tsx/jsx`

因此上一版“规则没有覆盖 `ComponentCard.vue`”的结论已失效。

### 仍存在的问题

规则注释和错误描述声称会拦截：

```text
loaders[id]()
useLoaders()[id]()
```

但实现只识别：

```text
entry.loader()
entry.load()
registry.load()
```

### 建议

要么补充 computed MemberExpression 和 `useLoaders()` 返回值调用的 AST 检测，要么收缩注释与错误描述，不要声明尚未实现的保护范围。

## P2 — 测试没有覆盖框架最关键的跨层行为

### Vite Plugin

`packages/manifest-generator/__tests__/vite-plugin.test.ts` 只覆盖：

- plugin name；
- `buildStart` 填充缓存。

未覆盖：

- Manifest/Loader mismatch 抛错；
- Loader-only warning；
- dev middleware 503 与 JSON 响应；
- watcher add/change/unlink；
- 200ms debounce；
- regenerate 失败时保留旧缓存；
- `generateBundle` Emit；
- `resolveAssetUrl`。

### Host Bootstrap

以下关键链路没有端到端测试：

```text
loadManifest
→ createRegistry
→ createSearchIndex
→ registerComponentRoutes
→ setLoaders
→ app.mount
```

### 首屏性能

`e2e-perf.test.ts` 主要检查 HTML 和产物文件名，不能证明入口 chunk 没有间接导入组件实现 chunk。

### 建议

下一轮测试预算应优先用于跨层集成，而不是继续增加孤立的类型断言测试。

## 6. 已修正的旧结论

| 旧结论 | 复审结果 |
|---|---|
| Manifest 与 Loader 完全没有对账 | 已过期。当前已有 Inventory + Reconcile + Vite Plugin 接入 |
| `no-card-loader` 不覆盖真实 `ComponentCard.vue` | 已过期。提交 `4bd33de` 已覆盖真实卡片层路径 |
| Vue Adapter 完全吞掉所有错误 | 部分过期。同步未知 mount 错误已重抛；挂载后的 Vue 错误仍只能记录 |
| `MountedComponent.update` 不一致是 Bug | 不是类型错误；它是 optional，但当前没有 Host 更新数据流，属于未闭合能力 |
| AdapterFactory 每次创建 Adapter 是高风险问题 | 严重度过高。当前只是轻量对象分配和实现与注释不一致，不是主要架构风险 |

## 7. 抽象程度评估

### 7.1 应保留的抽象

- `component-contract`
- `manifest-generator`
- Loader Inventory / Reconcile
- `MountAdapter`
- `ShadowRootHost`
- `ComponentRegistry`
- `RouterRegistrar`
- `SearchIndex`
- Vite `import.meta.glob`

这些模块都对应真实变化点。

### 7.2 应收敛的抽象

- 未消费的 `MountConfig` 字段；
- 未真正生效的三种 Isolation Mode；
- 两套 Portal 目标；
- 两套主题通道；
- 两套样式注入通道；
- 不对应真实产物的 Assets 字段；
- 没有消费者的 Route、Props、Capability、Docs 字段。

### 7.3 判断标准

一个抽象只有满足以下条件才算闭合：

```text
责任方明确
事实来源唯一
数据流完整
错误语义明确
不变量有测试
```

当前框架在模块分层上做得较好，但 Contract → Manifest → Asset → Runtime 的完整闭合度仍不足。

## 8. 建议的目标架构

```text
ComponentConfig
      ↓
Config Shape Validator
      ↓
Repository Invariant Validator
      ↓
ComponentManifest
      ↓
Manifest Validator
      ↓
Loader Inventory Reconcile
      ↓
Host Registry
      ↓
MountSession
      ├── Runtime Loader
      ├── ShadowRootHost
      ├── Adapter
      ├── Error Reporter
      └── Cleanup
```

### 8.1 构建期负责

```text
配置形状
ID 唯一性
framework / mount 一致性
entry 存在性和扩展名
SemVer
非空且唯一的 group ID
Manifest 输出形状
Loader 对账
真实 asset 元数据
```

### 8.2 运行时负责

```text
加载实现
选择 Adapter
创建 MountSession
执行挂载
报告运行时错误
释放资源
```

运行时不应该再发现本可以在构建期拒绝的仓库关系错误。

## 9. 推荐执行顺序

### 第一阶段：修复真实数据和静态不变量

1. 修复中文 group ID，并增加非 ASCII 测试。
2. 增加 `framework === mount.kind` 校验。
3. 校验 entry 文件存在和扩展名。
4. 实现完整 SemVer 校验。
5. 补全并接入 `validateManifest()`。

### 第二阶段：收敛 Contract

6. 决定 `entry` 是真实入口还是固定约定派生字段。
7. 只保留真实支持的 Isolation Mode，或实现模式分流。
8. 删除或标记未接线的 Mount、Route、Props、Capability、Docs 字段。
9. 修正 `buildId` 和 `assets.entryChunk`，或者删除不可信字段。

### 第三阶段：收敛运行时责任

10. 引入 `MountSession`。
11. 让 Adapter 使用 `context.container`，删除重复 Portal。
12. 让主题和样式只由 `ShadowRootHost` 负责。
13. 为挂载后的运行时错误提供显式 Error Reporter。
14. 合并 Shadow DOM 样式注入策略。

### 第四阶段：补齐跨层测试

15. 测试完整 Vite Plugin 生命周期。
16. 测试 Manifest / Loader 对账的失败和恢复。
17. 测试 Host Bootstrap 全链路。
18. 测试快速路由切换的资源清理。
19. 验证入口 chunk 的实际依赖图，而不只检查 HTML 字符串。

## 10. 验证清单

### Contract 与构建

- [ ] 中文 group 能生成唯一且非空的 ID。
- [ ] `framework !== mount.kind` 时构建失败。
- [ ] entry 不存在时构建失败。
- [ ] entry 扩展名和 framework 不一致时构建失败。
- [ ] 非法 SemVer 被拒绝。
- [ ] 生成 Manifest 在 Emit 前通过完整 Schema 校验。
- [ ] 生产 `buildId` 不再是 `dev`。
- [ ] Manifest Asset 字段对应真实构建产物。

### 自动发现

- [x] Manifest 有、Loader 无时构建失败。
- [x] Loader 有、Manifest 无时产生警告。
- [ ] 对账流程具备 Vite Plugin 集成测试。
- [ ] `entry` 与 Loader 的关系明确且可验证。

### 运行时

- [ ] `isolation.mode` 真正决定 Host 策略，或只允许一种模式。
- [ ] Adapter 使用唯一的 Portal 目标。
- [ ] 主题注入只有一个责任方。
- [ ] 挂载后错误能通过明确的 Error Reporter 上报。
- [ ] 每次挂载尝试拥有独立 MountSession。
- [ ] abort、失败和路由离开都能释放全部资源。

### 性能边界

- [x] 真实卡片层路径受 ESLint 规则保护。
- [ ] ESLint 规则真正覆盖 `loaders[id]()` 与 `useLoaders()[id]()`。
- [ ] 首屏入口 chunk 的依赖图不包含组件实现 chunk。

## 11. 最终判断

当前框架的骨架是正确的，而且 Manifest/Loader 对账已经补上了上一版最明显的结构缺口。

现在最主要的问题不再是“没有框架设计”，而是：

```text
Contract 声明了很多能力
Manifest 输出了很多字段
但 Runtime 和 Build 并没有保证这些能力与字段真实有效
```

因此下一步不应继续添加更多 Factory、Registry 或配置字段，而应完成以下收敛：

```text
一个可信的 Config
→ 一组构建期不变量
→ 一份经过校验的 Manifest
→ 一份真实的 Loader / Asset Inventory
→ 一个拥有明确所有权的 MountSession
→ 一套统一的错误、主题和样式协议
```

完成这些工作后，框架的扩展成本和理解成本都会明显下降。
