---
ref: architecture-and-design-philosophy
parent: web-work-flow
source: docs/superpowers/specs/2026-07-23-vue-react-microfrontend-component-showcase-design.md
---

# ref1: Architecture & Design Philosophy

详细讲述 wb 项目的架构设计哲学。**先读 `docs/superpowers/specs/2026-07-23-vue-react-microfrontend-component-showcase-design.md`**,这份 ref 是它的导读与决策摘要。

---

## 1. 为什么 Vue 当 Host(而不是 React)

| 维度 | Vue 3 | React 19 |
|---|---|---|
| 异步组件 / 动态导入 | `<script setup>` + `defineAsyncComponent` 原生一流 | 需要 `React.lazy` + `<Suspense>` 配合 |
| 路由懒加载 | `() => import('./X.vue')` 一行 | 同上但需配 boundary |
| 容器副作用(provide/inject) | 简洁,运行时无 Provider 树污染 | React Context + Provider 树,跨 framework 边界更复杂 |
| 生态成熟度 | 国内主流 + Element Plus 等 | 国际主流 + shadcn/ui |

**关键决策**: Host 用 Vue 因为:

1. 容器是 Vue 天然舒适区(`provide/inject`、`createApp`、`app.config.errorHandler`)
2. Vue 不强制 React Context 那样的 Provider 树嵌套
3. 对"先有 Vue,后塞 React"的混部场景,Vue 当容器比 React 当容器简洁

## 2. 跨框架组件互操作(关键问题: React 怎么挂在 Vue 上?)

**答案**: **Adapter 模式 + ShadowRoot 隔离**。不共享运行时,只共享 DOM 节点。

```text
Vue Host (createApp)
  └─ <RouterView/>
       └─ <DetailPage/> (Vue)
            └─ <div ref="containerRef"/>     ← ShadowRoot 挂载点
                 └─ ShadowRoot (open mode,Vue 3 patch 兼容)
                      ├─ <style> 主题 contract (CSS Variables)
                      ├─ <div data-sl-portal/>   ← 组件 root
                      └─ React/Vue 组件实例
```

**为什么不共享运行时**:

- React 19 的 createRoot 假设单一 React reconciler
- Vue 3 的 createApp 假设单一 Vue runtime
- 共享 DOM 节点 = 共享样式隔离边界 = 任何一方的全局副作用(React StrictMode / Vue devtools)都会污染另一边

**Adapter 接口契约** (`packages/component-contract/src/types.ts`):

```ts
export interface MountAdapter {
  canHandle(framework: Framework): boolean;
  mount(module: unknown, context: MountContext): Promise<MountedComponent>;
}
export interface MountContext {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  props: Record<string, unknown>;
  theme: ThemeRuntime;
  signal: AbortSignal;
}
export interface MountedComponent {
  update?(props): void;
  unmount(): void;
}
```

`VueMountAdapter` / `ReactMountAdapter` 都实现这个接口,**Host 完全不知道当前挂的是 Vue 还是 React**。

## 3. Vite 角色(为什么不是 Webpack)

| 维度 | Vite 5 | Webpack 5 |
|---|---|---|
| dev 启动 | ESM 直送 + esbuild 预构建(<1s) | 全量打包(10s+) |
| HMR 粒度 | 模块级 ESM 替换 | 重新构建依赖图 |
| 生态友好 | Rollup 插件直接复用 | 自家 loader/plugin 体系 |
| Shadow DOM / Module Federation | `@originjs/vite-plugin-federation` 等 | 自有 module federation 协议 |

**wb 用 Vite 的关键能力**:

1. **`import.meta.glob`** 在构建时扫描 `packages/*/src/*/index.{vue,tsx}`,自动生成静态 import 表,各组件分别打成独立 chunk。**不支持 `@` alias**,必须用相对路径。
2. **Vite 插件机制** → 自定义 `manifestPlugin` 在 dev 阶段挂中间件 `GET /__component-manifest.json`、在生产构建通过 `emitFile` 产出 `component-manifest.json`
3. **动态 import()** 自动生成独立 chunk(`vc-button.js` / `rc-data-table.js` / `vc-map.js`)

## 4. 设计模式清单

