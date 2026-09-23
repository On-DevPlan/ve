---
name: shared-component-system
description: ve 项目跨框架共享组件系统的使用与扩展指南。当需要在 Vue 树与 React 树共用的组件（apps/showcase/src/shared/components）、新增/修改/消费共享组件（如 FileDropZone）、处理 SharedMount 挂载、样式注入、分包（manualChunks / mount-adapters 子路径）或相关 vitest 报错时触发。
---

# shared-component-system — 跨框架共享组件系统

ve 项目的组件白名单机制：`apps/showcase/src/shared/components/` 下的组件**写一次，Vue 树与 React 树都能用**。每个组件以 descriptor 对外，`SharedMount` 壳负责注入样式并挂载。

**第一条铁律（占 80% 的翻车）**：消费方只 import 目录入口 `@/shared/components/<Name>`（descriptor），经 `<SharedMount :module="...">` 挂载。直接 import `xxx.vue` 会绕过 SharedMount → descriptor.css 无人注入 → 组件以裸样式渲染，且**不报错**。

完整白名单与架构说明见仓库内 `apps/showcase/src/shared/components/README.md`（唯一事实源），本 skill 提炼跨场景通用的操作路径与禁忌。

## 处理路径

按任务类型读对应 ref：

| 任务 | 读这个 ref | 路径 |
| --- | --- | --- |
| 新增一个共享组件 / 改动现有共享组件本体 | [[authoring-shared-components]] | references/authoring-shared-components.md |
| 在调用点（Vue 组件或 React 组件）消费共享组件、改造既有选文件 UI | [[consuming-shared-components]] | references/consuming-shared-components.md |
| 分包异常（chunk 反向拉包、react-vendor 进首页）、mount-adapters 导入、vitest 报 shared 层相关解析错误 | [[build-and-test-constraints]] | references/build-and-test-constraints.md |

## 快速契约卡（所有任务适用）

1. **props 框架无关**：只允许 JSON-ish 值 + 回调函数。禁止 `Ref` / `Slots` / `VNode` / `ReactNode`。对外通信一律 props 回调（`onSelect` / `onReject`），不用 `defineEmits`。
2. **样式独立 style.css + `?inline` 挂 descriptor，不写 SFC `<style>`，不用 scoped**。`plugin-vue`/`css-maps` 两条自动收集通道都不覆盖 `shared/components` 目录；只使用 `--sl-*` 主题 token。
3. **新增组件后跑锁值测试**：任何 `.vue` 内容变化都会改变 scopedId 锁值（`apps/showcase/__tests__/scoped-id.test.ts`），需同步更新。
4. **FAIL 的形态都是静默失败**：样式裸奔、按钮变裸文字、网格调变窄 —— 不报错。改完必须真实渲染验证（既有测试：`drop-zone-callers.test.tsx`、`shared-consumer-*.test.ts`）。

## 错误案例

| 错误操作 | 实际后果 | 正确做法 |
| --- | --- | --- |
| 直接 import 组件 `.vue` 本体渲染 | descriptor.css 无人注入，裸样式，不报错 | import descriptor + `<SharedMount>` |
| 用 `label` 包裹共享组件 | 内部隐藏 input 被额外激活一次，弹两次文件选择器 | 外层用 `div` |
| zone 形态消费方自画虚线框 | 框套框 / 边框粗细不一（改造前 shortcut 2px、github-show 1px、color-studio 无） | 框是共享层唯一事实源，消费方只管 margin |
| bare 形态把 `buttonClass` 样式写进 scoped 块 | `[data-v-*]` 加不到共享组件内部的 button，静默无效 | 写在同一 SFC 的第二个非 scoped `<style>` 块 |
| 给宿主通配 button reset 加 `:not([class*="sl-file-drop"])` 兜底 | 特异性 (0,1,1)→(0,2,1)，反压 `.sl-csa .csa-btn` (0,2,0)，整个后台按钮被擦掉 | 该场景改用 zone/tile 形态（框内无 button，天然躲开 reset） |
| 网格格子里用 zone | zone 是撑满容器的整块，`repeat(N,1fr)` 网格被撑坏 | 网格用 tile |

## 改动检查清单

- [ ] 新增/修改了 `.vue` → `scoped-id.test.ts` 锁值已更新
- [ ] 样式只走 style.css（非 scoped、`--sl-*` token），descriptor 上有 `?inline` 导入
- [ ] props 契约无框架耦合对象；回调齐全（onSelect / onReject）
- [ ] 消费点用了正确 variant（弹窗 zone / 网格 tile / 有自己按钮体系 bare），没有自画 dashed 框
- [ ] 宿主有通配 button reset → 已确认放过 `sl-file-drop` 且未抬特异性
- [ ] 相关测试通过：`shared-consumer-*`、`drop-zone-callers`、`user-space-kv-ui`
