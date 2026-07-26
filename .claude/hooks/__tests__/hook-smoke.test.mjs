// 单元测试:pre-commit-lint.mjs hook。
// 通过 spawnSync 真跑子进程,验证三条路径:
//   1) 非 git commit 命令 → 一律放行(proceed),不跑 lint
//   2) git commit + lint 不干净 → 阻止(decision: block)
//   3) git commit + lint 干净 → 放行(proceed)
//
// 测试用环境变量短路掉真跑 lint 的过程:
//   - HOOK_PAYLOAD      指向 fixture 文件,模拟 Claude Code 的 stdin
//   - HOOK_LINT_STATUS  直接给出 lint 退出码,免去真跑 pnpm lint

import { describe, it, expect, afterEach } from 'vitest'; // vitest 三件套
import { spawnSync } from 'node:child_process'; // 同步 spawn
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'; // 临时目录与文件
import { tmpdir } from 'node:os'; // 系统临时目录
import { join } from 'node:path'; // 路径拼接

// 待测试的 hook 路径(相对仓库根)
const HOOK_PATH = '.claude/hooks/pre-commit-lint.mjs';

// 把 fixture JSON 复制到一个临时目录里,返回临时 payload 文件路径
function copyFixtureToTemp(fixturePath) {
  // mkdtempSync 创建唯一临时目录
  const dir = mkdtempSync(join(tmpdir(), 'hook-payload-'));
  const dest = join(dir, 'payload.json');
  // 写入原 fixture 内容
  writeFileSync(dest, readFileSync(fixturePath, 'utf8'), 'utf8');
  return { dir, payloadPath: dest };
}

describe('pre-commit-lint hook', () => {
  // 收集所有临时目录,afterEach 时统一清理
  const tempDirs = [];
  function withPayload(fixturePath) {
    const { dir, payloadPath } = copyFixtureToTemp(fixturePath);
    tempDirs.push(dir);
    return payloadPath;
  }

  afterEach(() => {
    // 清掉所有临时目录,失败也不抛(避免脏数据影响下个用例)
    for (const d of tempDirs.splice(0)) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  // 跑 hook 子进程,把 fixture 通过 HOOK_PAYLOAD 注入
  function runHook(payloadPath, extraEnv = {}) {
    return spawnSync('node', [HOOK_PATH], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOOK_PAYLOAD: payloadPath,
        ...extraEnv,
      },
      // Windows 下走 shell 解析命令字符串
      shell: process.platform === 'win32',
    });
  }

  it('blocks when command is git commit and lint would fail', () => {
    // block fixture 的命令是 "git commit -m \"feat: something\""
    const payload = withPayload('.claude/hooks/__tests__/fixtures/block.json');
    // HOOK_LINT_STATUS=1 模拟 lint 失败
    const result = runHook(payload, { HOOK_LINT_STATUS: '1' });
    // hook 自己 exit 0(它是输出 JSON 决策,不是靠退出码)
    expect(result.status).toBe(0);
    // stdout 里要包含 decision:block
    expect(result.stdout).toContain('"decision":"block"');
  });

  it('proceeds for non-commit bash commands', () => {
    // proceed fixture 是 "git status",不是 commit
    const payload = withPayload('.claude/hooks/__tests__/fixtures/proceed.json');
    const result = runHook(payload);
    expect(result.status).toBe(0);
    // stdout 里要包含 decision:proceed
    expect(result.stdout).toContain('"decision":"proceed"');
  });

  it('proceeds for git commit when lint is clean', () => {
    // 即使命令是 git commit,只要 lint 干净也要放行
    const payload = withPayload('.claude/hooks/__tests__/fixtures/block.json');
    // HOOK_LINT_STATUS=0 模拟 lint 通过
    const result = runHook(payload, { HOOK_LINT_STATUS: '0' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"decision":"proceed"');
  });
});