<!--
  ref3: fix-lint-loop —— 由原 .claude/skills/fix-eslint-errors 合并而来。
  原 skill 有 SKILL.md + workflow.md 两个文件,合并到此处一个文件。
  触发条件、AI 循环、提交规范都保留,只调整了名字与目录位置。
-->

# ref3: fix-lint-loop

驱动仓库的 ESLint tooling layer,把工作区带到"0 errors / 0 warnings"状态,并产出 atomic commits。

## 何时触发(三种情况)

1. 用户明确要求"修 lint"、"清理 lint"、"让 lint 通过"。
2. AI 准备 commit,但 `pnpm lint:summary` 的表格显示还有错误或警告。
3. `.claude/hooks/pre-commit-lint.mjs` 拦下了 `git commit`,理由是 lint 不干净。

## AI 工作循环(7 步)

```text
1. pnpm lint:fix         # eslint --fix,先把所有可自动修复的规则处理掉
2. pnpm lint             # 重新生成 eslint-report.json
3. pnpm lint:summary     # 把"按规则聚合"的表格打印到 stdout
4. 如果 errors == 0 且 warnings == 0:停止。
5. 否则,选当前错误数最多的那条规则:
   a. 读这条规则在所有文件里报出的 file:line
   b. 判断:eslint --fix 能不能修,还是需要语义改动
   c. 用 Edit 工具改源码
   d. 重新跑 pnpm lint:fix;pnpm lint
   e. git add -A;git commit -m "style(eslint): 修复 <rule-name>"
6. 回到 step 3 继续。
```

## Commit message 模板

```
style(eslint): 修复 <rule-name>
```

`rule-name` 用 ESLint 报告里的原始 ID,例如 `no-unused-vars`、`vue/no-multiple-template-root`。

## 输出给用户

每完成一轮迭代,打印:

```
✅ rule <rule-name>: 0 remaining (was N)
```

全部清完时打印:

```
✅ lint clean — 0 errors, 0 warnings — ready for commit.
```

## 硬性规则

- **永远不要**用 `// eslint-disable-next-line` 来静默某条规则——除非该规则的报错是已知误报,并且注释里写明原因。
- **永远不要**把多个规则组的修复合并到同一条 commit。
- **永远不要**跳过两条 commit 之间的 `pnpm lint` 复检。
- 如果一条规则既不能自动修、又找不到合理的语义改动方案,**停下来问用户**,不要硬上。

## 仓库配套脚本(已配置好)

```jsonc
{
  "scripts": {
    "lint": "eslint . --max-warnings=0 --format=json --output-file=eslint-report.json",
    "lint:fix": "node scripts/lint-fix.mjs",
    "lint:summary": "node scripts/lint-summary.mjs < eslint-report.json",
    "lint:loop": "node scripts/lint-loop.mjs"
  }
}
```

- `pnpm lint` —— 跑 ESLint + 写 JSON 报告
- `pnpm lint:fix` —— 自动修复能修的
- `pnpm lint:summary` —— 读 JSON,按规则聚合打印
- `pnpm lint:loop` —— 一键 fix → lint → summary 循环

## 与 PreToolUse hook 的关系

`.claude/hooks/pre-commit-lint.mjs` 在每次 `git commit` 前自动跑 `pnpm lint`,失败则阻断。这是**被动防御**。本 ref 是**主动清理**——你想现在就把 lint 修干净时调用。

两者配合:日常 commit 由 hook 兜底;累积大批 lint 错误时启动本 ref 一次性清理。