#!/usr/bin/env node
// 原子脚本:pre-commit lint 守门(独立可执行版本)。
//
// 设计目的:在 git commit 前确认 lint 干净。
// 实际生产路径:Claude Code 通过 .claude/hooks/pre-commit-lint.mjs
//   在 PreToolUse 阶段拦截 git commit 命令,无需本脚本。
// 本脚本保留下来,用于:CI、外部 wrapper、或 hook 失效时手动调用。
//
// 流程:
//   1) pnpm lint                → 必须 exit 0
//   2) pnpm exec eslint --format=json → 再次确认能产生 JSON 报告
//   3) node scripts/lint-summary.mjs → 打印规则聚合表,便于用户确认

import { spawnSync } from 'node:child_process'; // 同步 spawn
import process from 'node:process'; // 进程对象

// 同步执行命令的封装
function run(cmd, args) {
  return spawnSync(cmd, args, {
    stdio: ['inherit', 'pipe', 'inherit'], // stdin 透传,stdout 走 pipe
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
}

// 第 1 步:跑完整 lint(--max-warnings=0 由 npm script 设置)
const lint = run('pnpm', ['lint']);

if (lint.status !== 0) {
  // 失败时给用户明确指引:先 fix 再 commit
  console.error('\n[commit-lint-clean] pnpm lint failed. Run `pnpm lint:fix` then re-run lint until clean.');
  process.exit(1);
}

// 第 2 步:再跑一次只为拿 JSON(主 lint 已写 --output-file,但再跑一次更稳)
const json = run('pnpm', ['exec', 'eslint', '.', '--format=json']);
if (json.status !== 0) {
  console.error('[commit-lint-clean] ESLint JSON output failed.');
  process.exit(1);
}

// 第 3 步:打印按规则聚合的表(让用户在 commit 前再看一眼)
const summary = run('node', ['scripts/lint-summary.mjs']);
if (summary.status !== 0) {
  console.error('[commit-lint-clean] lint-summary failed.');
  process.exit(1);
}

// 全程 0 退出 = lint 干净,可以 commit
process.exit(0);