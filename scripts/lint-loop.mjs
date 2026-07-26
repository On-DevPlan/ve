#!/usr/bin/env node
// 原子脚本:`pnpm lint:loop` 的实际实现。
//
// 流程:
//   1) 跑 lint-fix.mjs  → 自动修复可修的规则
//   2) 跑 eslint . --format=json → 重新生成 eslint-report.json
//   3) 把报告喂给 lint-summary.mjs → 打印按规则聚合的表
// 任何一步非 0 退出则立刻终止并透传退出码。
//
// 这个脚本的目标:让"AI 修 lint"和"人类自查"共用一条命令。

import { spawnSync } from 'node:child_process'; // 同步 spawn
import { readFileSync } from 'node:fs'; // 读取生成的 JSON 报告
import process from 'node:process'; // 进程对象

// 同步执行命令的封装
// stdio: ['inherit','pipe','inherit'] —— stdout 用 pipe 便于捕获,其余透传
// shell: win32 下走 shell 解析
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
    ...opts,
  });
}

// 第 1 步:跑 lint-fix.mjs
const fix = run('node', ['scripts/lint-fix.mjs'], { stdio: 'inherit' });
if (fix.status !== 0) {
  // eslint --fix 失败往往是命令本身错(配置挂了),直接退出
  console.error('[lint-loop] eslint --fix failed.');
  process.exit(fix.status ?? 1);
}

// 第 2 步:重新生成 eslint-report.json(覆盖式写入)
const lint = run('pnpm', ['exec', 'eslint', '.', '--format=json', '--output-file=eslint-report.json']);
if (lint.status !== 0) {
  // 还有未修复的错误,提示用户看 summary
  console.error('[lint-loop] lint reported remaining errors. Run `pnpm lint:summary < eslint-report.json` to inspect.');
  process.exit(lint.status ?? 1);
}

// 第 3 步:读取 JSON 报告,把它喂给 lint-summary.mjs
const report = readFileSync('eslint-report.json', 'utf8');
const summary = run('node', ['scripts/lint-summary.mjs'], {
  input: report, // 通过 stdin 把报告喂给子进程
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false, // 不走 shell,避免 JSON 内容里的引号/换行被 shell 解释
});
// 透传子进程的 stdout / stderr
if (summary.stdout) process.stdout.write(summary.stdout);
if (summary.stderr) process.stderr.write(summary.stderr);
if (summary.status !== 0) {
  console.error('[lint-loop] lint-summary failed.');
  process.exit(summary.status ?? 1);
}

// 全程 0 退出 = lint 已清
process.exit(0);