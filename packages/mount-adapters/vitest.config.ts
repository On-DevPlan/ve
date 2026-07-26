// mount-adapters 包的 vitest 配置。
// ShadowRootHost 依赖 DOM API,需要在 jsdom 环境里跑测试;
// globals:false 表示每个用例都要显式 import { describe, it, expect }。

import { defineConfig } from 'vitest/config'; // vitest 配置工厂

export default defineConfig({
  test: {
    environment: 'jsdom', // 用 jsdom 模拟浏览器环境,提供 document/HTMLElement/ShadowRoot
    globals: false, // 不注入全局,强制显式 import
  },
});