---
name: web-work-flow
description: Use when working on the wb project (D:\DevProjects\my\github\wb) — a Vue-host + React-compatible micro-frontend showcase. Trigger on questions about architecture / how to add or delete components / fixing lint / debugging manifest issues / dev server setup / troubleshooting a broken component / authoring a new ESLint rule. Loads the right reference doc on demand instead of dumping everything upfront.
---

# web-work-flow

`wb` 项目的入口 skill。本文档只做 **kv 映射**——按主题把工作路由到具体的 reference。

> 渐进式披露:不要一次性把所有内容读进来。先读 SKILL.md 找到 key,再按需加载对应 ref。

## 何时读哪个 reference

### 日常开发

| 你在做什么 | 读这个 ref |
|---|---|
| 想理解 wb 整体架构(为什么 Vue 当 host / 怎么跨框架 / Vite 角色 / 设计模式 / 自动发现机制 / 样式 adoption) | [[architecture-and-design-philosophy]] |
| 想新增 / 删除一个 Vue 或 React 组件到 wb | [[how-to-add-component]] |
| lint 报错 / 想自动修复 lint / 提交前清理 lint | [[fix-lint-loop]] |

### 故障排查

| 症状 | 读这个 ref |
|---|---|
| 组件不显示 / "No loader registered" / ShadowRoot 没样式 / mount 抛错 / 路由 404 / ESLint 报错——按决策树走 | [[component-decision-tree]] |
| 加/删组件后 dev server 行为不对(manifest 没更新 / 浏览器没刷新) | [[dev-server-watcher]] |

### 给项目加新机制

| 你要做什么 | 读这个 ref |
|---|---|
| 决定新约束用 ajv schema 还是 ESLint 规则 | [[when-eslint-vs-ajv]] |
| 写一条自定义 ESLint 规则(AST / filename / 字符串字面量提取的样板) | [[eslint-pattern-recipes]] |
| 写自定义规则的测试(RuleTester + ts parser) | [[eslint-testing-pattern]] |
| 给现有 `valid-component-config` 加新 messageId | [[eslint-extending-existing]] |

## ref 加载约定

| ref | 路径 | 体量 |
|---|---|---|
| [[architecture-and-design-philosophy]] | references/architecture-and-design-philosophy.md | 大 |
| [[how-to-add-component]] | references/how-to-add-component.md | 中 |
| [[fix-lint-loop]] | references/fix-lint-loop.md | 小 |
| [[component-decision-tree]] | references/component-decision-tree.md | 中 |
| [[dev-server-watcher]] | references/dev-server-watcher.md | 小 |
| [[when-eslint-vs-ajv]] | references/when-eslint-vs-ajv.md | 小 |
| [[eslint-pattern-recipes]] | references/eslint-pattern-recipes.md | 中 |
| [[eslint-testing-pattern]] | references/eslint-testing-pattern.md | 中 |
| [[eslint-extending-existing]] | references/eslint-extending-existing.md | 小 |

## 项目锚点

| 入口 | 路径 |
|---|---|
| 展示中心 Host | `apps/showcase/` |
| 组件 loader 自动发现(import.meta.glob) | `apps/showcase/src/registry/loaders.ts` |
| 组件契约(类型 + JSON Schema) | `packages/component-contract/` |
| Manifest 扫描器 + Vite 插件(含 watcher) | `packages/manifest-generator/` |
| 运行时挂载适配器(Vue/React/ShadowRoot + 共享样式 adoption) | `packages/mount-adapters/` |
| Vue 组件单元 | `packages/vue-components/src/<id>/` |
| React 组件单元 | `packages/react-components/src/<id>/` |
| 自定义 ESLint 规则 | `eslint/rules/valid-component-config.js` |
| 静态地图数据(放在 public 下) | `apps/showcase/public/map/` |

## 快速命令

```bash
# 安装
pnpm install

# 启动展示中心(5173)
pnpm --filter @style-library/showcase dev

# 构建生产产物(测试按组件分 chunk)
pnpm --filter @style-library/showcase build

# lint / fix / 摘要 / 一键循环
pnpm lint
pnpm lint:fix
pnpm lint:summary
pnpm lint:loop    # 详见 [[fix-lint-loop]]

# 测试
pnpm exec vitest run
```

## 重要约定

- **不修改 main / master**——所有变更走 feature 分支
- **Conventional Commits**: `feat(scope): ...` / `fix(scope): ...` / `chore(scope): ...`
- **每个任务一个 atomic commit**
- **加组件 = 零配置**:写 `component.config.ts` + `index.{vue,tsx}`,ESLint 校验格式,dev server 自动发现。详见 [[how-to-add-component]]
- **删组件 = 删目录**:dev server watcher 监听 add/unlink/change,自动清理 manifest。详见 [[dev-server-watcher]]
- **不在卡片列表 import 组件实现**——CardGrid 只读 metadata;实现代码靠 dynamic import 走详情页 chunk
- **自定义 ESLint 规则**先读 [[when-eslint-vs-ajv]] 决定 ESLint 还是 ajv,然后 [[eslint-pattern-recipes]] + [[eslint-testing-pattern]]