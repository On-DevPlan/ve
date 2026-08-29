<!--
  scripts/ 目录说明文档。

  这个目录存放仓库"工具链层"的原子 Node 脚本:
    - 每个脚本只做一件事
    - 零运行时依赖(只用 Node 22 stdlib)
    - 全部 ESM 写法(.mjs),与仓库顶层 package.json 的 "type": "module" 对齐
-->

# scripts/

仓库 ESLint tooling layer 的原子 Node 脚本。

- `lint-fix.mjs` — 跑 `eslint . --fix`,把所有"可自动修复"的规则一次性修掉。
- `lint-summary.mjs` — 从 stdin 读取 ESLint JSON 报告,打印"按规则聚合"的表格,并在末尾再吐一份 JSON,便于机器消费。
- `lint-summary-comment.mjs` — 读 `eslint-report.json`,渲染 markdown 摘要并通过 GitHub Issues API 推到 PR 评论。由 `.github/workflows/lint.yml` 在每次 `pnpm lint` 之后调用(成功 / 失败都发);本地直接跑会进入 dry-run 模式(只打印 body,不发请求)。
- `commit-lint-clean.mjs` — pre-commit 守门脚本的独立可执行版本:跑 `pnpm lint` 并打印 summary;失败时 exit 1。**注意:Claude Code 实际使用的是 `.claude/hooks/pre-commit-lint.mjs`**,本脚本是给 CI 或外部 wrapper 留的备用入口。

所有脚本都是纯 Node ESM(`.mjs`),除 Node 22 stdlib 外零运行时依赖。

## lint-loop.mjs

`pnpm lint:loop` 的真正实现。串起"自动修 → 重新 lint → 打印汇总",一次命令跑完:

```bash
pnpm lint:loop
```

执行步骤:

1. 调 `lint-fix.mjs`,应用所有可自动修复的规则。
2. 重新跑 `eslint . --format=json --output-file=eslint-report.json`,生成最新报告。
3. 把生成的报告通过 stdin 喂给 `lint-summary.mjs`,让规则聚合表打印出来。

退出码语义:

- `0` — lint 已清(0 errors / 0 warnings)。
- 非 `0` — 仍有错误未修,可读 `eslint-report.json` 与打印出的表继续定位。