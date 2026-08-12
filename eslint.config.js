// 仓库根入口 ESLint flat config。
// ESLint 9 要求 flat config,这里按"分层导入 + 顶层合并"组织:
//   1) 全局 ignores —— 屏蔽 node_modules、构建产物、测试覆盖率、showcase 静态资源
//   2) 通用 JS 推荐 + TypeScript 推荐
//   3) 仓库内部的分层规则(base / vue / react / node)
//   4) 全局 globals —— 浏览器与 Node 双环境都开放
//   5) 自定义插件 —— style-library/no-card-loader 守住 spec §6.3 的卡片边界

import js from '@eslint/js'; // @eslint/js 提供 js.configs.recommended(通用 ES 规则)
import tseslint from 'typescript-eslint'; // TypeScript 集成,提供 parser 与推荐规则集
import globals from 'globals'; // 提供标准 globals(browser / node 等)

import base from './eslint/base.js'; // 通用 TS + Node 风格规则
import vue from './eslint/vue.js'; // Vue SFC 相关规则,匹配 *.vue
import react from './eslint/react.js'; // React/TSX 相关规则,匹配 *.{ts,tsx}
import node from './eslint/node.js'; // Node 风格规则,覆盖 tools/脚本/自身
import noCardLoader from './eslint/rules/no-card-loader.js'; // 仓库自定义规则,见下方
import validComponentConfig from './eslint/rules/valid-component-config.js'; // component.config.ts 格式校验

// 默认导出即 ESLint 加载的配置数组;配置项按数组顺序合并,后者可覆盖前者。
export default [
  {
    // 文件级忽略:node_modules、构建产物、生成物、覆盖率
    // 这些目录要么不需要 lint,要么是构建输出/外部产物
    ignores: [
      '**/node_modules/**', // 第三方依赖
      '**/dist/**', // 构建输出
      '**/coverage/**', // 测试覆盖率报告
      '**/.omc/**', // OMC 临时目录(工作记忆、wiki 缓存等)
      '**/.tmp/**', // 临时分析/调试脚本
      '**/.claude/worktrees/**', // agent 工作树(临时目录,不参与 lint)
      '**/.claude/repo/**', // 克隆的参考仓库(嵌套 git 仓库,已 gitignore,见 git-repo-cleanup skill)
      '**/eslint/__tests__/fixtures/**', // 自定义规则测试夹具(不保证 lint 干净)
      'apps/showcase/public/**', // showcase 静态资源目录(包含大量闭源第三方资产)
      'apps/showcase/vite.config.ts.timestamp-*.mjs', // Vite dev server 重启时生成的 timestamp 临时产物(.gitignore 也排除)
    ],
  },
  js.configs.recommended, // 通用 ES 推荐规则集
  ...tseslint.configs.recommended, // TypeScript 推荐规则集(spread 展开)
  ...base, // 仓库通用规则:eqeqeq、prefer-const、no-debugger
  ...vue, // Vue SFC 规则:composition-api、PascalCase 模板、camelCase prop
  ...react, // React/TSX 规则:hooks/rules-of-hooks、exhaustive-deps、react-refresh
  ...node, // Node 风格规则:关掉 tool/脚本目录的 no-console
  {
    // apps/showcase 是 Vue 3 host,文件名虽然是 .ts,但里面调的是 Vue composables
    // (useXxx 命名规则与 React 撞车),关掉 react-hooks 规则避免误报。
    // 同理,Vue/React 专属规则对纯 Vue host 也不适用。
    files: ['apps/showcase/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    // 全局语言选项:浏览器 + Node globals 同时可用
    // 因为仓库同时存在 Vue 浏览器代码、Node 脚本、构建工具
    languageOptions: {
      globals: {
        ...globals.browser, // window、document 等
        ...globals.node, // process、Buffer、require 等
      },
    },
  },
  {
    // 注册仓库自定义插件 style-library
    plugins: {
      'style-library': {
        rules: {
          'no-card-loader': noCardLoader,
          'valid-component-config': validComponentConfig,
        },
      },
    },
    // 启用自定义规则,默认 error 级别
    rules: {
      'style-library/no-card-loader': 'error',
      'style-library/valid-component-config': 'error',
    },
  },
];