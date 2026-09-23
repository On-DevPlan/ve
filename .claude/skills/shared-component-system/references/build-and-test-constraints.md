# 构建与测试约束（分包 / vitest）

> 这些规则全部来自实测踩坑，注释已写在对应文件里（`apps/showcase/vite.config.ts`、`packages/mount-adapters/src/index.ts`、根 `vitest.workspace.ts`）。动它们的配置前先读本 ref。

## 分包：manualChunks（apps/showcase/vite.config.ts）

两条 shared 专用规则排在规则 0，优先于组件 chunk 规则：

1. `id.includes('/apps/showcase/src/shared/components/runtime/SharedMount.tsx')` → `shared-bridge-react`
2. `id.includes('/apps/showcase/src/shared/components/')` → `shared-components`

**为什么必须独立、且只能一个实例**：没有这条规则 Rollup 会把共享层并进第一个到达它的*组件* chunk，结果是 rc-color-studio 等 React 组件 chunk 反过来 import vc-game-skin-admin —— 点开任意 React 组件都要多拉 108KB 的 Vue 组件 chunk。

**为什么 SharedMount.tsx 必须与本体分开**：它 `import * as React from 'react'`，与本体同 chunk 的话，凡加载共享组件的 chunk（vc-game-skin-admin、连 DetailPage 也是）都顺着静态 import 拉起 react-vendor（192KB）——「React 不进首页 / 不被 Vue 组件拉进来」正是这套分包的核心目标。

改这两个 id 匹配路径时要同步检查新路径仍落在规则覆盖内。

## mount-adapters 的导入方向

- `packages/mount-adapters/package.json` 增加 exports 子路径：`"./style-adoption": "./src/style-adoption.ts"`。
- 共享层只走 `@style-library/mount-adapters/style-adoption` 子路径，**不走 barrel**：barrel 的 `export * from './ReactMountAdapter.ts'` 会把 react-dom 一并拉进共享 chunk（实测 shared-components chunk 静态 import react-vendor 的直接原因）。
- `adoptStylesInto`（远程组件兜底路径）也不经 barrel 推上公共面（其文件自述带 3 个未修 latent bug，只在该路径触发）。

## vitest 配置（根 vitest.workspace.ts，react-components 工程）

react-components 的测试工作区因共享层含 Vue SFC（React 树里挂 Vue 组件）而需要三样东西：

1. **`plugins: [vuePlugin()]`** —— 否则 import analysis 对 `.vue` 报 "content contains invalid JS syntax"（曾 11 个 suite 一起挂）。
2. **`alias: 'vue'`** → `packages/mount-adapters/node_modules/vue` —— 裸包按本工程 root（packages/react-components）解析，共享层的 vue 不在解析半径内；指向 mount-adapters 是因为共享层运行时依赖由该包声明，且不赌 pnpm 是否把包装到根 node_modules。
3. **长 key alias `@style-library/mount-adapters/style-adoption`** 指到 `src/style-adoption.ts`，且必须写在包名 key 之前 —— alias 是前缀匹配、先命中先用；同时 alias 绕过 package.json exports，而包根下并没有 style-adoption.ts（真文件在 src/ 下）。

**症状→排查表**：

| 症状 | 排查方向 |
| --- | --- |
| "Failed to resolve import \"vue\"" (react-components 工程) | alias 表里 vue 指向是否还在 |
| "Failed to resolve import '@style-library/mount-adapters/style-adoption'" | 长 key alias 是否存在、是否排在包名 key 前面 |
| "content contains invalid JS syntax" 指向 .vue | 该工程是否漏挂 vuePlugin() |
| shared-components chunk 出现在 react-vendor 的 import 链上 | manualChunks 规则 0a 是否被改/被前面的 return 吞掉 |
| 打开 React 组件多拉 vc-game-skin-admin | 规则 0 的路径匹配是否仍命中 |

## 测试基线

相关测试文件（改动前后都应跑）：

- `apps/showcase/__tests__/shared-file-drop-zone.test.ts` — 组件行为
- `apps/showcase/__tests__/shared-host-env.test.ts` — 样式注入策略
- `apps/showcase/__tests__/shared-consumer-game-skin-admin.test.ts` / `shared-consumer-gis.test.ts` — 消费点 variant 分工
- `apps/showcase/__tests__/scoped-id.test.ts` — 任何 `packages/vue-components` 的 `.vue` 改动要更新锁值
- `packages/react-components/__tests__/drop-zone-callers.test.tsx` — 真实挂载断言渲染 `.sl-file-drop--zone` + 锁「不自画 dashed」
- `packages/react-components/__tests__/user-space-kv-ui.test.ts` — 锁 user-space 两条防御性 carve-out

败相特征：**这层的问题几乎都是静默失败**（裸样式 / 裸文字按钮），单测 css:false 拿 `?inline` 是空串 —— 所以样式退化的防线是「读源码锁 + 真实挂载」这两类测试，改样式相关代码别指望单单 mount 快照。

## 错误案例

| 错误操作 | 实际后果 | 正确做法 |
| --- | --- | --- |
| 删掉 manualChunks 规则 0a 或把 SharedMount 并回 shared-components | react-vendor(192KB) 进 Vue 首页链路 | 两类 id 分开成两个 chunk |
| 经 barrel 引 style-adoption | react-dom 进共享 chunk | 子路径导出 |
| 长 key alias 放在包名 key 后面 | 前缀先命中包名 key，子路径 alias 失效 | 长 key 在前（先命中先用） |
| react-components 新增引用共享层却没挂 plugin-vue | 11 个 suite 一起挂 "invalid JS syntax" | 该工程保持 vuePlugin() |
