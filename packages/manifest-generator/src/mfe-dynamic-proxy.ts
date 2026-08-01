// mfe-dynamic-proxy.ts —— Vite 插件:按"当前激活的组件 id"动态代理 API。
//
// 解决的问题:
//   apps/showcase 的 vite.config.ts 不应硬编码任何组件特定的 proxy —— 那是组件
//   的 dev 依赖,不是 host 的职责。组件通过 component.config.ts 的 `api` 字段
//   声明规则,本插件在启动时一次性收集成静态表,运行时只有一个活跃 id,按
//   规则表做最长前缀匹配 + 转发。
//
// 工作机制(分阶段):
//   1) 启动时:扫描传入的 configs,normalize 成 ApiRule[],以 componentId 为 key
//      存进 table(Map)。此步骤完全静态,运行期 table 不变。
//   2) 浏览器 → /__mfe/activate?id=<id>:设 activeId = id。
//   3) 浏览器 → /__mfe/deactivate?id=<id>:清 activeId(且必须等于当前 id 才清,
//      避免异步竞态把别人的激活误清掉)。
//   4) 浏览器 → /<context>/...:若 activeId 非空,从 table[activeId] 里找最长
//      前缀匹配规则,rewrite 后用 http-proxy 转发到 target;否则 next() 让
//      vite 走 SPA fallback。
//
// 与 Vite proxy 的关键区别:
//   - vite.config.server.proxy 是启动时静态注册,运行期无法增删。
//   - 本插件注册**一个**常驻 dispatcher,内部用 activeId 决定是否转发。
//   - 视觉上等价于"按需注册",但实现更简单,且天然支持多组件声明同一 path
//     不同 target(切换组件即切换代理目标)。

import type { Plugin, ViteDevServer } from 'vite';
import httpProxy from 'http-proxy';
import type { ApiRule, ComponentConfig } from '@style-library/component-contract';

// ---- 归一化 -----------------------------------------------------------

/**
 * 把 ComponentConfig.api 的两种写法归一成 ApiRule[]。
 *   - 数组:已经是,直接返回
 *   - 对象:每个 key 推 context 为 `/api/<key>`,value 若是 string 当 target,
 *     否则展开成 ApiRule(允许覆盖 context)
 */
function normalizeApi(api: ComponentConfig['api']): ApiRule[] {
  if (!api) return [];
  if (Array.isArray(api)) return api;
  return Object.entries(api).map(([name, v]) => {
    if (typeof v === 'string') {
      return { context: `/api/${name}`, target: v };
    }
    return { context: v.context ?? `/api/${name}`, ...v };
  });
}

// ---- 工厂 -------------------------------------------------------------

export interface MfeDynamicProxyOptions {
  /**
   * 静态规则源:启动时一次性传入,运行时不再变。
   * 通常由 showcase 的 vite.config.ts 通过 scanConfigs 收集得到。
   */
  configs: ComponentConfig[];
}

export function mfeDynamicProxy(opts: MfeDynamicProxyOptions): Plugin {
  // 启动时收集:id → 规则集。静态,运行期不变。
  const table = new Map<string, ApiRule[]>();
  for (const c of opts.configs) table.set(c.id, normalizeApi(c.api));

  // 运行时唯一可变状态:当前激活的组件 id(独占语义,同时只能有一个)
  let activeId: string | null = null;

  // http-proxy 实例,带 ws 支持(虽然这里规则大多不带 ws,但配置 ws:true 时
  // 仍要求 proxy 启用 ws upgrade —— 见 http-proxy 文档)
  const proxy = httpProxy.createProxyServer({ ws: true });

  // 错误处理:代理转发失败时给客户端一个 502 而不是空白
  proxy.on('error', (err, _req, res) => {
    // res 可能是 ServerResponse 或 Socket(upgrade 场景);只处理前者
    const r = res as unknown as { writeHead?: (n: number, h?: Record<string, string>) => void; end?: (s: string) => void };
    if (typeof r.writeHead === 'function' && typeof r.end === 'function') {
      r.writeHead(502, { 'content-type': 'text/plain' });
      r.end(`Bad gateway: ${err.message}`);
    }
  });

  return {
    name: 'mfe-dynamic-proxy',

    configureServer(server: ViteDevServer) {
      // ---- /__mfe/activate?id=<id> ------------------------------------
      // 浏览器端组件挂载前调用。设置 activeId;若 id 不在 table 里则忽略
      // (避免任意组件被恶意激活)。
      server.middlewares.use('/__mfe/activate', (req, res) => {
        const id = new URL(req.url ?? '/', 'http://x').searchParams.get('id');
        activeId = id && table.has(id) ? id : null;
        res.statusCode = 200;
        res.setHeader('content-type', 'text/plain');
        res.end('ok');
      });

      // ---- /__mfe/deactivate?id=<id> ----------------------------------
      // 浏览器端组件卸载前调用。仅当 deactivate 的 id 等于当前 activeId
      // 时才清,避免异步竞态(用户连切 A→B,可能 A 的 deactivate 比 B 的
      // activate 晚到,误把 B 的激活清掉)。
      server.middlewares.use('/__mfe/deactivate', (req, res) => {
        const id = new URL(req.url ?? '/', 'http://x').searchParams.get('id');
        if (activeId === id) activeId = null;
        res.statusCode = 200;
        res.setHeader('content-type', 'text/plain');
        res.end('ok');
      });

      // ---- 唯一的动态 dispatcher -------------------------------------
      // 任何请求:若 activeId 非空,尝试匹配规则;否则 next() 让 vite 走
      // 默认 SPA fallback(返回 index.html)。
      server.middlewares.use((req, res, next) => {
        if (!activeId) return next();
        if (!req.url) return next();

        const rules = table.get(activeId) ?? [];
        // 找最长前缀匹配:同组件声明了 /api 和 /api/foo 时,/api/foo/... 应
        // 命中 /api/foo 这条。
        const matched = rules
          .filter((r) => req.url!.startsWith(r.context))
          .sort((a, b) => b.context.length - a.context.length)[0];
        if (!matched) return next();

        // 路径重写
        let url = req.url;
        if (typeof matched.rewrite === 'function') {
          url = matched.rewrite(url);
        } else if (matched.rewrite) {
          for (const [re, to] of Object.entries(matched.rewrite)) {
            url = url.replace(new RegExp(re), to);
          }
        }
        req.url = url;

        proxy.web(
          req,
          res,
          {
            target: matched.target,
            changeOrigin: matched.changeOrigin ?? true,
            ws: matched.ws,
          },
          next,
        );
      });
    },
  };
}