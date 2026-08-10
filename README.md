# @style-library/ve

基于 **Vue 3 + Vite** 的 Vue-host + **React-compatible 微前端**组件演示系统。
组件由 `component.config.ts` 描述,build 时由 Vite 插件扫盘生成 manifest,
showcase 应用自动发现、注册、产出路由 —— 加组件 = 写两个文件。

## 仓库结构(pnpm workspace monorepo)

```
.
├── apps/
│   └── showcase/              # 唯一宿主 app:Vue 3 + Vite,同时承载 React 组件
│                              #   (React 走 packages/mount-adapters 桥接进 ShadowRoot)
├── packages/
│   ├── vue-components/        # 全部 Vue 组件 demo,每个 demo 一个目录
│   ├── react-components/      # 全部 React 组件 demo,每个 demo 一个目录
│   ├── manifest-generator/    # Vite 插件:扫 component.config.ts → ComponentManifest
│   ├── mount-adapters/        # Vue/React mount 适配 + ShadowRoot 隔离
│   └── component-contract/    # TypeScript 类型 + JSON schema("组件协议")
├── eslint/                    # ESLint 9 flat config 分层:base / vue / react / node / rules
├── scripts/                   # 原子脚本:lint-fix / lint-summary / lint-loop / commit-lint-clean
├── docs/                      # architecture / mobile-designs / superpowers / workflow-canvas
├── .github/workflows/         # lint.yml(PR 触发,3 个并行 job:lint / build / test)
└── .husky/                    # git hook(pre-commit → lint-staged → eslint)
```

## 架构骨架

```
                ┌──────────────────────────────────────────┐
                │ apps/showcase (Vue 3 + Vite, host SPA)   │
                │                                          │
   build 期:    │  vite build                              │
                │   └─ plugin: @style-library/             │
                │         manifest-generator               │
                │   └─ 扫 packages/**/component.config.ts  │
                │   └─ 产出 ComponentManifest(注入 window) │
                │                                          │
   runtime:     │  components/registry      (refs + 列表)  │
                │  router/RouterRegistrar   (自动注册路由) │
                │  SearchIndex              (search 模块)  │
                │                                          │
                │  组件挂载:                                │
                │   ├─ Vue  组件 → VueMountAdapter         │
                │   └─ React 组件 → ReactMountAdapter       │
                │             → ShadowRootHost(隔离样式)   │
                └──────────────────────────────────────────┘
                        ▲                          ▲
                        │ 协议(component-contract)│
                        │ ComponentConfig 类型 +  │
                        │ manifest / route /     │
                        │ mount / isolation /    │
                        │ theme 字段             │
                        │                          │
   ┌────────────────────┴──────┐         ┌─────────┴────────┐
   │  packages/vue-components/  │         │ packages/react-  │
   │  各 demo 目录:              │         │  components/     │
   │   component.config.ts      │         │  各 demo 目录:    │
   │   index.vue                │         │   component.config.ts │
   │                            │         │   index.tsx              │
   └────────────────────────────┘         └─────────────────────┘
```

## 快速开始

> 需要 **Node ≥ 22** + **pnpm ≥ 9**(锁文件 `packageManager` 字段已钉)。

```bash
pnpm install            # 同时会触发 "prepare" 脚本装 husky 的 hooks
pnpm dev                # 启动 showcase(app 在 5173,Vite 默认)
pnpm build              # 产出 apps/showcase/dist
pnpm preview            # 预览生产构建
```

