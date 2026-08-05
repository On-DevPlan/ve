// vitest.workspace.ts —— 仓库根 vitest 配置。
// 作用:
//   1) 把每个 package 的 vitest 配置统一注册,避免子包 vitest.config.ts 被忽略。
//   2) 默认 environment 为 node;需要 DOM/Shadow DOM 的子包用显式 environment: 'jsdom' 指定。
//   3) 兼容 pnpm workspace 软链与 vite/vitest 解析。
//   4) showcase 的 `@` 路径别名与 vite.config.ts 保持一致(否则顶层 vitest run 不会
//      加载 vite.config.ts,新写的 service.ts 文件通过 `@/shared/*` 引用会解析失败)。
//
// 注意:子包内仍然保留 vitest.config.ts 供单独运行使用,但顶层 vitest run 会使用本文件。
// showcase 应用在 F10B 阶段加入:仅 registry / search 等纯逻辑测试,环境为 jsdom(Vue ref 依赖)。

import { defineWorkspace } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// showcase 的 .vue 测试需要 @vitejs/plugin-vue,但它只挂在 apps/showcase
// (pnpm 不提升到根 node_modules)。直接 import 其 ESM 入口,避免 CJS 构建
// 触发 Vite Node API 弃用告警。
const vuePluginModule = await import(
  pathToFileURL(
    path.resolve(__dirname, 'apps/showcase/node_modules/@vitejs/plugin-vue/dist/index.mjs'),
  ).href,
);
const vuePlugin = vuePluginModule.default;

export default defineWorkspace([
  {
    test: {
      name: 'showcase',
      root: './apps/showcase',
      environment: 'jsdom',
      include: ['__tests__/**/*.test.ts'],
    },
    plugins: [vuePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/showcase/src'),
        '@api': path.resolve(__dirname, 'apps/showcase/src/api'),
      },
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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/showcase/src'),
        '@api': path.resolve(__dirname, 'apps/showcase/src/api'),
      },
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
