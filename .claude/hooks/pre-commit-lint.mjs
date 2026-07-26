#!/usr/bin/env node
// Claude Code PreToolUse hook:守 git commit。
// 当 Bash 工具调用匹配 "git commit" 时,先跑 pnpm lint;
// 若 lint 不干净,返回 decision:block,让 Claude Code 拒绝执行。
//
// 设计要点:
//   - 接受 stdin 或环境变量 HOOK_PAYLOAD 两路输入,
//     方便单元测试用 fixture 文件喂入(无需 mock spawnSync)
//   - 接受环境变量 HOOK_LINT_STATUS 作为 lint 退出码,
//     测试时不必真跑 pnpm lint
//   - 非 git commit 命令一律放行(proceed),不要让 hook 误伤其它命令
//   - 返回结构:{ decision: "proceed" | "block", reason?: string }

import { spawnSync } from 'node:child_process'; // 同步 spawn
import process from 'node:process'; // 进程对象 / 环境变量
import { readFileSync } from 'node:fs'; // 读取 payload 文件

// 读取 hook payload
// 优先用 HOOK_PAYLOAD 指向的文件(测试场景),
// 否则从 stdin(描述符 0)同步读全文
function readPayload() {
  const path = process.env.HOOK_PAYLOAD;
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  // Fallback: 直接从 stdin 同步读取(Claude Code 实际场景)
  return JSON.parse(readFileSync(0, 'utf8'));
}

// 判断 Bash 命令是否是 "git commit ..."
// 单词边界 \b 防止误匹配 "git commitlint" 之类的命令
function isCommitCommand(command) {
  return typeof command === 'string' && /\bgit\s+commit\b/.test(command);
}

// 取 lint 退出码
// HOOK_LINT_STATUS 存在 → 直接作为退出码(测试用)
// 否则真跑 pnpm lint
function lintStatus() {
  if (process.env.HOOK_LINT_STATUS) {
    return Number(process.env.HOOK_LINT_STATUS);
  }
  const result = spawnSync('pnpm', ['lint'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return result.status;
}

function main() {
  // 解析 payload
  let payload;
  try {
    payload = readPayload();
  } catch (err) {
    // payload 无法解析 → 报告 hook 错误而不是放行
    process.stderr.write(`hook error: failed to parse payload: ${err.message}\n`);
    process.exit(2);
  }
  // 取出 Bash 工具的命令字符串
  const command = payload?.tool_input?.command ?? '';
  // 非 commit 命令 → 直接放行,不跑 lint,避免 hook 太重
  if (!isCommitCommand(command)) {
    process.stdout.write(JSON.stringify({ decision: 'proceed' }));
    return;
  }
  // 是 commit 命令 → 检查 lint
  const status = lintStatus();
  if (status === 0) {
    // lint 干净 → 放行
    process.stdout.write(JSON.stringify({ decision: 'proceed' }));
    return;
  }
  // lint 不干净 → 阻止,并给出修复指引
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: 'lint is not clean. Run `pnpm lint:fix`, resolve remaining errors, then re-run `git commit`.',
  }));
}

main();