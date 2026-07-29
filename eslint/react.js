// React + Hooks 规则层。
// 仅作用于 *.{ts,tsx},即 React 组件与 hooks 实现。

import react from 'eslint-plugin-react'; // React 核心规则
import reactHooks from 'eslint-plugin-react-hooks'; // Hooks 规则(rules-of-hooks / exhaustive-deps)
import reactRefresh from 'eslint-plugin-react-refresh'; // Vite React Refresh 规则,保证 HMR 边界

export default [
  {
    // 仅作用于 TS/TSX 文件
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    // 让插件自动识别当前 React 版本
    settings: { react: { version: 'detect' } },
    rules: {
      // React 官方推荐规则集
      ...react.configs.recommended.rules,
      // Hooks 官方推荐规则集
      ...reactHooks.configs.recommended.rules,
      // 强制组件是单独导出,允许常量导出(vite 常量导出的兼容性)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 关闭 prop-types:TypeScript 已经保证类型
      'react/prop-types': 'off',
      // 关闭 React 17+ 不再需要的 import React
      'react/react-in-jsx-scope': 'off',
      // 自闭合组件必须有自闭合语法
      'react/self-closing-comp': 'error',
      // useEffect / useMemo / useCallback 依赖必须完整
      'react-hooks/exhaustive-deps': 'error',
      // 禁止违反 hooks 规则(条件调用、循环里调用等)
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];