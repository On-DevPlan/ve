---
ref: auth-jwt
parent: user-kv-integration
---

# ref1 — 登录注册流程 + JWT 身份

> 给前端组件对接 **邮箱注册/登录 + JWT** 的完整流程。接口字段见 [[api-reference]];「我这种组件该用哪些接口」见 [[usage-scope]]。

## 概览

| 事项 | 值 |
|---|---|
| Base URL | `http://<host>:8080/api/v1`(前端走同源相对路径 `/api/v1`,见 [[adding-a-component]]) |
| 公开接口 | `send-code` / `register` / `login`(无需 token) |
| 需登录接口 | 其余全部,带 `Authorization: Bearer <JWT>` |
| JWT 有效期 | **30 天**(HS256) |
| 响应信封 | `{ code, message, data }` —— **业务错误(code 50/51/52)HTTP 仍是 200**,看 `body.code` 判断成败 |

## 流程总览

```
1. POST /user/send-code              → 发邮件验证码
2. POST /user/register               → { userId }(自动建「个人空间」+ 生成用户自己的邀请码)
3. POST /user/login                  → { token, userId }
4. 前端持久化 token 到 localStorage
5. 所有请求带 Authorization: Bearer <token>
6. GET /user/info                    → 拿自己的 invitationCode,分享给朋友注册
```

## 1. `POST /user/send-code`

```json
{ "email": "a@b.c", "purpose": "register" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `email` | ✅ | 收件邮箱 |
| `purpose` | 默认 `register` | `register` / `reset` |

- 同一邮箱 + 用途 **60 秒冷却**(超时报「发送太频繁」)
- 验证码 6 位数字,**10 分钟有效、一次性**

## 2. `POST /user/register`

```json
{
  "email": "a@b.c",
  "password": "pass123",
  "code": "123456",
  "invitationCode": "ABC12345",
  "nickname": "昵称(可选)"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `email` | ✅ | 唯一,登录主标识 |
| `password` | ✅ | ≥6 位 |
| `code` | ✅ | 邮箱验证码(6 位) |
| `invitationCode` | ✅ | **邀请码必填**(`ROOT-INIT-2026` 是默认引导码) |
| `nickname` | 可选 | |

响应:`{ "userId": 1 }`

**注册副作用**(同事务):
- 创建 `user_groups(name='个人空间', owner_id=userId)` + `group_members(role='owner')` + 写回 `users.default_group_id`
- 创建用户自己的邀请码(8 位)
- 若有邀请人,记录 `referral_responses` + 加 `referral_codes.used_count`
- consume 验证码

> 所以**每个用户天生有一个「个人空间」** —— 这就是后端 KV 端点把 `groupId=0` 解析成「caller 的 default_group_id」的原因。

## 3. `POST /user/login`

```json
{ "email": "a@b.c", "password": "pass123" }
```

响应:`{ "token": "<JWT>", "userId": 1 }`

- token 有效期 **30 天**
- 后续请求带 `Authorization: Bearer <token>`

## 4. `GET /user/info`

响应:
```json
{
  "id": 1,
  "email": "a@b.c",
  "username": "",
  "nickname": "",
  "invitationCode": "ABC12345"
}
```

> ⚠️ 当前 DTO **不返回 `defaultGroupId`**。前端需要「我的默认组是哪个」时,用 `GET /groups` 然后看哪个 `isDefault`,或直接让后端解析(见 [[usage-scope]] §决策:不解析 defaultGroupId)。**不要**写 GET 端点查 default。

## 5. `POST /user/invitation/regenerate`

响应:`{ "invitationCode": "NEWCODE99" }`

- 旧码停用(他人再拿旧码注册会失败),历史邀请关系保留

## 6. `PATCH /user/default-group`

切换默认工作空间。**必须**已是目标组成员。

```json
{ "groupId": 42 }
```

响应:`{ "groupId": 42, "message": "default group updated" }`

> **没有 GET 端点**。后端 KV 端点(`/kv/*`)接受 `groupId` 参数 `0` 或缺失 → 自动用 caller 的 `default_group_id`,前端不需要知道具体值就能命中「个人空间」。

---

## 前端集成要点(JWT 生命周期)

### token 存 localStorage,登出必须清

```ts
// 登录成功
localStorage.setItem('token', token);

// 登出 —— 必须清 LS token,否则下次启动拿坏 token 试
function logout() {
  localStorage.removeItem('token');
  setLoggedOut();
}
```

### 401 不要立刻登出(关键反直觉点)

**默认行为**(原 e2ekv)是 401 → 自动清 creds + 跳游客模式。
**问题**:save 中途遇 401(后端 jwt 中间件 bug)→ 用户**莫名其妙被退出**,sync pill 状态混乱。

**正确**:遇 401 设 `error` 状态 + 抛错,**保留 creds**。让用户看到错误,**自己决定重登或重试**。

```ts
// ❌ 错:遇 401 就清 token
if (res.status === 401) {
  localStorage.removeItem('token');
  setLoggedOut();
}

// ✅ 对:401 留 token,显示错误让用户决定
if (res.status === 401) {
  showSyncError('会话过期,请重新登录');
  // token 仍留着,用户点「重登录」才清
}
```

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

// ✅ 对:看 body.code
const body = await res.json();
if (body.code !== 0) { showError(body.message); return; }
```

---

## 错误码表(鉴权相关)

| 场景 | code | HTTP | message 示例 |
|---|---|---|---|
| 未登录 | 401 | 401 | `unauthorized` |
| JWT 无效/过期 | 401 | 401 | `unauthorized: invalid token` |
| 邮箱密码错 | 50 | 200 | `邮箱或密码错误` |
| 验证码错 | 50 | 200 | `验证码无效或已过期` |
| 邀请码无效 | 50 | 200 | `invitation code not found` |
| 邀请被撤 / 用完 / 过期 | 50 | 200 | `invitation revoked` / `invitation used up` / `invitation expired` |
| 参数校验 | 51 | 200 | `InvalidRules: ...` |
| 无默认组 | 50 | 200 | `user has no default group, set default_group_id first` |

---

## 与 e2ekv 的取舍

| 维度 | user/kv(本协议) | e2ekv |
|---|---|---|
| 身份 | 邮箱 + 密码 + JWT | 密码派生的 AuthHash |
| 服务端能解密? | ✅ 能(value 明文) | ❌ 不能(只看见 ciphertext) |
| 找回密码 | ✅ 邮箱验证码 | ❌ 没,数据丢失 |
| 邀请 / 共享 | ✅ referral_codes + group invitations | ❌ 无 |
| 跨设备 | ✅ JWT + 邮箱 | ✅ 输密码 |
| 多组隔离 | ✅ group_id + RBAC | ❌ 单用户 |
| 适合场景 | 公开 SaaS,中等隐私,多组协作 | 私密 vault,强加密 |

**user/kv 不替代 e2ekv**:它给的是「便利 + 找回密码 + 多组协作」,代价是「服务端能看」。对真正私密的数据(如密码 vault),仍应走 e2ekv 或同类零知识方案。
