// api/normalize.ts —— registry 归一化(SPEC §决策 ⑤ 共用归一化)。
//
// 这个文件是**路径形态的唯一决策点**。dev 侧(to-vite-proxy)与 prod 侧
// (gen-nginx)都只消费本文件的输出,自己不再对尾斜杠 / query string 做解释。
//
// 为什么必须收口在这里:
//   曾经 registry 注册 '/api/v1/kv'(无尾斜杠),但两侧解释不同 ——
//     dev:  url === ctx || url.startsWith(ctx + '/')  → '/api/v1/kv' 命中
//     prod: location ^~ ${ctx}/                        → '/api/v1/kv/' 不命中
//   结果 POST /api/v1/kv(kvV1Service.set)在 dev 正常、在 prod 落到
//   try_files → index.html → 静态资源对 POST 返回 405。
//   "本地能跑、上线 404" 正是这套设计要消灭的失败模式,却因尾斜杠决策
//   泄漏到 gen-nginx.ts 而重新出现。
//
// 现在的契约:
//   normalizeContext(route)          → 规范前缀(以 / 开头、无尾斜杠)
//   matchesContext(url, context)     → dev 与 prod 共用的命中判定语义
//   normalizeApi(backend, isProd)    → { context, target, changeOrigin }
//
//   nginx 侧直接用 context 渲染 `location ^~ <context>`(不补尾斜杠)——
//   nginx 前缀匹配天然覆盖 <context> 自身与 <context>/... 两种形态,
//   与 matchesContext 的语义一致。

import type { ApiTarget, BackendRegistration } from './types';

export interface NormalizedRule {
  /** 规范化前缀:以 / 开头,无尾斜杠。dev 匹配与 nginx location 都用它。 */
  context: string;
  /** 已按环境解析的目标 URL(无尾斜杠)。 */
  target: string;
  /** http-proxy / nginx 用 */
  changeOrigin: boolean;
}

export class NormalizeError extends Error {
  constructor(msg: string) {
    super(`[api/normalize] ${msg}`);
    this.name = 'NormalizeError';
  }
}

/**
 * 把作者书写的 route 规范成前缀形态:保证以 / 开头、剥掉所有尾斜杠。
 *
 * 剥尾斜杠的理由:'/api/v1/kv' 与 '/api/v1/kv/' 必须是同一个前缀,否则
 *   - registry 冲突检测会漏(两条被视为不同 path)
 *   - nginx 渲染出 `location ^~ /api/v1/kv//`(双斜杠永不匹配)
 * 根路径 '/' 是唯一保留斜杠的特例。
 *
 * @throws NormalizeError 当 route 不以 / 开头
 */
export function normalizeContext(route: string, backendId?: string): string {
  if (!route.startsWith('/')) {
    throw new NormalizeError(
      `backend "${backendId ?? '?'}" route "${route}" does not start with "/"; ` +
        `nginx prefix locations must be absolute paths and dev matching would never hit`,
    );
  }
  const stripped = route.replace(/\/+$/, '');
  // route === '/' 时 stripped 为空串 —— 退回 '/'
  return stripped === '' ? '/' : stripped;
}

/**
 * dev 与 prod **共用**的命中判定。
 *
 * 规则:剥掉 query / hash 后,pathname 等于 context 或以 `context + '/'` 开头。
 * 这与 nginx `location ^~ <context>` 的前缀匹配语义一致:
 *   context = '/api/v1/kv'
 *     /api/v1/kv            ✅  (kvV1Service.set / list 无参)
 *     /api/v1/kv?limit=10   ✅  (list 带参 —— 剥 query 后同上)
 *     /api/v1/kv/shortcuts  ✅  (get / delete / tags)
 *     /api/v1/kvx           ❌  (不是路径边界,避免 /api/v1/kv 吞掉 /api/v1/kvx)
 *
 * @param url 原始请求 URL(可含 query / hash)
 * @param context normalizeContext 的输出
 */
export function matchesContext(url: string, context: string): boolean {
  // 剥 query 与 hash —— dev 侧拿到的是 req.url,含 '?limit=10' 时
  // 既不等于 context 也不以 context + '/' 开头,曾导致带参请求漏代理。
  const pathname = url.split(/[?#]/, 1)[0];
  if (context === '/') return true;
  return pathname === context || pathname.startsWith(context + '/');
}

/**
 * 从 ApiTarget 取出指定环境的 base URL,并剥掉尾斜杠。
 *
 * 缺对应环境的值时**抛错而非回退**:回退到 dev 值意味着把 localhost 印进
 * 生产 nginx 配置,在容器里 localhost 是容器自身回环地址 → 必然 502。
 * 宁可构建期炸,不要运行期 502。
 *
 * 剥 target 尾斜杠的理由:nginx `proxy_pass` 带尾斜杠时会剥掉 location
 * 前缀(/api/v1/kv/x → /x),后端 404。统一在这里剥,渲染端不必再判。
 */
function resolveTarget(target: ApiTarget, isProd: boolean, backendId?: string): string {
  const raw =
    typeof target === 'string' ? target : target[isProd ? 'prod' : 'dev'];
  if (!raw) {
    throw new NormalizeError(
      `backend "${backendId ?? '?'}" missing target.${isProd ? 'prod' : 'dev'}. ` +
        `Declare both { dev, prod }, or use a plain string when both environments share one backend.`,
    );
  }
  return raw.replace(/\/+$/, '');
}

/**
 * 归一化一条后端注册。dev 与 prod 走同一函数,只有 isProd 不同。
 *
 * @param backend   单条后端注册
 * @param isProd    true → 取 prod target;false → 取 dev target
 * @param backendId 调试 / 报错用
 */
export function normalizeApi(
  backend: BackendRegistration,
  isProd: boolean,
  backendId?: string,
): NormalizedRule {
  return {
    context: normalizeContext(backend.route, backendId),
    target: resolveTarget(backend.target, isProd, backendId),
    changeOrigin: true,
  };
}