// 单元测试:自定义规则 valid-component-config。
// 用 ESLint RuleTester 喂 AST 样例,验证 component.config.ts 格式约束。
//
// 关注点:
//   1. id 必须等于目录名
//   2. framework 必须与包目录一致 (vue-components → vue)
//   3. route.path 必须以 /components/<id> 开头
//   4. 非 component.config.ts 文件不触发

import { describe, it, expect } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import rule from '../rules/valid-component-config.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parser: tsParser,
  },
});

describe('valid-component-config', () => {
  it('passes a well-formed vue config', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [
        {
          filename: 'packages/vue-components/src/button/component.config.ts',
          code: `export default {
            id: 'button',
            framework: 'vue',
            route: { path: '/components/button' },
          } satisfies ComponentConfig;`,
        },
        {
          filename: 'packages/react-components/src/data-table/component.config.ts',
          code: `export default {
            id: 'data-table',
            framework: 'react',
            route: { path: '/components/data-table' },
          } satisfies ComponentConfig;`,
        },
      ],
      invalid: [],
    });
    expect(true).toBe(true);
  });

  it('flags id that does not match directory name', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [],
      invalid: [
        {
          filename: 'packages/vue-components/src/map/component.config.ts',
          code: `export default {
            id: 'china-map',
            framework: 'vue',
            route: { path: '/components/china-map' },
          } satisfies ComponentConfig;`,
          errors: [{ messageId: 'idMismatch' }],
        },
      ],
    });
    expect(true).toBe(true);
  });

  it('flags framework mismatch with package directory', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [],
      invalid: [
        {
          filename: 'packages/vue-components/src/button/component.config.ts',
          code: `export default {
            id: 'button',
            framework: 'react',
            route: { path: '/components/button' },
          };`,
          errors: [{ messageId: 'frameworkMismatch' }],
        },
      ],
    });
    expect(true).toBe(true);
  });

  it('flags route.path that does not match /components/<id>', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [],
      invalid: [
        {
          filename: 'packages/vue-components/src/button/component.config.ts',
          code: `export default {
            id: 'button',
            framework: 'vue',
            route: { path: '/components/wrong-name' },
          };`,
          errors: [{ messageId: 'routePathIdMismatch' }],
        },
        {
          filename: 'packages/vue-components/src/button/component.config.ts',
          code: `export default {
            id: 'button',
            framework: 'vue',
            route: { path: '/widgets/button' },
          };`,
          errors: [{ messageId: 'routePathPrefix' }],
        },
      ],
    });
    expect(true).toBe(true);
  });

  it('does not trigger on non-config files', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [
        {
          filename: 'packages/vue-components/src/button/index.vue',
          code: `export default { id: 'whatever' };`,
        },
      ],
      invalid: [],
    });
    expect(true).toBe(true);
  });

  it('flags missing default export', () => {
    ruleTester.run('valid-component-config', rule, {
      valid: [],
      invalid: [
        {
          filename: 'packages/vue-components/src/button/component.config.ts',
          code: `const cfg = { id: 'button' };`,
          errors: [{ messageId: 'noDefaultExport' }],
        },
      ],
    });
    expect(true).toBe(true);
  });
});
