import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 注入构建信息：Git commit + 构建时间（来自 Docker --build-arg）
// 在 vite.config.js 中用 process.env（Vite CLI 会把 --build-arg 注入进来）
const buildInfo = JSON.stringify({
  commit: process.env.VITE_GIT_COMMIT || 'dev',
  time: process.env.VITE_BUILD_TIME || new Date().toISOString()
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/', // 确保使用正确的base路径
  define: {
    __BUILD_INFO__: buildInfo
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // 确保chunk文件名正确
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 优化构建
    target: 'esnext',
    // 使用默认压缩器，如果terser不存在
    minify: 'esbuild',
    sourcemap: false,
    // 减少chunk大小警告的阈值
    chunkSizeWarningLimit: 1000
  },
  // 服务器配置（开发模式）
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  // 预览服务器配置
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
})
