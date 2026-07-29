// apps/showcase —— Vue 3 + Vite Host 应用的构建配置。
// 对应 spec §2 总体架构里的 "Vue 3 + Vite Host(展示中心)"。
//
// 这个文件做的事:
//   1) 装上 Vue 与 React 两个插件,让 .vue 与 .tsx/.jsx 都能被 Vite 编译
//   2) 装上 manifest-plugin(spec §6.1),让 dev/prod 都能生成 component manifest
//   3) 配置 dev/preview 服务端口
//   4) 配 manualChunks(spec §8.1 分包):
//      - 每个 vue 组件单独 chunk(vc-<id>)
//      - 每个 react 组件单独 chunk(rc-<id>)
//      - React / Vue 运行时各自走 vendor chunk
//      作用:卡片层不会加载组件实现,详情路由只拉对应 chunk。

import { defineConfig } from 'vite'; // Vite 配置工厂
import vue from '@vitejs/plugin-vue'; // Vue 3 SFC 插件
import react from '@vitejs/plugin-react'; // React 19 插件
// 仓库内 workspace 包:让 dev 中间件 + prod emit 都能产出 component-manifest
import { manifestPlugin } from '@style-library/manifest-generator';
import path from 'node:path'; // 用于 resolve 绝对路径
import { fileURLToPath } from 'node:url'; // URL → 路径

// ESM 里没有 __dirname,临时造一个指向当前文件目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // 插件栈:Vue SFC → React JSX → manifest
  plugins: [
    vue(),
    react(),
    // 告诉 manifest-plugin 去哪里找 component.config.ts
    manifestPlugin({
      componentRoots: [
        // packages/vue-components/src/<id>/component.config.ts
        path.resolve(__dirname, '../../packages/vue-components/src/*/component.config.ts'),
        // packages/react-components/src/<id>/component.config.ts
        path.resolve(__dirname, '../../packages/react-components/src/*/component.config.ts'),
      ],
    }),
  ],
  // dev server:0.0.0.0 让局域网设备也能访问
  server: { host: '0.0.0.0', port: 5173 },
  // 生产预览:与 dev 同 host,默认端口 4173
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    // ESNext 产物,让现代浏览器直接吃,避免 Vite 降级到 ES2015
    target: 'esnext',
    // 生成 source map 便于调试
    sourcemap: true,
    rollupOptions: {
      // 手动分包策略(spec §8.1)
      output: {
        // manualChunks 函数:对每个 module id 决定要不要拆出去
        manualChunks(id) {
          // 1) 每个 Vue 组件独立 chunk:id 形如 .../vue-components/src/<id>/...
          if (id.includes('/vue-components/src/')) {
            const m = id.match(/\/vue-components\/src\/([^/]+)\//);
            if (m) return `vc-${m[1]}`; // 例如 vc-button、vc-heavy-chart
          }
          // 2) 每个 React 组件独立 chunk:id 形如 .../react-components/src/<id>/...
          if (id.includes('/react-components/src/')) {
            const m = id.match(/\/react-components\/src\/([^/]+)\//);
            if (m) return `rc-${m[1]}`; // 例如 rc-data-table
          }
          // 3) React 运行时单独 vendor chunk,避免重复打包
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // 4) Vue 运行时单独 vendor chunk
          if (id.includes('node_modules/vue')) {
            return 'vue-vendor';
          }
          // 5) 其它模块(Vue 应用代码、component-contract 等)走默认打包
          return undefined;
        },
      },
    },
  },
});