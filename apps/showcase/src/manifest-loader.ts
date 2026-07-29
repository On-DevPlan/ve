// manifest-loader.ts —— 在浏览器里加载 ComponentManifest 的工具函数。
//
// 职责:
//   1) 在 dev 模式下,从 Vite 中间件拉 /__component-manifest.json
//   2) 在 prod 构建下,从静态资源拉 /component-manifest.json
//   3) 失败抛错,让上层(App.vue / main.ts)用 try/catch 走 fallback
//
// 为什么 dev 路径多下划线前缀:
//   - 避免与"未来业务路由 /component-manifest.json"冲突
//   - Vite 中间件按精确路径匹配(spec §6.1),双下划线是约定俗成的"框架内部"前缀
//
// 为什么 cache: 'no-cache':
//   - manifest 是构建期产物,文件本身带 hash;关缓存可避免开发期陈旧
//   - 生产模式下文件名带 contenthash,缓存友好,所以这里是 dev 友好选项

import type { ComponentManifest } from '@style-library/component-contract';

// 主入口:异步加载组件清单。
// 返回已解析的 JSON(类型在编译期由 ComponentManifest 保证)。
export async function loadManifest(): Promise<ComponentManifest> {
  // dev/prod 路径分流 —— import.meta.env.DEV 由 Vite 在编译期替换为布尔字面量
  const url = import.meta.env.DEV
    ? '/__component-manifest.json' // dev:Vite manifest-plugin 中间件
    : '/component-manifest.json'; // prod:写到 dist 根的静态资源
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    // 抛出带 HTTP 状态码的错误,便于上层区分"找不到(404)"vs"服务器崩(500)"
    throw new Error(`Failed to load manifest: ${res.status}`);
  }
  // res.json() 已经走完一次 JSON 解析;契约层 ajv 校验是构建期的责任,
  // 运行期信任 manifest 已通过校验(F4 manifest vite plugin 保证)。
  return res.json();
}
