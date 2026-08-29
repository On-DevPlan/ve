#!/usr/bin/env node
// 原子脚本:把 lint 摘要作为 PR 评论发出去。
//
// 由 .github/workflows/lint.yml 在 pnpm lint 之后调用(无论 ESLint
// 成功或失败)。输入从 eslint-report.json 读,输出走 GitHub Issues API。
//
// 设计取舍:
//   - 不阻断 workflow:CI 自带的 check ✅/❌ 已经够明示,
//     这个脚本只是"锦上添花"。脚本本身挂掉不能让已通过的
//     lint 在 PR 上看起来失败。
//   - 不做 sticky:每次 lint run 都发一条新评论,
//     保留每次 push 的独立审计轨迹。如果将来嫌刷屏,
//     改成"找到上一条 bot 评论 + updateComment"即可。

import process from 'node:process'; // 进程对象
import { readFileSync } from 'node:fs'; // 同步读文件
import path from 'node:path'; // 把绝对路径压成相对路径

// 从环境变量拿 token / 仓库 / PR 号。CI 通过 env 注入。
// 本地跑会缺失 → 走 dry-run 模式,把渲染好的 body 打到 stdout。
const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = process.env;

// GitHub API 版本固定一个常量 —— 显式胜于隐式。
const API_VERSION = '2022-11-28';

// 1) 读 ESLint JSON 报告 ---------------------------------------------

let reports = [];
try {
  reports = JSON.parse(readFileSync('eslint-report.json', 'utf8'));
} catch (err) {
  // eslint-report.json 不存在 / JSON 损坏 = ESLint 提前崩了。
  // 这种情况下我们仍然尝试发一条"无可用摘要"的评论,
  // 但绝对不能阻断 workflow。
  console.error('[lint-summary-comment] cannot read eslint-report.json:', err.message);
  await postComment(
    '## ⚠️ ESLint summary unavailable\n\n' +
    '`eslint-report.json` was not produced. ' +
    'Check the GitHub Actions log for the `Run ESLint` step output.'
  );
  process.exit(0);
}

// 2) 聚合 -----------------------------------------------------------

// byRule: Map<ruleId, { errors, warnings }>
const byRule = new Map();
let errors = 0;
let warnings = 0;
// topErrors: 头 5 条 severity=2 的具体错误,放进评论的折叠区。
const topErrors = [];

for (const report of reports) {
  for (const msg of report.messages) {
    if (msg.severity === 2) errors += 1;
    else if (msg.severity === 1) warnings += 1;
    // 按规则聚合(解析失败的 message 没有 ruleId,跳过)。
    if (msg.ruleId) {
      const entry = byRule.get(msg.ruleId) ?? { errors: 0, warnings: 0 };
      if (msg.severity === 2) entry.errors += 1;
      else if (msg.severity === 1) entry.warnings += 1;
      byRule.set(msg.ruleId, entry);
    }
    // 收 top 5 errors,用于评论里快速定位 —— 不收 warnings,
    // 因为 warnings 一般不是阻塞项,只让错误显眼。
    if (msg.severity === 2 && topErrors.length < 5) {
      topErrors.push({
        file: path.relative(process.cwd(), report.filePath),
        line: msg.line,
        column: msg.column,
        rule: msg.ruleId ?? '(parse error)',
        message: msg.message,
      });
    }
  }
}

// 3) 渲染 markdown --------------------------------------------------

// 状态 emoji:
//   ✅ — 全清(0 errors / 0 warnings)
//   ❌ — 有 errors
//   ⚠️ — 只有 warnings
let emoji;
let label;
if (errors === 0 && warnings === 0) {
  emoji = '✅';
  label = 'passed';
} else if (errors > 0) {
  emoji = '❌';
  label = 'failed';
} else {
  emoji = '⚠️';
  label = 'passed with warnings';
}

let body = `## ${emoji} ESLint ${label}\n\n`;
body += `Files: **${reports.length}** · Errors: **${errors}** · Warnings: **${warnings}**\n\n`;

if (byRule.size > 0) {
  body += '| Rule | Errors | Warnings |\n';
  body += '|------|-------:|----------:|\n';
  // 按 ruleId 字典序,稳定的输出顺序方便跨 run diff。
  const sorted = [...byRule.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [rule, e] of sorted) {
    body += `| \`${rule}\` | ${e.errors} | ${e.warnings} |\n`;
  }
} else if (errors === 0 && warnings === 0) {
  body += '_No issues._\n';
}

// top errors 折叠区 —— 错误少的时候能直接看到修复位置,
// 错误多的时候折叠不刷屏。
if (topErrors.length > 0) {
  body += '\n<details><summary>Top errors</summary>\n\n';
  for (const e of topErrors) {
    body += `- \`${e.file}:${e.line}:${e.column}\` — **${e.rule}**: ${e.message}\n`;
  }
  body += '\n</details>\n';
}

// 4) 发评论 ---------------------------------------------------------

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
  // 本地 dry-run 模式:环境变量不全,只把渲染好的 body 打印到 stdout。
  console.error('[lint-summary-comment] missing env; running in dry-run mode');
  console.log('---comment body---');
  console.log(body);
  process.exit(0);
}

await postComment(body);
process.exit(0);

// 通过 GitHub Issues API 发评论。PR 评论就是 issue 评论。
// 用 fetch 而不是 @actions/github —— 减少 action 依赖,
// 这个脚本同样可以在本地拿 token 跑。
async function postComment(text) {
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': API_VERSION,
    },
    body: JSON.stringify({ body: text }),
  });
  if (!res.ok) {
    // 不抛异常 —— 评论失败不应影响 CI 状态。
    console.error(`[lint-summary-comment] GitHub API ${res.status}:`, await res.text());
    return;
  }
  console.log('[lint-summary-comment] comment posted');
}
