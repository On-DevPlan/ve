// 单元测试:ESLint 9 flat config 加载冒烟测试。
// 不验证具体规则内容,只确认:
//   1) `pnpm exec eslint --print-config eslint.config.js` 命令能成功执行
//   2) 输出非空(>50 字符)
// 这足以保证 flat config 文件本身在语法与插件解析层面没有错误。
//
// 用 spawnSync 是为了"真跑 ESLint 进程",而不是静态 import,
// 因为 flat config 的 plugins 加载顺序、extends 与 parser 都在 ESLint 内部处理。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { spawnSync } from 'node:child_process'; // 同步 spawn

describe('eslint flat config', () => {
  it('loads without errors', () => {
    // 调用 ESLint 的 --print-config,把解析后的最终配置 dump 到 stdout
    const result = spawnSync('pnpm', ['exec', 'eslint', '--print-config', 'eslint.config.js'], {
      encoding: 'utf8',
      // Windows 下走 shell 解析命令字符串
      shell: process.platform === 'win32',
    });
    // 退出码 0:配置无解析错误
    expect(result.status).toBe(0);
    // 输出非空:配置文件至少要被打印出来
    expect(result.stdout.length).toBeGreaterThan(50);
  });
});