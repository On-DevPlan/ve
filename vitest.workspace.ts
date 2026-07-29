// vitest.workspace.ts —— 仓库根 vitest 配置。
// 作用:
//   1) 把每个 package 的 vitest 配置统一注册,避免子包 vitest.config.ts 被忽略。
//   2) 默认 environment 为 node;需要 DOM/Shadow DOM 的子包用显式 environment: 'jsdom' 指定。
//   3) 兼容 pnpm workspace 软链与 vite/vitest 解析。
//
// 注意:子包内仍然保留 vitest.config.ts 供单独运行使用,但顶层 vitest run 会使用本文件。
// showcase 应用在 F10B 阶段加入:仅 registry / search 等纯逻辑测试,环境为 jsdom(Vue ref 依赖)。

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'showcase',
      root: './apps/showcase',
      environment: 'jsdom',
      include: ['__tests__/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'component-contract',
      root: './packages/component-contract',
      include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'manifest-generator',
      root: './packages/manifest-generator',
      include: ['__tests__/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'mount-adapters',
      root: './packages/mount-adapters',
      environment: 'jsdom',
      include: ['__tests__/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'vue-components',
      root: './packages/vue-components',
      include: ['__tests__/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'react-components',
      root: './packages/react-components',
      // jsdom: shortcut-library has DOM-rendering tests; other tests in this
      // package don't depend on the browser, but jsdom is a superset of node
      // APIs so the cost is negligible.
      environment: 'jsdom',
      include: ['__tests__/**/*.test.{ts,tsx}'],
    },
  },
  {
    test: {
      name: 'eslint-config',
      root: './eslint',
      include: ['__tests__/**/*.test.{js,mjs,ts}'],
    },
  },
  {
    test: {
      name: 'scripts',
      root: './scripts',
      include: ['__tests__/**/*.test.{js,mjs}'],
    },
  },
  {
    test: {
      name: 'claude-skills',
      root: './.claude/skills/fix-eslint-errors',
      include: ['__tests__/**/*.test.{js,mjs}'],
    },
  },
  {
    test: {
      name: 'claude-hooks',
      root: './.claude/hooks',
      include: ['__tests__/**/*.test.{js,mjs}'],
    },
  },
  {
    test: {
      name: 'web-work-flow',
      root: './.claude/skills/web-work-flow',
      include: ['__tests__/**/*.test.{js,mjs}'],
    },
  },
]);
