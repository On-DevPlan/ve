// 单元测试:lint-summary.mjs。
// 核心断言:把一段固定的 ESLint JSON 喂进去,
// stdout 里能按规则聚合,并打印"文件数 / 错误数 / 警告数"。
//
// 与实现解耦:即便 lint-summary.mjs 改输出格式,
// 这个测试也只会因为明确的断言失败而 fail,不会因为环境问题误报。

import { test } from 'vitest'; // 只用一个 test,沿用 vitest 顶层风格
import assert from 'node:assert/strict'; // Node 内置 strict 断言
import { spawnSync } from 'node:child_process'; // 同步 spawn 跑子进程

// 构造一段固定的 ESLint JSON 输入:
//   - 2 个 no-unused-vars 错误
//   - 1 个 eqeqeq 警告
const stubEslintJson = JSON.stringify([
  {
    filePath: '/tmp/example.js',
    messages: [
      { ruleId: 'no-unused-vars', severity: 2, line: 3, column: 7, message: 'x is defined but never used.' },
      { ruleId: 'no-unused-vars', severity: 2, line: 7, column: 5, message: 'y is defined but never used.' },
      { ruleId: 'eqeqeq', severity: 1, line: 9, column: 12, message: 'Expected === and instead saw ==.' },
    ],
  },
]);

// 跑 scripts/lint-summary.mjs,把上面的 JSON 通过 stdin 喂进去
function runSummary() {
  return spawnSync('node', ['scripts/lint-summary.mjs'], {
    input: stubEslintJson,
    encoding: 'utf8',
    // Windows 下 shell 解析命令行
    shell: process.platform === 'win32',
  });
}

test('lint-summary groups errors by rule id and prints counts', () => {
  const result = runSummary();
  // 退出码 0:解析 stdin 成功,聚合无异常
  assert.equal(result.status, 0);
  // 输出里要能看到两个规则名
  assert.match(result.stdout, /no-unused-vars/);
  assert.match(result.stdout, /eqeqeq/);
  // 总览行:errors=2、warnings=1
  assert.match(result.stdout, /errors: 2/);
  assert.match(result.stdout, /warnings: 1/);
});