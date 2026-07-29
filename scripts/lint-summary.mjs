#!/usr/bin/env node
// 原子脚本:聚合 ESLint JSON 报告,按"规则"输出表格。
// 由 `pnpm lint:summary` 调用。
//
// 两种模式:
//   默认(stdin):    从 stdin 读 ESLint --format=json 输出(兼容旧调用方)
//   --self:        内部跑 eslint + 摘要,不依赖外部预生成的报告文件
//
// 输出:
//   1) stdout:人类可读的"文件数 / 错误数 / 警告数 + 按规则聚合的表"
//   2) stdout 末尾:机器可读的 JSON(便于其他脚本二次消费)

import process from 'node:process'; // 进程对象

// 异步读取 stdin 全文
// ESLint 输出可能很大,所以用 data 事件累积,而不是 readFileSync
function readStdin() {
  return new Promise((resolve) => {
    let data = ''; // 累积缓冲区
    process.stdin.setEncoding('utf8'); // 文本模式
    process.stdin.on('data', (chunk) => { data += chunk; }); // 累积每个 chunk
    process.stdin.on('end', () => resolve(data)); // EOF 时返回
  });
}

// --self 模式:直接调 ESLint Node API,避免依赖 PATH 上的 npx
async function runEslintAndCollect() {
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: process.cwd() });
  const reports = await eslint.lintFiles(['.']);
  return JSON.stringify(reports);
}

// 把 ESLint 报告数组聚合成 { byRule, errors, warnings }
function summarize(reports) {
  // byRule: Map<ruleId, { errors, warnings }>
  const byRule = new Map();
  // 全局计数
  let errors = 0;
  let warnings = 0;
  // 遍历每个文件的报告
  for (const report of reports) {
    // 遍历该文件下的每条 message
    for (const msg of report.messages) {
      // severity: 2 = error, 1 = warning
      if (msg.severity === 2) errors += 1;
      else if (msg.severity === 1) warnings += 1;
      // ESLint 解析失败的 message 没有 ruleId,跳过按规则聚合
      if (!msg.ruleId) continue;
      // 取已有计数,首次出现则初始化为 {0,0}
      const entry = byRule.get(msg.ruleId) ?? { errors: 0, warnings: 0 };
      if (msg.severity === 2) entry.errors += 1;
      else if (msg.severity === 1) entry.warnings += 1;
      byRule.set(msg.ruleId, entry);
    }
  }
  return { byRule, errors, warnings };
}

async function main() {
  // 拿原始 JSON
  let raw;
  if (process.argv.includes('--self')) {
    raw = await runEslintAndCollect();
  } else {
    raw = await readStdin();
    // 去掉可能的 UTF-8 BOM(Windows 上某些编辑器会加)
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  }

  // 解析 JSON
  let reports = [];
  try {
    reports = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse ESLint JSON output:', err.message);
    process.exit(2); // 2:输入无法解析,与 ESLint 退出码区分
  }
  // 聚合
  const { byRule, errors, warnings } = summarize(reports);

  // 把 Map 转成排序后的数组(按 ruleId 字典序)
  const rows = [...byRule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rule, { errors: e, warnings: w }]) => ({ rule, errors: e, warnings: w }));

  // 人类可读输出:总览 + 表格
  console.log(`lint summary — files: ${reports.length}, errors: ${errors}, warnings: ${warnings}`);
  for (const { rule, errors: e, warnings: w } of rows) {
    // 规则名左对齐 40 字符,后面是错误/警告计数
    console.log(`  ${rule.padEnd(40)}  errors=${e}  warnings=${w}`);
  }
  // 机器可读 JSON,便于下游脚本(比如 CI)继续消费
  process.stdout.write(JSON.stringify({ errors, warnings, byRule: rows }, null, 2));
}

main();