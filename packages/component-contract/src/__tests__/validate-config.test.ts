// 单元测试:validateConfig() 运行时校验函数。
// 三条用例覆盖 ajv 与 schema 的最小行为:
//   1) 合法 Vue 组件配置 → ok:true
//   2) 缺必填字段 → ok:false
//   3) framework 不在 enum 内 → ok:false

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { validateConfig } from '../validate-config'; // 被测函数

describe('validateConfig', () => {
  it('accepts a valid Vue component config', () => {
    // 一个最小但完整的 Vue ComponentConfig
    const result = validateConfig({
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: 'desc',
      version: '1.0.0',
      framework: 'vue',
      entry: './index.vue',
      group: 'g',
      category: 'c',
      tags: [],
      mount: { kind: 'vue' },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects config missing required fields', () => {
    // 只传一个 id,缺其它必填字段(name/title/version/...)
    const result = validateConfig({ id: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects config with invalid framework', () => {
    const result = validateConfig({
      id: 'a', name: 'A', title: 't', description: 'd', version: '1.0.0',
      // framework 在 schema 里被限定为 'vue' | 'react','svelte' 必须被拒
      // 用 `as any` 绕过 TS 类型,故意制造非法数据
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      framework: 'svelte' as any,
      entry: './a.tsx', group: 'g', category: 'c',
      tags: [], mount: { kind: 'vue' },
    });
    expect(result.ok).toBe(false);
  });
});