`pnpm install` 后,**pre-commit hook 已就绪** —— 之后每次 `git commit` 都会自动 lint,
详见 [开发与代码质量](#开发与代码质量)。

## 添加一个新组件 demo

> 适用:在 showcase 里加一个新卡片 + 路由。组件库已在 `packages/` 内提供,详见
> `apps/showcase/src/registry/` 与 `packages/manifest-generator/`。

挑一个目标框架的包,在 `packages/vue-components/src/<demo-id>/`
或 `packages/react-components/src/<demo-id>/` 下放两个文件即可:

```
packages/<vue|react>-components/src/<demo-id>/
├── component.config.ts        # 组件协议(必填,Vite 插件扫的是这个)
└── index.vue  或  index.tsx   # 你的实现
```

`component.config.ts` 形态参考 `packages/vue-components/src/mobile-nav-v5/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'demo-id',                       // 唯一 id,也是路由 path
  name: 'DemoComponent',               // 组件名(PascalCase)
  title: '演示标题',                    // 卡片与详情页标题
  description: '一句话描述',
  version: '1.0.0',
  framework: 'vue',                    // 或 'react'
  entry: './index.vue',                // 相对 component.config.ts
  group: '分类',                        // 卡片左侧分组
  category: '类型',                     // 卡片右侧类别
  tags: ['demo'],
  platform: 'both',                    // 'desktop' | 'mobile' | 'both'
  status: 'stable',                    // 'stable' | 'experimental' | 'wip'
  route: {
    path: '/components/demo-id',
    title: '演示标题',
  },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: false, fullscreenMode: 'container' },
} satisfies ComponentConfig;
```

字段的全部契约见 [`packages/component-contract/src/types.ts`](packages/component-contract/src/types.ts)
(spec §4 ComponentConfig / §5 Manifest)。

加完两个文件、跑 `pnpm dev`,showcase 会**自动发现**该组件,
首页出现新卡片、`/components/<demo-id>` 出现新详情页 —— 无需改 showcase 源码。

## 协议与构建产物

- **`@style-library/component-contract`** —— 组件配置的类型与 JSON schema 单一来源。
  调整字段 = 同时改这一处 + 必跑 `pnpm test`(generator / adapter / validator 都依赖)。
- **`@style-library/manifest-generator`** —— Vite 插件,扫 `component.config.ts` 输出 `ComponentManifest`。
- **`@style-library/mount-adapters`** —— `VueMountAdapter` / `ReactMountAdapter`、
  `ShadowRootHost`(隔离样式)、`AdapterFactory`(按 manifest.mount.kind 派发)。

## 技术栈

- **宿主**:Vue 3(Composition API)+ Vite 5
- **辅助栈**:Vue Router(自动生成)+ Lucide icons(@lucide/vue)
- **微前端能力**:React 19 组件可 mount 入 Vue host(`packages/mount-adapters`)
- **隔离**:ShadowRoot(`packages/mount-adapters` 的 `ShadowRootHost`)
- **协议**:TypeScript + JSON Schema,见 `packages/component-contract`
- **构建产物**:静态 SPA(容器化见 `Dockerfile`)

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

## HTTPS 部署(abc.jokelx.xyz)

本项目生产环境跑 `nginx:alpine`,通过 GitHub Actions 构建镜像并 SSH 推到服务器,容器直接对外服务。
443 端口启用 TLS,证书由 GitHub Secrets 投递,**私钥不会进仓库**。

### 一次性准备

1. **A 服务器**(你已经配好)用 `acme.sh` 签发 `abc.jokelx.xyz` 的证书,
   把 `fullchain.cer` + `privkey.key` **单行 base64** 编码:
   ```bash
   cd /root/.acme.sh/abc.jokelx.xyz/   # 或 acme.sh 实际证书目录
   base64 -w0 fullchain.cer > /tmp/fullchain.b64
   base64 -w0 privkey.key   > /tmp/privkey.b64
   cat /tmp/fullchain.b64   # 复制整串
   cat /tmp/privkey.b64     # 复制整串
   ```
   ⚠️ 务必用 `-w0`(单行输出)。多行 base64 在 GitHub Secrets 框里会被
   插入 CR,导致容器里 `base64 -d` 失败,启动直接 exit 1。

2. **GitHub 仓库 Settings → Secrets and variables → Actions**,添加两个 secret:
   - `FULLCHAIN_B64` = `<fullchain.b64 内容>`
   - `PRIVKEY_B64`   = `<privkey.b64 内容>`

3. **服务器安全组放通 TCP 443**(阿里云控制台手动配;CI 流水线改不了这一步)。

### 部署流程

推送到 `main` 或 `deploy` 分支(或手动 `workflow_dispatch`)会自动:

1. `docker build` —— `nginx/default.conf` 包含 80 + 443 两个 server 块,
   80 全部 301 跳 443。**构建期不需要真实证书**,占位路径只在 runtime 校验。
2. SCP `app.tar.gz` 到 `~/app/`,`docker load`,删旧容器。
3. `docker run` 时把 `FULLCHAIN_B64` / `PRIVKEY_B64` 作为环境变量传给容器。
4. 容器内的 [`docker-entrypoint.sh`](docker-entrypoint.sh) 会:
   - 解码 base64 → 写 `/etc/nginx/certs/fullchain.cer` + `privkey.key`
   - `chmod 600` 私钥
   - 自检三件事:**证书解析合法 / 公私钥配对 / SAN 包含 `abc.jokelx.xyz`**
   - 任一自检失败 → exit 1,容器**不会**带错误证书启动
5. exec 到官方 nginx entrypoint,正常起 nginx。

健康检查:HTTPS → HTTP 回退。证书缺失时容器仍能起(只跑 80),等 secrets 补齐后重跑 workflow 即可。

### 续期

⚠️ **这套流程的续期不是自动的。** A 上的 acme.sh 会自动续期,但**新证书不会自己跑到 B**。
B 静默过期直到下一次部署。

1. **建议**:在日历里设个 2026-10-25 的提醒,标题「更新 ve 的 TLS Secrets」。
2. **续期当天**:
   ```bash
   # A 上
   base64 -w0 fullchain.cer > /tmp/fullchain.b64
   base64 -w0 privkey.key   > /tmp/privkey.b64
   ```
   把新串粘进 GitHub Secrets,跑一次 `workflow_dispatch` 即可。
3. **监控**(在 A 上加 crontab):
   ```bash
   0 9 * * * openssl s_client -connect abc.jokelx.xyz:443 \
     -servername abc.jokelx.xyz </dev/null 2>/dev/null \
     | openssl x509 -noout -checkend 1814400 \
     || echo "⚠️ abc.jokelx.xyz 证书即将过期,请更新 GH Secrets 并重跑 workflow"
   ```

### 安全提示

- 你贴进 Secrets 的 `*.jokelx.xyz` 通配符私钥**对所有子域有效**。
  GitHub Secrets + GH Actions runner + B 服务器任意一处泄露,等于全部子域失守。
  风险等级远高于单域名证书,务必不要把 secret 输出到日志里。
  本 workflow 的 `Diagnose secrets` 步骤**只打印长度**。
- 如果以后只需要 `abc.jokelx.xyz` 一个域,建议在 B 上装 acme.sh 单独签一张,
  把通配符 key 收回 A。详见 `https` skill 的 `references/cert-issuance`。

### 故障排查

| 现象 | 排查 |
|---|---|
| 容器反复重启 | `docker logs ve_app` 看 entrypoint 报错,通常是 base64 解码失败或公私钥不配对 |
| `https://abc.jokelx.xyz` 浏览器报证书错 | B 服务器看到的公钥和你预期不符?在 A 上重新导出覆盖一次 |
| `curl -k https://localhost:443/health` 通,但公网 443 不通 | 服务器安全组未放通 TCP 443 |
| workflow 显示 `TLS secrets present` 但浏览器还是 HTTP | DNS 没指过来 / 阿里云安全组 / 阿里云备案拦截 |

## 参考

- [`packages/component-contract/src/types.ts`](packages/component-contract/src/types.ts) —— 组件协议类型源
- [`docs/architecture/framework-architecture-review.md`](docs/architecture/framework-architecture-review.md) —— 整体架构评审
- [`docs/architecture/manifest-loader-reconciliation.md`](docs/architecture/manifest-loader-reconciliation.md) —— manifest 与 loader 的对齐
- [`docker-entrypoint.sh`](docker-entrypoint.sh) —— 容器内 TLS 证书解码 + 自检入口
- [`nginx/default.conf`](nginx/default.conf) —— 80 跳 443 + HTTPS server 块
