---
ref: decision-tree
parent: component-troubleshooting
---

# 详情页组件故障决策树

按"症状 → 根因 → 诊断 → 修复 → 验证"组织。每条根因是相互独立的,逐项排除直到问题消失。

---

## 卡片不显示

**症状**: HomePage 卡片列表里找不到 `<id>` 这个组件。

### 根因 1 — `component.config.ts` 不存在或字段错

`manifestPlugin` 在 `buildStart` 扫不到 → 不会进 manifest → 卡片自然没。

**诊断**:
```bash
# 文件存在?
ls packages/{vue,react}-components/src/<id>/component.config.ts

# 字段格式对?
pnpm lint
# 报错来自 valid-component-config 时,这条命中
```

**修复**: 写/修 `component.config.ts`(参考 `web-work-flow` skill 的 how-to-add-component)。`pnpm lint` 通过即可。

### 根因 2 — dev server 监听没生效

`server.watcher.add(watchRoots)` 只在 `manifestPlugin.configureServer` 时调用。如果 manifestPlugin 没进 vite 插件链,watcher 不会装上。

**诊断**:
```bash
# manifestPlugin 是否在 vite.config 链里?
grep -n "manifestPlugin" apps/showcase/vite.config.ts
```

**修复**: 在 `apps/showcase/vite.config.ts` 的 `plugins: []` 里加上 `manifestPlugin({...})`。

### 根因 3 — cards grid 还在用旧 manifest

dev server 改了 manifest 但浏览器没 full-reload。

**诊断**:
- 打开浏览器 console 看是否收到 `full-reload`
- 或 `curl -s http://localhost:5173/__component-manifest.json | grep <id>` 看新组件在不在

**修复**: 手动刷新浏览器。dev server 的 full-reload 是 `server.ws.send({type:'full-reload'})`,客户端连接断开时不会重连,需要手动刷。

---

## No loader registered

**症状**: 详情页 console 报错 `No loader registered for "<id>"`。

### 根因 1 — `id` 与目录名不一致

`import.meta.glob` 按目录名(`/src/<id>/index.vue`)扫,key 是目录名;`ManifestEntry.loaderKey` 默认 = `id`。两者不一致时 lookup 失败。

**诊断**:
```bash
# config 里 id
grep "^  id:" packages/{vue,react}-components/src/<dir>/component.config.ts

# glob 实际扫出来的 key
# dev 起来后访问:
curl -s http://localhost:5173/src/registry/loaders.ts | grep -oE 'src/[a-z-]+/index\.(vue|tsx)'
```

**修复**: 改 `id` 或改目录名,让两者一致。`pnpm lint` 也会自动报这个错。

### 根因 2 — 文件物理上不存在

目录里有 config 但 `index.{vue,tsx}` 缺失。

**诊断**:
```bash
ls packages/{vue,react}-components/src/<id>/
```

**修复**: 创建 `index.vue` 或 `index.tsx`,它是 glob 的扫描目标。

### 根因 3 — `loaderUrl` 写错路径

组件用远程 URL,`loaderUrl` 拼错。

**诊断**:
- 检查 `loaderUrl` 是不是合法 URL
- dev 启动时 `pnpm dev` 输出有 `[vite]` 错误信息

**修复**: 校对 `loaderUrl`,绝对路径直接 `curl` 测一下通不通。

---

## ShadowRoot 没样式

**症状**: 详情页组件能挂载但布局/颜色全无,裸 HTML。

### 根因 1 — Vue SFC `<style>` 没用 `sl-` 前缀

`adoptStylesInto` 扫描 `document.head` 的 `<style>`,克隆**所有**都克隆进 shadowRoot。但如果 scoped 类名不是 `sl-xxx`,看起来像没生效(实际是克隆了,但 scoping 在 light DOM 不命中)。

**诊断**:
打开 dev tools,在 shadow root 里找 `data-sl-clone` 的 `<style>`,看里面有没有该组件的类。

**修复**: 类名加 `sl-` 前缀。

### 根因 2 — React 组件没 side-effect import CSS

