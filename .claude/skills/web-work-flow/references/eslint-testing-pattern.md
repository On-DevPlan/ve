---
ref: testing-pattern
parent: eslint-rule-authoring
---

# 自定义 ESLint 规则的测试样板

基于 `eslint/__tests__/valid-component-config.test.mjs` 提炼。

## 文件位置

```
eslint/__tests__/<your-rule>.test.mjs
```

`.mjs` 后缀必须,因为 vitest 用 ESM。

## 必备 import

```js
import { describe, it, expect } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';  // 默认 parser 不认 satisfies / TS 语法
import rule from '../rules/your-rule.js';
```

## RuleTester 初始化(支持 TS 代码)

```js
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parser: tsParser,  // ← 让 AST 含 TSSatisfiesExpression 等
  },
});
```

**不配 parser**: 默认 espree 不认 `satisfies`,测试报错 "Unexpected token satisfies"。

## 测试用例结构

```js
describe('your-rule-name', () => {
  it('passes a well-formed config', () => {
    ruleTester.run('your-rule-name', rule, {
      valid: [
        { filename: 'path/to/file.ts', code: '...' },
      ],
      invalid: [
        { filename: 'path/to/file.ts', code: '...', errors: [{ messageId: 'someId' }] },
      ],
    });
    expect(true).toBe(true);  // 冗余断言,让 vitest 报一个完整测试
  });
});
```

**关键**:`ruleTester.run` 内部对每个用例都做了断言,跑到这里就说明全部通过。`expect(true)` 是冗余的,但能让 vitest 输出完整的"6 tests passed"。

## 测试用例怎么写

### 合法用例 — 不报错

```js
valid: [
  {
    filename: 'packages/vue-components/src/button/component.config.ts',
    code: `export default {
      id: 'button',
      framework: 'vue',
    } satisfies ComponentConfig;`,
  },
],
```

### 非法用例 — 必须报指定 messageId

```js
invalid: [
  {
    filename: 'packages/vue-components/src/foo/component.config.ts',
    code: `export default { id: 'bar' };`,
    errors: [{ messageId: 'idMismatch' }],
  },
],
```

### 多个错误

```js
invalid: [
  {
    filename: '...',
    code: '...',
    errors: [
      { messageId: 'idMismatch' },
      { messageId: 'frameworkMismatch' },
    ],
  },
],
```

## 测试要覆盖的维度

- ✅ 合法用例(完整合法 code)
- ✅ 各 messageId 各一个非法用例
- ✅ **边界**:`id` 等于目录名(应该 pass)、id 不等于(应该 fail)
- ✅ 跨 framework:vue 包里写 react / react 包里写 vue
- ✅ **filename 边界**:不是 component.config.ts 时不触发(也用 valid 用例验证)
- ✅ 类型边界:`id` 是变量(非字面量)、`framework` 不是 'vue'/'react'
- ✅ AST 边界:`export default ... satisfies T` / `export default ... as T` / `export default { ... }` 三种

## 验证命令

```bash
# 单独跑你的规则测试
pnpm exec vitest run eslint/__tests__/your-rule.test.mjs

# 跑全部 vitest
pnpm exec vitest run

# 跑真实文件,看会不会误报
pnpm lint
```

## 完整样板

参考 `eslint/__tests__/valid-component-config.test.mjs`(已存在,98 行)。

## vitest workspace 配置

新测试文件会自动被 `vitest.workspace.ts` 里的 `eslint-config` 工作区捕获:
```js
{
  test: {
    name: 'eslint-config',
    root: './eslint',
    include: ['__tests__/**/*.test.{js,mjs,ts}'],
  },
},
```

不用改 workspace。