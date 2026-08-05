// api/to-vite-proxy.ts —— vite dev server 的统一 API 网关中间件(SPEC §5)。
//
// 取代旧的 mfeDynamicProxy + activeId 机制。设计要点:
//   - 启动时把 registry 展平成 Map<context, {target, changeOrigin}>
//   - 运行时按最长前缀匹配,判定语义**来自 normalize.matchesContext**
//     (与 prod nginx `location ^~ <context>` 保持一致)
//   - 路径只注册一次,重复 throw fail-fast
//   - 一个常驻中间件即可,不再需要"activate/deactivate"
//
// 关键约束:
//   - 不在模块顶层碰 window/localStorage,纯 Node 模块(SPEC 决策 ⑤ 同构)
//   - 尾斜杠 / query string 的处理**不在本文件**:normalize.ts 是唯一决策点。
//     曾经这里写死 `url === k || url.startsWith(k + '/')`,与 gen-nginx 的
//     `location ^~ ${ctx}/` 分叉,导致 POST /api/v1/kv 在 prod 落到 index.html。
//
// 用底层 http-proxy:一个常驻 httpProxy.Server 实例,转发时复用,
// 不像 http-proxy-middleware 每个请求都新建中间件闭包。

import httpProxy from 'http-proxy';
import { getRegistry } from './registry';
import { matchesContext, normalizeApi } from './normalize';
import type { Plugin } from 'vite';

interface ProxyEntry {
  target: string;
  changeOrigin: boolean;
}

export function apiGateway(): Plugin {
  const registry = getRegistry();
  const table = new Map<string, ProxyEntry>();
  for (const [id, backend] of Object.entries(registry)) {
    const rule = normalizeApi(backend, /* isProd */ false, id);
    if (table.has(rule.context)) {
      throw new Error(
        `[api/to-vite-proxy] duplicate registration: "${rule.context}" (already claimed)`,
      );
    }
    table.set(rule.context, { target: rule.target, changeOrigin: rule.changeOrigin });
  }
  // 长前缀优先 —— '/api/v1/kv/tags' 应赢过 '/api/v1/kv'(若两者都注册)
  const contexts = [...table.keys()].sort((a, b) => b.length - a.length);

  // 一个常驻 proxy 实例,所有 path 都用它转发
  const proxy = httpProxy.createProxyServer({
    xfwd: true,
    changeOrigin: false, // 各 entry 自带 changeOrigin
  });

  // 错误兜底:dev 端吃掉,不写 head,避免 chunked encoding 错位
  proxy.on('error', (err: Error, _req: unknown, res: unknown) => {
    const ws = (res as { socket?: { destroyed?: boolean } } | undefined)?.socket;
    if (ws?.destroyed) return;
    try {
      const r = res as { statusCode: number; end: (s?: string) => void };
      r.statusCode = 502;
      r.end('api-gateway: ' + err.message);
    } catch {
      /* ignore */
    }
  });

  return {
    name: 'api-gateway',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req as { url?: string }).url;
        if (!url) return next();
        // 命中判定与 prod nginx 共用同一语义(含剥 query / hash)
        const hit = contexts.find((ctx) => matchesContext(url, ctx));
        if (!hit) return next();

        const entry = table.get(hit)!;
        proxy.web(req as never, res as never, {
          target: entry.target,
          changeOrigin: entry.changeOrigin,
        });
      });
    },
  };
}