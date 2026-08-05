// main.ts —— showcase 应用启动入口。
//
// 启动流程(spec §8.1):
//   0) jwtAuth.init          —— 尝试用 LS token 恢复 JWT 会话(不阻塞 manifest 加载)
//   1) applyThemeToDocument —— 把默认主题 token 写到 documentElement
//   2) loadManifest          —— 异步拉取 ComponentManifest(dev 中间件 / prod 静态)
//   3) createRegistry        —— 建全局注册表,把 manifest 灌入
//   4) createSearchIndex     —— 建全局搜索索引,基于 registry.entries + platform 过滤
//   5) registerComponentRoutes —— 把每个组件的详情路由注册到 vue-router
//   6) createApp             —— 建 Vue app,provide registry / search,挂 RouterView,挂载到 #app
//
// 失败兜底:
//   - bootstrap() 抛错时,直接把错误信息渲染到 body,避免白屏无反馈
//
// 设计要点:
//   - 全程 async;manifest 加载失败时,用户看到一个明确的错误页,而不是黑屏
//   - registry / search 用 provide 注入,组件层通过 useRegistry / useSearch 读取
//     (而不是挂在 window 上,见 composables/useRegistry.ts)
//   - usePlatform() 提供当前平台信号给 SearchIndex,自动过滤 non-matching 组件

import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { setRouter } from '@/shared/router-accessor';
import { loadManifest } from './manifest-loader';
import { createRegistry } from './registry/ComponentRegistry';
import { createSearchIndex } from './registry/SearchIndex';
import { registerComponentRoutes } from './registry/RouterRegistrar';
import { setLoaders, LoadersKey } from './registry/loaders';
import { RegistryKey } from './composables/useRegistry';
import { SearchKey } from './composables/useSearch';
import { usePlatform } from './composables/usePlatform';
import { defaultTokens } from './theme/tokens';
import { applyThemeToDocument } from './theme/apply-theme';
import { jwtAuth } from '@/shared/auth-store';

async function bootstrap() {
  // 0) JWT user-auth 会话恢复(userV1/kvV1 用)。
  //    fire-and-forget:UI 不等 init 结果;token 恢复后 useJwtAuth 自动 rerender
  void jwtAuth.init();

  // 0.5) 主题先行 —— 在挂载 Vue app 前就把 CSS 变量铺好,首屏就能拿到正确样式

  // 1) 主题先行 —— 在挂载 Vue app 前就把 CSS 变量铺好,首屏就能拿到正确样式
  applyThemeToDocument(defaultTokens);

  // 2) 拉 manifest
  const manifest = await loadManifest();

  // 3) 建注册表 + 灌 manifest
  const registry = createRegistry();
  registry.registerManifest(manifest);

  // 4) 建 Vue app
  const app = createApp(App);

  // 5) 建平台检测 composable(在 app 创建后调用,需 Vue 生命周期)
  const { platform } = usePlatform();

  // 6) 建搜索索引(基于 registry.entries,ref 共享),注入 platform 过滤
  const search = createSearchIndex(registry.entries, platform);

  // 7) 把每条组件详情路由注册到 vue-router
  registerComponentRoutes(router, registry.listMetadata());

  // 8) 构建 loaders(import.meta.glob 自动扫描 + manifest loaderUrl 覆写)
  //     加组件 = 写 component.config.ts + index.vue,再无其他步骤
  const loaders = setLoaders(manifest);

  // 9) provide 全局状态,挂路由,挂载
  app.config.errorHandler = (err, _instance, info) => {
    document.body.innerHTML = `<pre style="padding:24px;color:#b91c1c;background:#fee2e2;white-space:pre-wrap;">Vue error: ${String(err)}\n\nInfo: ${info}</pre>`;
  };
  app.provide(RegistryKey, registry);
  app.provide(SearchKey, search);
  app.provide(LoadersKey, loaders);
  app.use(router);
  setRouter(router);
  app.mount('#app');
}

bootstrap().catch((err) => {
  // 兜底:bootstrap 任何阶段崩了,直接在 body 里渲染错误信息
  document.body.innerHTML = `<pre style="padding:24px;color:#b91c1c;background:#fee2e2;white-space:pre-wrap;">Failed to start: ${err.message}\n\n${err.stack ?? ''}</pre>`;
});
