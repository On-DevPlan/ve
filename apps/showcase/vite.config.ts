// apps/showcase —— Vue 3 + Vite Host 应用的构建配置。
// 对应 spec §2 总体架构里的 "Vue 3 + Vite Host(展示中心)"。
//
// 这个文件做的事:
//   1) 装上 Vue 与 React 两个插件,让 .vue 与 .tsx/.jsx 都能被 Vite 编译
//   2) 装上 apiGateway(spec §5) —— 取代旧 mfeDynamicProxy + activeId,
//      单一事实源读 @/api/registry,dev 与 prod nginx 共用 normalize
//   3) 装上 manifest-plugin(spec §6.1),让 dev/prod 都能生成 component manifest
//   4) 配置 dev/preview 服务端口
//   5) 配 manualChunks(spec §8.1 分包):
//      - 每个 vue 组件单独 chunk(vc-<id>)
//      - 每个 react 组件单独 chunk(rc-<id>)
//      - React / Vue 运行时各自走 vendor chunk
//      作用:卡片层不会加载组件实现,详情路由只拉对应 chunk。

import { defineConfig } from 'vite'; // Vite 配置工厂
import vue from '@vitejs/plugin-vue'; // Vue 3 SFC 插件
import react from '@vitejs/plugin-react'; // React 19 插件
// 仓库内 workspace 包:
import { manifestPlugin } from '@style-library/manifest-generator';
import { genNginxOut } from './src/api/gen-nginx';
import path from 'node:path'; // 用于 resolve 绝对路径
import { fileURLToPath } from 'node:url'; // URL → 路径
import { apiGateway } from './src/api/to-vite-proxy';
import { vueStyleCollector } from './src/registry/vue-style-collector';
import { scopedIdGuard } from './plugins/scoped-id-guard';
import type { Plugin } from 'vite';
// ESM 里没有 __dirname,临时造一个指向当前文件目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 所有组件 component.config.ts 的 glob(manifestPlugin 用)
const COMPONENT_ROOTS = [
  path.resolve(__dirname, '../../packages/vue-components/src/*/component.config.ts'),
  path.resolve(__dirname, '../../packages/react-components/src/*/component.config.ts'),
];

/**
 * apiGateway 不需要 scanConfigs,直接读 @/api/registry(import 时已经 evaluate)。
 * 但 registry 自身在 import 时会做路径冲突校验,所以即便不预扫也能在网关构建阶段
 * 抛错。这里 config 是同步对象 —— `defineConfig` 接受同步函数或对象,
 * 异步函数会导致 TS2769(Vite 5 的 UserConfigFnObject 重载不支持 async)。
 */
function buildGatewayPlugin() {
  return apiGateway();
}

export default defineConfig(() => ({
  // 插件栈:Vue SFC → React JSX → api gateway → manifest → vue-style-collector
  plugins: [
    vue(),
    react(),
    buildGatewayPlugin(),
    manifestPlugin({ componentRoots: COMPONENT_ROOTS }),
    vueStyleCollector({
      vueComponentsRoot: path.resolve(__dirname, '../../packages/vue-components/src'),
    }),
    // scoped-id-guard(transform 阶段 post):扫 SFC 产物里的 __scopeId,与本地
    // computeScopedId 比对,漂移即 this.error() fail build。plugin-vue 升级时兜底。
    scopedIdGuard(),
    {
      name: 'gen-nginx-locations',
      apply: 'build',
      closeBundle() {
        const out = genNginxOut({ verbose: true });
        console.log(`[gen-nginx] wrote ${out}`);
      },
    } satisfies Plugin,
  ],
  // dev server:0.0.0.0 让局域网设备也能访问
  // 注意:server.proxy 已被 apiGateway 完全取代 —— 所有 /api/* 由 registry 集中处理,
  // 不再需要按 activeId 切换。
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  // 生产预览:与 dev 同 host,默认端口 4173
  preview: { host: '0.0.0.0', port: 4173 },
  resolve: {
    alias: {
      // '@/foo' → src/foo,贯穿 shared/ 与 api/
      '@': path.resolve(__dirname, 'src'),
      // '@api' → src/api/ 目录(收口);'@api/components/...' 等深路径直接拼到该目录
      '@api': path.resolve(__dirname, 'src/api'),
    },
  },
  build: {
    // ESNext 产物,让现代浏览器直接吃,避免 Vite 降级到 ES2015
    target: 'esnext',
    // 生成 source map 便于调试
    sourcemap: true,
    // modulePreload 过滤:
    //   Vite 默认会把 import.meta.glob 拆出的所有 chunk 都加 <link rel="modulepreload">,
    //   导致首页(npm run build 后 dist/index.html)预加载了所有 react-vendor + rc-* 组件,
    //   即使首页根本用不到。
    //   这里按 chunk 名过滤掉 React 相关 preload —— 详情页 dynamic import 时浏览器按需再拉,
    //   代价是首次点进 React 组件多 ~100ms 网络,换来首页 ~250 KB 节省 + Speed Index 改善。
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) => !dep.includes('react-vendor') && !dep.includes('/rc-'),
        ),
    },
    rollupOptions: {
      // 手动分包策略(spec §8.1)
      output: {
        // manualChunks 函数:对每个 module id 决定要不要拆出去
        manualChunks(id: string) {
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
}));