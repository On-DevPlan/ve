---
ref: auth-jwt
parent: user-kv-integration
---

# ref1 — 统一身份登录(OIDC)+ JWT 身份

> ve 的登录/注册走**统一身份认证中心 go-ah(auth-hub,OIDC 授权码 + PKCE)**。
> 接口字段见 [[api-reference]];「我这种组件该用哪些接口」见 [[usage-scope]]。

## 概览

| 事项 | 值 |
|---|---|
| Base URL | `/api/v1`(前端走同源相对路径,见 [[adding-a-component]]) |
| 登录方式 | **仅** OIDC 统一身份(认证中心托管登录 + 注册) |
| 公开端点 | `GET /user/oidc/config`、`POST /user/oidc/callback`(无需 token) |
| 需登录接口 | 其余全部,带 `Authorization: Bearer <JWT>` |
| JWT 有效期 | 后端配置(默认 24h,HS256);过期 401 → 重新点一次统一登录(IdP 会话在,免密即过) |
| 响应信封 | `{ code, message, data }` —— **业务错误(code 50/51/52)HTTP 仍是 200**,看 `body.code` 判断成败 |

> ⚠️ **例外(file 域)**:`/files/*` 管理接口走 **VirtualUser 中间件**,无 token 也能调(落匿名公共组 + 强制 public)—— 免费图床场景。user / groups / kv 域仍全部 MustAuth。见 [[api-reference]] 文件域引言。
>
> 📌 **后端仍保留**邮箱验证码注册 / 邮箱密码登录端点(`send-code` / `register` / `login`),供其他客户端使用;**ve 前端已不再封装**(2026-10 起,`services/userV1` 只有 OIDC 两个端点)。

## 前端流程(ve 已实现的,组件作者只需知道入口)

```
1. 组件调 useLoginModal().open()        → router.push('/login?from=<当前页>')
2. /login 页点「统一身份登录」           → startOidcLogin():
     GET  /user/oidc/config             → 拿 issuer / clientId / authorize 地址
     生成 state + code_verifier(S256)   → 存 sessionStorage(跨全站跳转)
     location.assign(authorize URL)     → 整页跳认证中心
3. 认证中心完成登录 / 注册(凭邀请码)     → 302 回 /oidc/callback?code=&state=
4. OidcCallbackPage:exchangeOidcCode()
     校验 state(防 CSRF)               → POST /user/oidc/callback 换本系统 JWT
     → token 落 localStorage → 拉 /user/info → logged-in
5. 回跳 returnTo(发起前的目标页)
```

ve 侧实现位置:

| 关注点 | 文件 |
|---|---|
| 协议(PKCE / state / authorize URL / 换票) | `apps/showcase/src/api/http/oidc.ts` |
| 会话状态机(token / LS / Bearer / 401) | `apps/showcase/src/api/http/auth-store.ts` |
| 登录入口页 | `apps/showcase/src/pages/login/LoginPage.vue` |
| 回调落地页 | `apps/showcase/src/pages/login/OidcCallbackPage.vue`(路由 `/oidc/callback`) |

**redirect_uri 契约**:前端用 `${origin}/oidc/callback`,认证中心按其**逐字**匹配
`dev-ctr-hello` 客户端的 redirect_uris 白名单(回环通配 `http://localhost:*/oidc/callback`
覆盖 dev;prod 精确条目 `https://abc.jokelx.xyz/oidc/callback`)。**不要**用
`/user/oidc/config` 返回的 `redirectUri` —— 那是 go-co 自带参考页的地址。

## 首次登录的账号落地(SignInWithIdP,后端行为)

| 落地方式 | 响应字段 | 用户看到的效果 |
|---|---|---|
| 邮箱命中既有本地账号(含旧邮箱密码注册的) | `identityBound=true` | 自动接管原账号,**原有数据全在** |
| 邮箱本系统没有 → 自动建号 | `provisioned=true` | 自动建「个人空间」默认组 + 生成自己的邀请码;**password 留空**,该账号只能走统一登录 |
| 外部身份原本绑在别的账号,按邮箱改绑 | `rebound=true` | 归属变更,后端落 warning 日志 |

## 组件侧集成要点(JWT 生命周期)

### token 存 localStorage,登出必须清