React 组件 `import './index.css'` 放在文件**顶部**,Vite 才会在 import 时把 CSS 注入 document.head。如果忘了 import,样式根本没生成。

**诊断**:
```bash
grep "import.*\.css" packages/react-components/src/<id>/index.tsx
```

**修复**: 在 `index.tsx` 顶部加 `import './index.css'`。

### 根因 3 — 用 CSS Modules 跨不进 shadow

`.module.css` 生成 `[data-v-xxx]` 哈希类名,只匹配 light DOM。

**诊断**: 组件用了 `.module.css` 或 import 了 module 类。

**修复**: 改为全局 CSS(去掉 `.module`),或用 `:global(.xxx)` 包裹。

---

## mount 抛错

**症状**: 详情页 console 有红色错误,组件没渲染。

### 根因 1 — 模块默认导出缺失

`VueMountAdapter` / `ReactMountAdapter` 都 `throw new Error('XXX: module.default is missing')`。

**诊断**: 看错误文案,关键词 `module.default is missing`。

**修复**: 组件文件加 `export default ...`。

### 根因 2 — Vue patch 在 closed ShadowRoot 下 NotFoundError

理论上 `ShadowRootHost` 默认 `open = true`,但如果手动传 `open: false`,Vue 3 patch reconciler 在 closed ShadowRoot 触发 NotFoundError。

**诊断**: 在 `ShadowRootHost` 调用处检查 `open` 选项。

**修复**: 不要传 `open: false`,或 `ShadowRootHost.ts` 默认改回 open(已经是 open 了,别手动覆盖)。

### 根因 3 — React 组件返回了非 ReactElement

比如默认导出是 hooks 而不是组件。

**诊断**: 看错误文案,关键词 `Element type is invalid`。

**修复**: React 组件 `export default function Component() { return <jsx/> }`。

---

## 路由 404

**症状**: 点卡片 → 详情路由 404。

### 根因 1 — 路由未注册

manifest 没这条 → `registerComponentRoutes` 没注册。

**诊断**: 见"卡片不显示"——同一根因。

### 根因 2 — `route.path` 与 `route.title` 不存在

manifest schema 要求 `route` 字段必填,缺了 manifest 校验失败,build 阶段就该报错。

**诊断**: `pnpm lint`,或 `pnpm --filter @style-library/showcase exec vite build` 看错误。

**修复**: 加 `route: { path: '/components/<id>', title: '...' }`。

---

## ESLint 报错

**症状**: `pnpm lint` 报 `style-library/valid-component-config` 的某种 messageId。

### 修复表

| messageId | 修复 |
|---|---|
| `noDefaultExport` | 加上 `export default { ... }` |
| `idLiteral` | `id` 必须是字符串字面量,不能是变量 |
| `idMismatch` | `id` 必须等于目录名(`packages/.../src/<id>/`) |
| `frameworkLiteral` | `framework` 必须是字符串字面量 |
| `frameworkUnknown` | `framework` 只能是 `'vue'` 或 `'react'` |
| `frameworkMismatch` | `framework` 必须与所在包一致 |
| `routePathLiteral` | `route.path` 必须是字符串字面量 |
| `routePathPrefix` | `route.path` 必须以 `/components/` 开头 |
| `routePathIdMismatch` | `route.path` 必须等于 `/components/<id>` |

完整规则参考 `eslint-rule-authoring` skill。

---

## 仍失败?上报需要的信息

如果决策树走完仍不明,打包以下信息求助:

```bash
# 1. 组件路径与 config 内容
ls packages/{vue,react}-components/src/<id>/
cat packages/{vue,react}-components/src/<id>/component.config.ts

# 2. lint 输出
pnpm lint 2>&1 | head -20

# 3. dev server 实际扫到的 manifest
curl -s http://localhost:5173/__component-manifest.json | python -m json.tool | head -40

# 4. dev server 实际 glob 扫到的 loader key
curl -s http://localhost:5173/src/registry/loaders.ts | grep -oE 'src/[a-z-]+/index\.(vue|tsx)'

# 5. 详情页 console 完整错误

# 6. dev server 终端输出是否有 [vite] 错误
```