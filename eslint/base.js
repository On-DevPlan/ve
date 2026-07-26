// 通用 TypeScript 风格规则。
// 适用于所有 .ts / .tsx / .mts / .cts / .mjs / .js 文件。
// 强类型项目里常见的"运行时 bug 预防"集中在这一层。

import tseslint from 'typescript-eslint'; // TypeScript 集成包

export default [
  {
    // 文件匹配:全部源码文件,排除构建产物与覆盖率
    files: ['**/*.{ts,tsx,mts,cts,mjs,js}'],
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  {
    // 仓库硬性规则
    rules: {
      'no-debugger': 'error', // 禁止 debugger;调试请用 devtools
      // 强制使用 === / !==;null 是常见误用,允许 null 比较
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error', // 不再赋值的变量必须 const
    },
  },
  // 引入 TypeScript 推荐规则集
  ...tseslint.configs.recommended,
];