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
    // react-components 现在会**间接**导入 .vue —— 共享组件层
    // (apps/showcase/src/shared/components) 的实现是 Vue SFC，由 SharedMount
    // 在 React 树里挂载。所以本工程也必须挂 plugin-vue，否则 import analysis
    // 会以 "content contains invalid JS syntax" 报错（11 个 suite 一起挂过）。
    plugins: [vuePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/showcase/src'),
        '@api': path.resolve(__dirname, 'apps/showcase/src/api'),

        // 装了 plugin-vue 之后还有第二道坎：**裸包解析**。
        // vitest 每个 project 都按自己的 root 解析裸导入，本工程 root 是
        // packages/react-components，而共享层需要的两个包都不在它的解析半径内：
        //   - `vue`：共享层 SFC 与 SharedMount.tsx 的直接依赖，仓库里只装在
        //     apps/showcase 与 packages/mount-adapters 下；
        //   - `@style-library/mount-adapters/style-adoption`：package.json 未声明。
        // 结果是 11 个 suite 以 "Failed to resolve import \"vue\"" 挂掉。
        // 这里显式指路 —— 目标选 mount-adapters：共享层的 vue / react / react-dom
        // 运行时依赖本来就由这个包声明（见其 package.json），语义最贴近，也避免
        // 依赖 pnpm 是否把包装到根 node_modules 的运气。
        vue: path.resolve(__dirname, 'packages/mount-adapters/node_modules/vue'),

        // 长 key 必须写在包名 key 前面：alias 是前缀匹配、先命中先用，而包根下
        // 并没有 style-adoption.ts（真实文件在 src/ 下，原本靠 package.json 的
        // exports 子路径映射，alias 会绕过 exports）。
        '@style-library/mount-adapters/style-adoption': path.resolve(
          __dirname,
          'packages/mount-adapters/src/style-adoption.ts',
        ),
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
