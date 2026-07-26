// 单元测试:自定义规则 no-card-loader。
// 用 ESLint 内置的 RuleTester 直接给规则喂 AST 样例,
// 不经过完整 ESLint 进程——更聚焦、更快。
//
// 测试用例围绕 spec §6.3 的"卡片层 ≠ 组件预览"边界:
//   - 详情页 Detail.vue:允许 entry.loader()(放行)
//   - 非卡片层文件 utils/registry.ts:允许 registry.load()(放行)
//   - 真实卡片层 ComponentCard.vue:禁止 entry.loader()(报错)
//   - 真实卡片层 CardGrid.vue:禁止 registry.load()(报错)
//   - 命名约定 Card.vue:禁止 entry.load()(报错)

import { describe, it, expect } from 'vitest';
import { RuleTester } from 'eslint';
import rule from '../rules/no-card-loader.js';

// 初始化 RuleTester,使用最新的 ES 语法 + module 模式
const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
});

describe('no-card-loader', () => {
  it('flags entry.loader() in card-layer files', () => {
    // 一次跑完 valid + invalid 两组用例
    ruleTester.run('no-card-loader', rule, {
      // 合法用例:不应当报错
      valid: [
        // 详情页允许加载实现
        { filename: 'apps/showcase/src/pages/Detail.vue', code: 'entry.loader();' },
        // 非卡片层文件(非 components/ 非 pages/)允许 registry.load()
        { filename: 'apps/showcase/src/utils/registry.ts', code: 'registry.load("foo");' },
        // 命名约定但不在 apps/showcase/ 下(独立包)放行
        { filename: 'packages/some-tool/src/Card.vue', code: 'entry.loader();' },
        // 命名约定但不在 apps/showcase/ 下,且碰巧路径里有 /pages/ 字符串放行
        { filename: 'packages/some-tool/src/pages/HomePage.vue', code: 'entry.loader();' },
      ],
      // 非法用例:必须报 noLoader
      invalid: [
        {
          // 真实卡片层:apps/showcase/src/components/ComponentCard.vue
          filename: 'apps/showcase/src/components/ComponentCard.vue',
          code: 'entry.loader();',
          errors: [{ messageId: 'noLoader' }],
        },
        {
          // 真实卡片层:apps/showcase/src/components/CardGrid.vue
          filename: 'apps/showcase/src/components/CardGrid.vue',
          code: 'registry.load("foo");',
          errors: [{ messageId: 'noLoader' }],
        },
        {
          // 命名约定 Card.vue
          filename: 'apps/showcase/src/Card.vue',
          code: 'entry.load();',
          errors: [{ messageId: 'noLoader' }],
        },
        {
          // HomePage 也是卡片层(/pages/ 但非 Detail)
          filename: 'apps/showcase/src/pages/HomePage.vue',
          code: 'entry.loader();',
          errors: [{ messageId: 'noLoader' }],
        },
        {
          // NotFoundPage 也是 /pages/(非 Detail)——也应受保护
          filename: 'apps/showcase/src/pages/NotFoundPage.vue',
          code: 'registry.load("foo");',
          errors: [{ messageId: 'noLoader' }],
        },
      ],
    });
    // RuleTester 内部对每个用例都做了断言;
    // 跑到这里就说明全部通过,这里再做一个冗余断言保证 vitest 报告一个完整测试
    expect(true).toBe(true);
  });
});