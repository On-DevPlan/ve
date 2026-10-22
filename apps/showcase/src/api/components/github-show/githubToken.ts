// apps/showcase/src/api/components/github-show/githubToken.ts
//
// GitHub token 的存取(v1.6.50):统计热力图要走 api.github.com,匿名配额
// 60 次/小时/IP 根本不够(每仓库恒定 1 次 commit_activity,十几个仓库即
// 触发限流)—— 编辑者放自己的 PAT 进来,配额升到 5000/小时/用户。
//
// 为什么单独一个 key(而不是塞进文档 blob):
//   - 文档 blob(github-show)与统计快照(github-show-stats)在公开分享模式下
//     都是 **public** 可见性 —— 拿到分享链接的人能直接读。token 放进去等于
//     把 PAT 送给所有读者:他们能刷你的配额,PAT 带 repo scope 时还能读你的
//     私有仓库。
//   - 所以 token 落**独立 key + private 可见性**:只有带 JWT 的本人能读,
//     公开读端点(GET /kv/public/:key)只放行 public 行,分享链接读不到。
//
// 传输路径(浏览器直连,不经过后端代理):
//   token 存 private KV → 组件用鉴权 KV 客户端读出 → 作为 Authorization 头
//   直接请求 api.github.com。GitHub API 的 CORS 预检实测放行 Authorization
//   (Access-Control-Allow-Origin: * + allow-headers 含 Authorization),
//   因此不存在跨域问题;顺带 X-RateLimit-* 在 Expose-Headers 里,前端能读
//   到剩余配额。
//
// 权衡(明文 vs 加密):后端支持 `secret: true` 用二级密码加密 value,但要求
//   ctx 里有已解锁的 KEK(X-Secret-Password),没设过 KV 二级密码的账号直接
//   写会失败 —— 这里默认明文 + private 可见性(后端默认行为),不强制用户
//   先去设二级密码。敏感等级:个人 PAT,建议只给公开读权限。

import { kvV1Service } from '../../services';

/** token 所在 KV key(独立于文档与统计快照,private 可见性) */
export const GITHUB_TOKEN_KV_KEY = 'github-show-token';

const GITHUB_TOKEN_TAGS = ['github-show'] as const;

/**
 * 内存缓存:同一会话里多张 CommitStats(表格 tab + 图表 tab 各挂一份)与
 * 多次续期共用一个 token,不必每次都打一次 KV。
 */
let cached: string | null = null;

/** 取当前缓存的 token(未配置返回空串) */
export function getCachedGithubToken(): string {
  return cached ?? '';
}

/** 写内存缓存(空串/空白 = 未配置) */
export function setCachedGithubToken(token: string | null): void {
  const v = (token ?? '').trim();
  cached = v === '' ? null : v;
}

/**
 * 从 KV 读 token(需鉴权)。读不到(未配置 / 无权限 / 网络错)一律当作
 * 「未配置」—— 统计退回匿名请求,行为与今天一致,不因此报错。
 */
export async function loadGithubToken(): Promise<string> {
  try {
    const item = await kvV1Service.get({ key: GITHUB_TOKEN_KV_KEY });
    setCachedGithubToken(typeof item?.value === 'string' ? item.value : '');
  } catch {
    // code 50(无默认组)/404(key 不存在)/401(未登录)/网络错 —— 一律当作
    // 「未配置」:统计退回匿名请求,行为与今天一致,不因此报错。
    setCachedGithubToken('');
  }
  return getCachedGithubToken();
}

/** 保存 token(空串 = 清除)。写入显式声明 private,避免后端沿用旧值。 */
export async function saveGithubToken(token: string): Promise<void> {
  const v = token.trim();
  if (v === '') {
    await clearGithubToken();
    return;
  }
  await kvV1Service.set({
    key: GITHUB_TOKEN_KV_KEY,
    value: v,
    tags: [...GITHUB_TOKEN_TAGS],
    ttl: 0,
    visibility: 'private',
  });
  setCachedGithubToken(v);
}

/** 清除 token(删 key);key 不存在也当清除成功。 */
export async function clearGithubToken(): Promise<void> {
  try {
    await kvV1Service.delete({ key: GITHUB_TOKEN_KV_KEY });
  } catch {
    // key 不存在(50/404)也算已清除
  }
  setCachedGithubToken('');
}
