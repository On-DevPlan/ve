// 单元测试:scanConfigs 扫描器。
// 验证两条不变量:
//   1) 能从嵌套目录里找出所有 component.config.ts
//   2) 每条结果都带回正确的 filePath
//
// 用 fixtures 目录(button + data-table 两个 fixture)作为真实数据源,
// 不 mock fast-glob / import,确保真跑能通过。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { scanConfigs } from '../src/scanner'; // 被测函数
import { fileURLToPath } from 'node:url'; // URL → 文件系统路径

// import.meta.url 转绝对路径,作为 glob 的 cwd
const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

describe('scanConfigs', () => {
  it('finds component.config.ts under nested directories', async () => {
    // 扫描 fixtures 下所有 component.config.ts
    const configs = await scanConfigs({
      roots: [`${fixtureRoot}/**/component.config.ts`],
    });
    // fixture 里恰好放了 button + data-table 两个
    expect(configs.length).toBe(2);
    // 按 id 排序后断言顺序无关
    const ids = configs.map((c) => c.config.id).sort();
    expect(ids).toEqual(['button', 'data-table']);
  });

  it('captures the file path for each config', async () => {
    const configs = await scanConfigs({
      roots: [`${fixtureRoot}/**/component.config.ts`],
    });
    // 每条记录都必须能追溯到文件路径
    for (const c of configs) {
      expect(c.filePath.endsWith('component.config.ts')).toBe(true);
    }
  });
});