| 模式 | 位置 | 作用 |
|---|---|---|
| **Factory** | `createAdapters()` (原 `createAdapterFactory`) | 把 Vue/React adapter 列表集中创建;Host 不直接 new adapter |
| **Adapter** | `VueMountAdapter` / `ReactMountAdapter` | 抹平 framework 差异,Host 只看到统一 MountContext |
| **Registry** | `ComponentRegistry` | 维护 manifest 的组件清单 + 详情路由注册 |
| **Observer** | `vue-watch(componentId)` + `ResizeObserver` (map) + `search-results computed` | 数据驱动而非命令式 |
| **Encapsulation via Shadow DOM** | `ShadowRootHost` | 隔离样式 + 第三方全局副作用(ShadowRoot 默认 `open` 模式,以兼容 Vue 3 patch 行为) |
| **Constructor Injection** | `app.provide(LoadersKey, setLoaders(manifest))` | 取代全局变量,跨测试和 SSR 友好 |
| **Strategy** | `selectAdapter(adapters, framework)` | 运行时选 adapter |
| **Discovery (build-time)** | `import.meta.glob` (loader 维度) + `manifestPlugin` (metadata 维度) | 不需要手动注册新组件 |

## 5. 自动发现机制 — 双轨制

wb 的"加组件 = 零配置"靠两条独立的扫描路径协作:

### 5.1 Loader 维度:`import.meta.glob`

文件:`apps/showcase/src/registry/loaders.ts`

```ts
const vueModules = import.meta.glob(
  '../../../../packages/vue-components/src/*/index.vue',
);
const reactModules = import.meta.glob(
  '../../../../packages/react-components/src/*/index.tsx',
);
```

Vite 在构建时扫描文件系统,为每个匹配项生成一个 `() => Promise<unknown>` 的静态 import。运行时 `scanToMap()` 按目录名抽出 `id`,作为 loader key。

- **优点**:Vite 原生、各组件天然分 chunk、无虚拟模块开销
- **约束**:`import.meta.glob` 不解析 `@` alias,glob 字符串必须是相对当前文件的字面量路径
- **覆盖**:`setLoaders(manifest)` 会用 `entry.loaderUrl` 覆写 glob 结果——给远程 CDN 组件留出口

### 5.2 Metadata 维度:`manifestPlugin`

文件:`packages/manifest-generator/src/vite-plugin.ts`

```text
[buildStart]
  scanner.ts 用 fast-glob 扫 packages/*/src/*/component.config.ts
  ajv 校验 ComponentConfig schema
  generator.ts 聚合为 ComponentManifest
  ↓ 写 plugin.cachedManifest

[dev 中间件] GET /__component-manifest.json → 返回 cachedManifest
[prod emitFile] 产出 dist/component-manifest.json

[watcher]
  server.watcher.add(watchRoots)        // 显式加入 packages/*/src/
  on 'add' / 'change' / 'unlink':
    - 文件名包含 component.config 才处理(过滤其它文件)
    - debounce 200ms(防 Windows 写入竞态)
    - regenerateManifest() 重建缓存
    - server.ws.send({ type: 'full-reload' })  // 不发 HMR,manifest 是结构数据
```

### 5.3 双轨的职责分工

| 关注点 | Loader(`import.meta.glob`) | Metadata(`manifestPlugin`) |
|---|---|---|
| 产出 | 静态 import() 函数(分 chunk 用) | JSON manifest(详情路由 + 元数据) |
| 新增组件响应 | dev 重启后(buildStart) / prod rebuild | dev 自动(full-reload) / prod rebuild |
| 失败影响 | 详情页 mount 失败 | 卡片不显示 / 路由不生效 |
| 何时被消费 | `setLoaders()` + `app.provide(LoadersKey)` | `loadManifest()` → registry |

### 5.4 ESLint 闸门:`valid-component-config`

文件:`eslint/rules/valid-component-config.js`

文件以文件名匹配触发,只对 `component.config.ts` 生效。校验项:

| # | 校验 | 错误信息示例 |
|---|---|---|
| 1 | 必须是 `export default { ... }` 字面量对象 | `must have an export default { ... } object` |
| 2 | `id` 必须是字符串字面量,且等于目录名 | `id must equal the directory name. Expected "foo", got "bar"` |
| 3 | `framework` 必须是 `'vue'` / `'react'`,且与所在包匹配 | `framework must match the package directory. Package is vue-components, framework is "react"` |
| 4 | `route.path` 必须以 `/components/` 开头 | `route.path must start with "/components/"` |
| 5 | `route.path` 必须等于 `/components/<id>` | `route.path must be "/components/foo", got "/components/bar"` |

> ajv schema 与 ESLint 规则职责不重叠:ajv 负责"字段类型 / 必填 / SemVer",ESLint 负责"与文件系统结构的一致性"。

## 6. 组件挂载流程(细节)

