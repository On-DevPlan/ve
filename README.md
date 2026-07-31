# Vue 3 Demo Showcase

一个基于 Vue 3 + Vite 的组件演示系统，支持组件自动发现和动态路由。

## 特性

- **组件自动发现**：无需手动配置，自动扫描并注册组件
- **动态路由**：根据组件配置自动生成路由
- **全屏展示**：组件以全屏模式展示，无干扰
- **筛选搜索**：支持按分组、类别和关键词筛选
- **灰色主题**：简洁的中性灰色界面

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 添加新组件

在 `src/components/` 下创建新目录，包含两个文件：

```
src/components/YourDemo/
├── component.js    # 组件配置
└── index.vue       # 组件实现
```

### component.js 示例

```javascript
export default {
  name: 'YourDemo',
  title: '您的演示',
  description: '组件描述',
  version: '1.0.0',
  group: 'Demo',
  category: 'Example',
  tags: ['demo', 'example'],
  component: './index.vue',
  route: {
    path: '/yourdemo',
    meta: {
      title: '您的演示',
      icon: '🎨'
    }
  },
  fullscreen: true
}
```

组件会自动被发现并在首页展示。

## 技术栈

- Vue 3 (Composition API)
- Vite
- Vue Router
- Three.js

## 开发与代码质量

提交前、合并前各有一道闸门,且都为可被绕过的非强制护栏。

### Lint 三层防线

| 层 | 时机 | 工具 | 失败时 |
|---|---|---|---|
| **pre-commit hook** | `git commit` 时自动触发 | `husky` + `lint-staged` 只对 staged 的 `*.{ts,tsx,js,jsx,mjs,cjs,vue}` 跑 `eslint --max-warnings=0` | exit 1,**commit 被拒**,规则名 + 文件:行:列打印到终端 |
| **PR CI** | 任何 PR 触发,3 个 job 并行 | `pnpm exec eslint . --max-warnings=0` / `pnpm build` / `pnpm test` | 任意 job 红 → PR 不能合 |
| **`lint:summary:strict`** | 本地/CI 通用门禁 | `node scripts/lint-summary.mjs --self --strict` | errors>0 或 warnings>0 → exit 1 |

`pnpm install` 会通过 `prepare: husky` 自动设置 hooks,**clone 后无需手动配置**。

### 日常命令

```bash
pnpm lint                   # 全量 lint,严格(max-warnings=0),失败退出非零
pnpm lint:fix               # 全量 eslint --fix(Windows shell 兼容版)
pnpm lint:summary           # 只读摘要:按规则聚合打印,exit 0
pnpm lint:summary:strict    # 当门禁用:errors>0 或 warnings>0 即 exit 1
pnpm lint:loop              # fix → 重 lint → 打印 summary 的循环
pnpm test                   # vitest 全量跑
```

### 关于 `lint:summary` vs `lint:summary:strict`

`pnpm lint:summary` 设计上是**只读摘要**,无论 lint 干净或脏都 exit 0 —— 历史原因:`scripts/lint-loop.mjs` 和 `commit-lint-clean.mjs` 都按"summary 失败 = 脚本本身解析崩"来接驳,不该被"仓库 lint 脏"误伤。

如果你要把仓库 lint 状态当门禁(CI、自动化脚本),用 **`pnpm lint:summary:strict`** —— 它在 `--strict` 模式下,errors 或 warnings 任一 > 0 就 exit 1,且完整规则表照常打印到终端。

### 紧急逃生门

需要绕过 hook(比如合法 hotfix)时,只对当次提交使用:

```bash
git commit --no-verify -m "..."
```

**不应成为习惯。** 走 PR 时 CI 仍会拦下同样的问题。

## 项目结构

```
src/
├── components/           # 组件目录
│   └── ComponentName/
│       ├── component.js  # 组件配置
│       └── index.vue     # 组件实现
├── router/              # 路由配置
├── utils/               # 工具函数
│   ├── componentDiscovery.js  # 组件自动发现
│   └── dynamicImports.js      # 动态导入
├── views/               # 页面视图
│   ├── Home.vue         # 首页（组件列表）
│   └── ComponentView.vue # 组件详情页
└── App.vue              # 根组件
```

详细说明请参阅 [CLAUDE.md](./CLAUDE.md)