auth-store 已实现(`logout()` → `handleUnauthorized()`:清 token / LS / Bearer 注入)。
组件只调 `jwtAuth.logout()`(React:`useAuth().logout`),**不要自己碰 localStorage**。

### 401 不要立刻登出(关键反直觉点)

**默认行为**(原 e2ekv)是 401 → 自动清 creds + 跳游客模式。
**问题**:save 中途遇 401 → 用户**莫名其妙被退出**,sync pill 状态混乱。

**正确**:遇 401 设 `error` 状态 + 抛错,**保留 creds**。request.ts 对 Bearer 401 的
默认分流是"发信号 + 静默降级"(auth-store `handleUnauthorized`);业务组件想在
401 时保留现场,自己 catch `ApiError(401)` 处理,**不要**在组件里裸 fetch。

**唯一例外**:启动时 `init()` 的 401(无操作可丢)→ 自动 logout。

### jwtAuthState init race(关键反直觉点)

`main.ts` 里 `void jwtAuth.init()` 是 fire-and-forget。存在一个「token 落 ref 已设但 `jwtUser` 还在拉 /user/info」的中间态。`useJwtAuth()` 第一次返回的快照里:

```ts
{
  token: 'jwt-abc',              // ← 已设置(从 LS 读出来的)
  jwtUser: null,                 // ← 还没拿到(/user/info 还在 await)
  jwtAuthState: 'logged-out',    // ← 还是初始值
}
```

如果只 watch `auth.token`,**会选 cloudStore** → 调 `userSpace.getShortcuts()` → `requireAuth()` 抛「not logged in」→ 页面空白 + **不会再重试**(jwtUser 后续到位没有 trigger)。

**正确**:**同时 watch `auth.token` 和 `auth.jwtAuthState === 'logged-in'`**:

```ts
const store = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
useEffect(() => { /* load */ }, [auth.token, auth.jwtAuthState, ...]);
```

init 完成后态变 `logged-in` → effect 重跑 → 真正发请求。

### 业务错误看 body.code,不是 HTTP 状态

```ts
// ❌ 错:只看 HTTP 状态
if (!res.ok) { showError(); return; }

// ✅ 对:看 body.code(request.ts 已解包为 ApiError,组件层 catch 即可)
try { await service.xxx(); } catch (e) { showError(e.message); }
```

---

## 错误码表(鉴权相关)

| 场景 | code | HTTP | message 示例 |
|---|---|---|---|
| 未登录 | 401 | 401 | `unauthorized` |
| JWT 无效/过期 | 401 | 401 | `unauthorized: invalid token` |
| 服务端未启用统一登录 | Error | - | `服务端未启用统一身份登录`(startOidcLogin 抛) |
| 认证中心不可达 | Error | - | `认证中心不可达：<原因>`(config.idpError) |
| state 校验失败 | Error | - | `state 校验失败,拒绝该授权码`(前端防 CSRF) |
| 授权码无效/已用 | 50 | 200 | `授权码换取 token 失败: invalid_grant ...` |
| 参数校验 | 51 | 200 | `InvalidRules: ...` |
| 无默认组 | 50 | 200 | `user has no default group, set default_group_id first` |

---

## 与 e2ekv 的取舍

| 维度 | user/kv(本协议) | e2ekv |
|---|---|---|
| 身份 | 统一身份中心(OIDC)+ JWT | 密码派生的 AuthHash |
| 服务端能解密? | ✅ 能(value 明文) | ❌ 不能(只看见 ciphertext) |
| 找回密码 | ✅ 走认证中心(账号在 IdP 侧管理) | ❌ 没,数据丢失 |
| 邀请 / 共享 | ✅ group invitations(kv 共享走 kv_shares 短码) | ❌ 无 |
| 跨设备 | ✅ JWT + IdP 会话 | ✅ 输密码 |
| 多组隔离 | ✅ group_id + RBAC | ❌ 单用户 |
| 适合场景 | 公开 SaaS,中等隐私,多组协作 | 私密 vault,强加密 |

**user/kv 不替代 e2ekv**:它给的是「便利 + 找回 + 多组协作」,代价是「服务端能看」。对真正私密的数据(如密码 vault),仍应走 e2ekv 或同类零知识方案。