```text
DetailPage (Vue)
  ↓ watch(componentId)
  ↓ loader = inject(LoadersKey)[componentId]
  ↓ loader() → import('@style-library/vue-components/src/button/index.vue')
  ↓ ShadowRootHost.create({ container, tokens }) → open ShadowRoot
  ↓ adapter.mount(mod, context)
       - Vue: createApp(component).mount(portal)
       - React: createRoot(portal).render(<Component/>)
  ↓ adoptStylesInto(shadowRoot)  // 共享样式 adoption(见 §6.1)
  ↓ register event listeners / ResizeObserver
  ↓ cleanup on unmount: adapter.unmount() + destroy ShadowRoot
```

### 6.1 CSS adoption(Shadow DOM 的最大坑)

文件:`packages/mount-adapters/src/style-adoption.ts`(Vue/React adapter 共用)

Vite 把 SFC `<style scoped>` 转成 `[data-v-xxx]` 选择器后注入到 `document.head`,这些选择器**只匹配 light DOM**,shadow root 内永远不命中。

修复: 每次 mount 时扫描 `document.head` 新出现的 `<style>` 标签,把 CSS 文本克隆进 ShadowRoot,按 djb2 指纹去重。

```ts
export function adoptStylesInto(shadowRoot: ShadowRoot): void;
```

- **共享**:Vue adapter / React adapter 都从同一文件 import,共用一个 `WeakMap<ShadowRoot, Set<string>>`
- **去重**:`styleFingerprint` 取 djb2 哈希前 8 位 + 文本长度作为指纹;同一 ShadowRoot 多次调用不会重复克隆
- **GC 友好**:WeakMap 在 ShadowRoot 被卸载时自动清理,不留内存泄漏
- **注意**:Vue adapter 之前有一个 `_module` 死参数,已经在重构中删除;签名就是 `adoptStylesInto(shadowRoot)` 单参

## 7. 性能目标(为什么这么设计)

| 目标 | 设计支撑 |
|---|---|
| 首页不下载组件实现 | CardGrid 只读 metadata;没有 entry import |
| 详情页按组件分 chunk | `import.meta.glob` 生成的 `import()` 各自成 chunk + Vite manualChunks |
| 加 / 删组件 dev server 立即响应 | manifestPlugin watcher(add/unlink/change + 200ms debounce + full-reload) |
| 切换路由不卡 | ShadowRootHost destroy + 旧 adapter.unmount + AbortController 取消旧任务 |
| 主题 token 不重复定义 | `:host { --sl-* }` 写一次,所有组件继承 |
| 跨 fragment 复用样式 | adoptStylesInto + djb2 指纹全局去重,WeakMap 跨 adapter 共享 |

## 8. 设计取舍(已确认)

| 取舍 | 选择 | 理由 |
|---|---|---|
| Module Federation 还是 dynamic import | dynamic import | 第一阶段无远程发布需求;Federation 协议复杂 |
| Pinia 还是 composable | composable (ref/computed/inject) | 零依赖,跨包无副作用 |
| Pinia 还是 MobX | N/A | 状态量小,不需要外部 store |
| SSR | 不做 | 展示中心是 SPA,首次首屏不敏感 |
| iframe 还是 Shadow DOM | Shadow DOM | 共享 cookie/localStorage、避免 iframe sandbox 通信延迟 |
| virtual module 还是 import.meta.glob | import.meta.glob | Vite 原生支持,无需自写 Rollup 插件钩子 |
| 手动 knownLoaders 还是 import.meta.glob | import.meta.glob | 加组件零配置,扫掉了维护成本 |

## 9. 关键文件路径

```
packages/component-contract/     # 类型 + JSON Schema + ajv validator
packages/manifest-generator/    # scanner + generator + Vite 插件(manifestPlugin)
packages/mount-adapters/        # ShadowRootHost + VueMountAdapter + ReactMountAdapter + style-adoption(共享)
                                 # + AdapterFactory(createAdapters / selectAdapter)
packages/vue-components/        # Vue 组件单元
packages/react-components/      # React 组件单元
apps/showcase/                  # Vue 3 Host 应用
apps/showcase/src/registry/
  loaders.ts                    # import.meta.glob + setLoaders(manifest) + LoadersKey
eslint/rules/
  valid-component-config.js     # 自定义 ESLint 规则(目录/包/路由一致性)
docs/superpowers/specs/         # 完整设计文档(本 ref 是其导读)
```

## 10. 相关 spec 文档

完整设计在 `docs/superpowers/specs/2026-07-23-vue-react-microfrontend-component-showcase-design.md`。本 ref 只是它的导读与决策摘要,具体字段、错误码、降级策略、e2e 验收标准请回查 spec 原文。