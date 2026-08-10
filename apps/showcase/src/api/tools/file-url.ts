// api/file-url.ts —— 后端文件 url → 同源相对路径改写器。
//
// 为什么需要:
//   后端 /api/v1/files(list / upload / info)返回的 url 字段按「请求协议」
//   拼接 —— HTTPS 页面访问时,后端读到 X-Forwarded-Proto: https,拼出
//     "https://47.110.80.47:8988/files/<fileId>"
//   但 8988 端口的后端文件服务只支持 HTTP;且 https 页面加载 http 资源会
//   触发 mixed-content 拦截。两端都不通。
//
// 解法:
//   前端统一把 url 剥成同源相对路径 "/files/<fileId>",由
//     - prod:nginx `location ^~ /files/` 反代到后端文件服务
//     - dev :apiGateway 中间件反代到后端文件服务(to-vite-proxy.ts)
//   浏览器永远同源请求,协议自动跟随页面(https),无 mixed-content、
//   无跨端口 TLS 问题。后端怎么拼 url 都无所谓。
//
// 兼容:
//   - 带 query(?token=xxx,protected/private 文件鉴权)→ 保留
//   - 已是相对路径("/files/xxx")→ 原样返回,幂等
//   - 非 /files/ 路径(外链 / 未来其他 CDN)→ 原样返回,不误伤
//   - 解析失败(非法 url)→ 原样返回,降级而非崩溃

/** 后端文件服务路径前缀(与 nginx `location ^~ /files/` 对齐)。 */
const FILE_PATH_PREFIX = '/files/';

/**
 * 把后端返回的文件 url 改写成同源相对路径。
 *
 * @example
 *   resolveFileUrl('https://47.110.80.47:8988/files/abc?token=x')
 *   // → '/files/abc?token=x'
 *   resolveFileUrl('/files/abc')            // 已相对 → 原样
 *   // → '/files/abc'
 *   resolveFileUrl('https://example.com')   // 非 /files/ → 原样
 *   // → 'https://example.com'
 */
export function resolveFileUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith(FILE_PATH_PREFIX)) return url;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(url, base);
    if (u.pathname.startsWith(FILE_PATH_PREFIX)) {
      return u.pathname + u.search + u.hash;
    }
    return url;
  } catch {
    return url;
  }
}
