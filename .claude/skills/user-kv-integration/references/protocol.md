---
ref: protocol
parent: user-kv-integration
---

# user/kv + user/groups 客户端对接协议(2026-08-04 模型迁移后)

> 给前端 / 第三方对接用。**纯接口契约**:路径 / 方法 / 鉴权 / 请求 / 响应 / 错误码。
>
> **2026-08-04 模型迁移**:旧的 `kv_items.visibility` 已废弃。所有 KV 现在归属 `kv_items.group_id` (FK → `user_groups),权限由 `group_members.role` 决定。本文档反映新模型。**不要使用 `visibility` / `?ownerId=`** —— 那是历史残留。
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
| 52 | 数据库约束冲突(unique violation) | 200 |
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

**副作用**(同事务):
- 创建 `user_groups(name='个人空间', owner_id=userId)` + `group_members(role='owner')` + 写回 `users.default_group_id`
- 创建用户自己的邀请码(8 位)
- 若有邀请人,记录 `referral_responses` + 加 `referral_codes.used_count`
- consume 验证码

### 3. `POST /user/login`

```json
{ "email": "a@b.c", "password": "pass123" }
```

响应:`{ "token": "<JWT>", "userId": 1 }`

- token 有效期 **30 天**(HS256)
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

> ⚠️ **当前 DTO 不返回 `defaultGroupId`**(遗留:doc 注 e2e 用 SQL 适配)。前端需要的话直接 DB 查 `users.default_group_id`,或后续 DTO 补字段。**不要在前端写 GET 端点查 default** —— 见 [[user-kv-integration]] §6。

### 5. `POST /user/invitation/regenerate`

响应:`{ "invitationCode": "NEWCODE99" }`

- 旧码停用(他人再拿旧码注册会失败),历史邀请关系保留

### 6. `PATCH /user/default-group`

切换默认工作空间。**必须**已是目标组成员。

请求:
```json
{ "groupId": 42 }
```

响应:
```json
{ "groupId": 42, "message": "default group updated" }
```

> **没有 GET 端点**。后端 KV 端点(`/kv/*`)都接受 `groupId` 参数 `0` 或缺失 → 自动用 caller 的 `default_group_id`,前端不需要知道具体值就能命中「个人空间」。

### 7. `POST /groups`

请求:
```json
{ "name": "project-x", "description": "main team space" }
```

响应:
```json
{
  "group": {
    "id": 42, "name": "project-x", "description": "main team space",
    "ownerId": 8, "myRole": "owner", "memberCount": 1,
    "createdAt": "...", "updatedAt": "..."
  }
}
```

### 8. `GET /groups`

响应:
```json
{ "groups": [ { "id": 42, "myRole": "owner", ... } ] }
```

### 9. `GET /groups/{id}` / `PATCH /groups/{id}` / `DELETE /groups/{id}`

- `GET`:组详情(须是成员)
- `PATCH`:`{name?, description?}`(admin+)
- `DELETE`:解散组(**owner 唯一**)。**预检**:
  - 组内有 KV → 拒绝 `组内存在 KV，请先删除或转移`
  - 其他人 default_group_id 引用本组 → 拒绝 `有用户以此组为默认工作空间，请先切换`
  - 事务内:删 `user_groups` 行(CASCADE 清 group_members/group_invitations/kv_group_access),把 owner 自己的 default_group_id 置 NULL

### 10. `GET /groups/{id}/members`

响应:
```json
{ "members": [
  { "userId": 8, "email": "a@b.com", "nickname": "alice", "role": "owner", "joinedAt": "..." }
] }
```

### 11. `PATCH /groups/{id}/members/{userId}` / `DELETE /groups/{id}/members/{userId}`

- `PATCH`:`{role: "admin|writer|reader"}`(admin+)。**owner 不能被改为非 owner**;admin 不能新增 owner(避免多个 owner)
- `DELETE`:踢人/退组(admin+;owner 不能被踢;admin 退自己需用 leave)

### 12. `POST /groups/{id}/invitations`

请求:
```json
{
  "inviteeEmail": "b@c.com",
  "role": "writer",
  "maxUses": 1,
  "ttlSeconds": 604800
}
```

- `role` 枚举 `admin|writer|reader`(**不能** 直接给 owner)
- `maxUses` 1=一次性;0=无限
- `ttlSeconds` 默认 7 天;0=永不过期

响应:含 `invitation.code`(**20 字符 hex** 短码)。

### 13. `GET /groups/{id}/invitations` / `POST /group-invitations/{id}/revoke`

- 列表只返 status=1 活跃的
- revoke:admin+;置 status=0

### 14. `POST /group-invitations/accept`

请求:
```json
{ "code": "20字符短码" }
```

响应:
```json
{ "group": { "id": 42, "myRole": "writer" }, "message": "joined" }
```

- 已是成员 → 直接返回组信息(不算消费)
- max_uses 用完 / 过期 / 撤销 → 拒绝

### 15. `POST /groups/{id}/leave`

主动退组(owner 不可退)。

---

## KV 端点(groupId 维度)

> 通用规则:
> - **`groupId` 参数:`0` 或不传 → 回退到 caller 的 `default_group_id`(个人空间)** —— 见 [[user-kv-integration]] §1
> - 不传 groupId 只能看**自己默认组**的 KV —— 他组 KV 必须显式传 groupId
> - 权限门槛:`Set/Delete → write+`;`Get/List/Versions → read+`;跨 group 边界由 `requireRead`/`requireWrite` 强制

### 16. `POST /kv` — Set

请求:
```json
{
  "key": "api_url",
  "value": "https://api.example.com",
  "ttl": 0,
  "tags": ["config", "prod"],
  "groupId": 42
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `key` | ✅ | 组内唯一 |
| `value` | ✅ | 值(字符串) |
| `ttl` | 默认 0 | 过期秒数,0=不过期 |
| `tags` | 默认 `[]` | replace 语义(空数组 = 清空);小写 / trim / 去重 |
| `groupId` | 0=default | 不传或 0 走 default_group_id;显式跨组时传 groupId |

响应:`{ "message": "kv set successfully" }`

**语义**:
- **唯一键** `(group_id, key)`(索引 `uq_kv_group_key`)—— 同组内同 key 唯一
- **owner_id = 不可变创建者**(不随写更新 —— 避免 kvshare 误授权)
- **版本快照**:覆盖前把旧 value 冻到 `kv_item_versions(version_no = max+1)`,保留最近 20 版
- **最佳实践**:OnConflict = `.OnConflict("group_id","key").Save()`

> ⚠️ **不要传 `visibility`**。已废弃。

### 17. `GET /kv/:key`

请求:`?groupId=42`(不传=默认组)

响应:
```json
{
  "key": "api_url",
  "value": "https://api.example.com",
  "expires_at": "",
  "tags": ["config", "prod"],
  "groupId": 42,
  "groupName": "project-x",
  "myRole": "writer"
}
```

权限拒绝:`code:50, message:"permission denied: need read role in group 42, current=none"`
找不到:`code:50, message:"key not found"`
无默认组:`code:50, message:"user has no default group, set default_group_id first"`

### 18. `GET /kv` — List

请求:`?groupId=42&tags=config&tags=prod&match=any&limit=100&offset=0`

| 参数 | 默认 | 说明 |
|------|------|------|
| `groupId` | default | 见通用规则 |
| `tags` | 无 | 重复参数;`?tags=a&tags=b`(GoFrame 默认 last-wins,**所以**服务端读 `r.URL.Query()["tags"]` 而不是 `req.Tags`) |
| `match` | `any` | `any` / `all` |
| `limit` | 无 | |
| `offset` | 无 | |

响应:
```json
{
  "items": [
    { "key": "...", "value": "...", "expires_at": "...",
      "tags": [...], "groupId": 42, "groupName": "project-x", "myRole": "writer" }
  ],
  "total": 7
}
```

> 列表里的每个 `items` 都有 `groupId/groupName/myRole`,**只列出该组内 KV**(不会自动跨组)。

### 19. `DELETE /kv/:key`

请求:`?groupId=42`
权限:`write+`(owner|admin|writer)

### 20. `POST /kv/:key/duplicate` — 跨组复制

请求:
```json
{ "sourceGroupId": 42, "targetGroupId": 43 }
```

权限:源组 `read+` + 目标组 `write+`

响应:
```json
{ "newKey": "api_url", "targetGroupId": 43 }
```

- 目标 key 冲突自动加 `_copy` 后缀(**单次**,再次 duplicate 会覆盖 `_copy`)
- 复制后两版本**完全独立** —— 后续改副本不影响原组

### 21. `GET /kv/tags` — tag 频次

> ✅ **2026-08-05 已改 group 维度**:facet 统计组内**所有成员**的 tag(caller 只需是该组成员 read+,即可看到组内全部 tag)。

请求:`?groupId=42`(0 = caller 的 default_group_id)

- 权限:`read+`(非成员 → 403)
- 响应形如 `{ "tags": [{ "tag": "prod", "count": 3 }, ...] }`,按 count desc, tag asc

### 22. `GET /kv/:key/versions`

请求:`?groupId=42`
响应只回 `version_no / value_len / replaced_at`(**不**回 value 全文,避免大 value 撑爆响应)

### 23. `POST /kv/:key/restore`

请求:
```json
{ "version": 5, "groupId": 42 }
```

权限:`write+`
回滚本质是 `Set`,会**快照当前值** + 写 set 审计 + 写 restore 审计(**两条审计**,有意)

---

## 错误码表

| 场景 | code | message 示例 |
|------|------|---------------|
| 业务/权限 | 50 | `permission denied: need write role in group 42, current=reader` / `key not found` |
| 参数校验 | 51 | `InvalidRules: ...` |
| 未登录 | 401 | `unauthorized` |
| JWT 无效/过期 | 401 | `unauthorized: invalid token` |
| 邮箱密码错 | 50 | `邮箱或密码错误` |
| 验证码错 | 50 | `验证码无效或已过期` |
| 邀请码无效 | 50 | `invitation code not found` |
| 邀请被撤 | 50 | `invitation revoked` |
| 邀请用完 | 50 | `invitation used up` |
| 邀请过期 | 50 | `invitation expired` |
| 重复组 key 写入 | 50 | (由 `OnConflict.Save()` upsert 走通) |
| 踢 owner | 50 | `cannot remove owner` |
| 改 owner 角色 | 50 | `cannot demote owner; transfer ownership first` |
| owner 退组 | 50 | `owner cannot leave; dissolve or transfer ownership first` |
| 解散有 KV 的组 | 50 | `组内存在 KV，请先删除或转移后再解散组` |
| 无默认组 | 50 | `user has no default group, set default_group_id first` |

## 典型对接流程

```
1. POST /user/send-code              → 收邮件填验证码
2. POST /user/register               → { userId }(自动建个人空间 + 默认邀请码)
3. POST /user/login                  → { token, userId }
4. 持久化 token 到 localStorage
5. 所有请求带 Authorization: Bearer <token>
6. GET /user/info 拿自己的 invitationCode, 分享给朋友注册
7. KV: 不传 groupId → 命中个人空间;跨组显式传 groupId
8. 切默认组: PATCH /user/default-group(后端所有 KV 端点自动走新默认)
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

### 不要为 defaultGroupId 加 GET 端点

```ts
// ❌ 错:前端解析 default groupId
const { groupId } = await userV1Service.getDefaultGroup();
const item = await kvV1Service.get({ key: 'shortcuts', groupId });

// ✅ 对:不传 groupId,后端自己解析
const item = await kvV1Service.get({ key: 'shortcuts' });
// 后端用 caller 的 default_group_id
```

### tags 重复参数

```ts
// 后端读的是 r.URL.Query()["tags"](GoFrame gstr.Parse 丢重复 key)
// → 前端用 URLSearchParams.append() 而不是 .set()
const qs = new URLSearchParams();
qs.append('tags', 'prod');
qs.append('tags', 'cache');
// ?tags=prod&tags=cache
```

### 不要在 load effect 里只看 token

```ts
// ❌ 错:init 期间 token 已设但 jwtUser 还在拉,/api/v1/kv 调一次就死
const store = auth.token ? cloudStore : lsStore;
useEffect(() => { /* load */ }, [auth.token, ...]);

// ✅ 对:等 jwtAuthState === 'logged-in'
const store = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
useEffect(() => { /* load */ }, [auth.token, auth.jwtAuthState, ...]);
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
| 邀请 / 共享 | ✅ referral_codes + group invitations | ❌ 无 |
| 跨设备 | ✅ JWT + 邮箱 | ✅ 输密码 |
| 多组隔离 | ✅ group_id + RBAC | ❌ 单用户 |
| 适合场景 | 公开 SaaS,中等隐私,多组协作 | 私密 vault,强加密 |

**user/kv 不替代 e2ekv**:它给的是"便利 + 找回密码 + 多组协作",代价是"服务端能看"。对真正私密的数据(如密码 vault),仍应走 e2ekv 或同类零知识方案。
