---
ref: protocol
parent: user-kv-integration
---

# user/kv 客户端对接协议

> 给前端 / 第三方对接用。**纯接口契约**:路径 / 方法 / 鉴权 / 请求 / 响应 / 错误码。
>
> 不讲后端实现(那是 `dev_ctr_hello/.claude/skills/user-kv-invitecode/SKILL.md` 的范围)。

## 基础

- Base URL:`http://<host>:8080/api/v1`
- 需登录接口:`Authorization: Bearer <JWT>`
- 公开接口:`send-code` / `register` / `login`(无需 token)
- 其余全部需登录(MustAuth,无 token 直接 401)

## 响应信封

```json
{ "code": 0, "message": "OK", "data": { ... } }
```

| code | 含义 | HTTP 状态 |
|------|------|-----------|
| 0 | 成功 | 200 |
| 50 | 业务错误(message 含原因) | 200 |
| 51 | 参数校验错误(message 含哪个字段) | 200 |
| 52 | 数据库约束冲突(如 unique violation) | 200 |
| 401 | 未登录 / 凭证无效 | 401 |

> ⚠️ **业务错误(code=50/51/52)HTTP 状态都是 200**,判断成败看 `body.code`,不是 HTTP 状态。

---

## 公开接口(无需 token)

### 1. `POST /user/send-code`

```json
{ "email": "a@b.c", "purpose": "register" }
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `email` | ✅ | 收件邮箱 |
| `purpose` | 默认 `register` | `register` / `reset` |

响应:`{ "message": "验证码已发送" }`

- 同一邮箱 + 用途 **60 秒冷却**(超时报"发送太频繁")
- 验证码 6 位数字,**10 分钟有效**、**一次性**

### 2. `POST /user/register`

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
|------|------|------|
| `email` | ✅ | 唯一,登录主标识 |
| `password` | ✅ | ≥6 位 |
| `code` | ✅ | 邮箱验证码(6 位) |
| `invitationCode` | ✅ | **邀请码必填**(`ROOT-INIT-2026` 是默认引导码) |
| `nickname` | 可选 | |

响应:`{ "userId": 1 }`

### 3. `POST /user/login`

```json
{ "email": "a@b.c", "password": "pass123" }
```

响应:`{ "token": "<JWT>", "userId": 1 }`

- token 有效期 **24 小时**
- 后续请求带 `Authorization: Bearer <token>`

---

## 需登录接口(带 `Authorization: Bearer <JWT>`)

### 4. `GET /user/info`

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

### 5. `POST /user/invitation/regenerate`

响应:`{ "invitationCode": "NEWCODE99" }`

- 旧码停用(他人再拿旧码注册会失败),历史邀请关系保留

### 6. `POST /kv`

```json
{
  "key": "config",
  "value": "v1",
  "visibility": "private",
  "ttl": 0
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `key` | ✅ | key 名 |
| `value` | ✅ | 值(字符串) |
| `visibility` | 默认 `private` | `private` / `public` |
| `ttl` | 默认 0 | 过期秒数,0=不过期 |

响应:`{ "message": "kv set successfully" }`

- ⚠️ **同一用户内 key 唯一,重复 set 应该覆盖**。**当前后端有 bug**:upsert 实际撞唯一约束,返回 `code: 52`。前端必须 DELETE+POST 兜底。

### 7. `GET /kv/:key?ownerId=<n>`

读自己的 key:`GET /kv/config`
读他人 public key:`GET /kv/config?ownerId=2`

响应:
```json
{
  "key": "config",
  "value": "v1",
  "visibility": "private",
  "expires_at": ""
}
```

- `expires_at` 空串 = 永不过期
- 读他人 **private** key → `code: 50, message: "permission denied: key is not public"`

### 8. `DELETE /kv/:key`

响应:`{ "message": "kv deleted successfully" }`

- 仅 owner 可删;删他人 key → `code: 50, message: "key not found"`

### 9. `GET /kv?limit=&offset=`

响应:
```json
{
  "items": [
    { "key": "config", "value": "v1", "visibility": "private", "expires_at": "" }
  ],
  "total": 1
}
```

- 只列**自己**的 KV(private + public)
- 已过期项自动过滤

---

## 错误码速查

| 场景 | 响应 code | message |
|------|-----------|---------|
| 无 token 访问需登录接口 | 401 | `unauthorized: missing authorization header` |
| 验证码错误 / 过期 | 50 | `验证码无效或已过期` |
| 缺邀请码 | 51 | `The invitationCode field is required` |
| 邀请码无效 / 已用尽 | 50 | `邀请码无效或已用尽` |
| 发送太频繁 | 50 | `发送太频繁, 请 60 秒后重试` |
| 邮箱已注册 | 50 | `邮箱 xxx 已注册` |
| 读他人 private KV | 50 | `permission denied: key is not public` |
| 重复 upsert 同 key | 52 | `duplicate key value violates unique constraint "uq_kv_owner_key"` |
| JWT 过期 | 401 | (任意 message,看后端实现) |

---

## 典型对接流程

```
1. POST /user/send-code              → 收邮件填验证码
2. POST /user/register               → { userId }
3. POST /user/login                  → { token, userId }
4. 持久化 token 到 localStorage
5. 所有请求带 Authorization: Bearer <token>
6. GET /user/info 拿自己的 invitationCode, 分享给朋友注册
7. KV: set/get/list/delete 自己的配置
```

---

## 反直觉点(前端容易踩)

### 业务错误 HTTP 是 200

```ts
// ❌ 错:只看 HTTP 状态
if (!res.ok) { showError(); return; }

// ✅ 对:看 body.code
const body = await res.json();
if (body.code !== 0) { showError(body.message); return; }
```

### 401 不要立刻登出

```ts
// ❌ 错:遇 401 就清 token
if (res.status === 401) {
  localStorage.removeItem('token');
  setLoggedOut();
}

// ✅ 对:401 留 token,显示错误让用户决定
if (res.status === 401) {
  showSyncError('会话过期,请重新登录');
  // token 仍留着,用户点"重登录"才清
}
```

### upsert 失败要 DELETE+POST 兜底

```ts
let r = await fetch('/api/v1/kv', { ... });
if (!r.ok && r.code === 52) {
  await fetch('/api/v1/kv/shortcuts', { method: 'DELETE', ... });
  r = await fetch('/api/v1/kv', { ... });
}
```

---

## 与 e2ekv 的取舍

| 维度 | user/kv (本协议) | e2ekv |
|---|---|---|
| 身份 | 邮箱 + 密码 + JWT | 密码派生的 AuthHash |
| 服务端能解密? | ✅ 能(value 明文) | ❌ 不能(只看见 ciphertext) |
| 找回密码 | ✅ 邮箱验证码 | ❌ 没,数据丢失 |
| 邀请 / 共享 | ✅ referral_codes | ❌ 无 |
| 跨设备 | ✅ JWT + 邮箱 | ✅ 输密码 |
| 适合场景 | 公开 SaaS,中等隐私 | 私密 vault,强加密 |

**user/kv 不替代 e2ekv**:它给的是"便利 + 找回密码",代价是"服务端能看"。对真正私密的数据(如密码 vault),仍应走 e2ekv 或同类零知识方案。