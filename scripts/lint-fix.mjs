#!/usr/bin/env node
// 原子脚本:对仓库执行 eslint --fix。
// 仅做"运行 + 透传退出码",由调用方决定如何处理失败。
//
// 为什么不直接 `pnpm exec eslint . --fix` ?
//   - 统一 shell 参数,Windows 下加 shell:true 避免 spawn 异常
//   - 把退出码收敛成 0 / 非 0,供上层 lint-loop 串联判断

import { spawnSync } from 'node:child_process'; // 同步 spawn,适合脚本串接
import process from 'node:process';

// 调用 pnpm exec eslint . --fix
// stdio: 'inherit' —— 子进程的输出直接透传到当前终端
// shell: win32 下用 shell 解析命令,避免 PATH/可执行扩展名问题
const result = spawnSync('pnpm', ['exec', 'eslint', '.', '--fix'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 透传退出码:result.status 为 null 表示子进程被信号杀死,按 1 处理
process.exit(result.status ?? 1);