---
ref: api-reference
parent: user-kv-integration
---

# ref2 — 接口参考(kv/v1 + file/v1)

> **纯接口契约**:路径 / 方法 / 鉴权 / 请求字段 / 响应字段 / 错误码。分两大域:
>
> - **字符串域(kv/v1)**:`kv_items` 表,value 是**字符串**,按 group 归属 + RBAC。共 8 个端点。
> - **文件域(file/v1)**:`files` / `file_tags` / `file_shares` / `file_access_logs` 表,value 是**文件本体**(磁盘),图床 / 工作空间文件 + 分享。共 12 个端点(2026-08-08 新增)。
>
> 登录注册 / JWT 见 [[auth-jwt]];「我这种组件该用哪几个接口」见 [[usage-scope]];groupId 契约两者完全一致。

> **2026-08-04 模型迁移**:旧的 `kv_items.visibility (private/public)` 已废弃。所有 KV 现在归属 `kv_items.group_id` (FK → `user_groups`),权限由 `group_members.role` 决定。**不要传 `visibility` / `?ownerId=`** —— 那是历史残留。

---

## 通用规则(两域适用)

### 响应信封

```json
{ "code": 0, "message": "OK", "data": { ... } }
```

| code | 含义 | HTTP 状态 |
|---|---|---|
| 0 | 成功 | 200 |
| 50 | 业务错误(message 含原因) | 200 |
| 51 | 参数校验错误(message 含哪个字段) | 200 |
| 52 | 数据库约束冲突(unique violation) | 200 |
| 401 | 未登录 / 凭证无效 | 401 |

> ⚠️ **业务错误(code=50/51/52)HTTP 状态都是 200**,判断成败看 `body.code`,不是 HTTP 状态。
> 文件下载(`GET /files/:fileId` / `GET /files/share/:code`)走 200 / 206 HTTP 状态码,**不**进信封(直接出图)。

### groupId 契约(最重要)

**`groupId` 参数 `0` 或不传 → 后端自动用 caller 的 `default_group_id`(个人空间)解析**。

```ts
// ❌ 错:前端解析 default groupId 再发请求
const defaultGid = await userV1Service.getDefaultGroup(); // 这个端点根本不该存在
const groups = await userSpaceStore.listKvs(defaultGid, { ... });

// ✅ 对:不传 groupId,后端自己解析
const groups = await userSpaceStore.listKvs(0, { ... });
// 后端把 0 / 缺失都当 "use caller's default_group_id"
```

这条契约只服务于「caller 的个人空间」场景。**跨组访问必须显式传 groupId**(`?groupId=42`),且 caller 在该组必须有 read+ / write+ 角色。

### 权限门槛(后端自动检查)

| 操作 | 要求 |
|---|---|
| Set / Delete / Restore / Duplicate dst / Upload / Patch / CreateShare | caller 在该组 `write+`(owner / admin / writer) |
| Get / List / Tags / Versions / Info / ListShares | caller 是任意成员(含 reader)(`read+`) |
| Delete file / Delete group | **仅 owner / admin** |

### tags 多值参数(字符串域坑)

GoFrame 默认 `gstr.Parse` 对 `?tags=a&tags=b` **取最后一个**(last-wins)。两个选择:
- 服务端已读 `r.URL.Query()["tags"]` 显式取多值(kv List 与 file List 都做了)
- 客户端仍建议**显式多值**:`URLSearchParams.append()` 而不是 `.set()`

```ts
const qs = new URLSearchParams();
qs.append('tags', 'prod');
qs.append('tags', 'cache');
// ?tags=prod&tags=cache
```

---

# 域 A:字符串 KV(kv/v1) — 8 个端点

> 全在 `/api/v1` 前缀下,除下载外全 MustAuth。

## A1. `POST /kv` — Set

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
|---|---|---|
| `key` | ✅ | 组内唯一(索引 `uq_kv_group_key`) |
| `value` | ✅ | 值(字符串) |
| `ttl` | 默认 0 | 过期秒数,0=不过期 |
| `tags` | 默认 `[]` | replace 语义(空数组 = 清空);小写 / trim / 去重 |
| `groupId` | 0=default | 不传或 0 走 default_group_id;显式跨组时传 groupId |

响应:`{ "message": "kv set successfully" }`

**语义**:
- 同组内同 key 唯一(`OnConflict("group_id","key").Save()` 最佳实践)
- **owner_id = 不可变创建者**(不随写更新 —— 避免 kvshare 误授权)
- **版本快照**:覆盖前把旧 value 冻到 `kv_item_versions(version_no = max+1)`,保留最近 20 版

## A2. `GET /kv/:key` — Get

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

## A3. `GET /kv` — List

请求:`?groupId=42&tags=config&tags=prod&match=any&limit=100&offset=0`

| 参数 | 默认 | 说明 |
|---|---|---|
| `groupId` | default | 见通用规则 |
| `tags` | 无 | 重复参数(见「tags 多值」) |
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

## A4. `DELETE /kv/:key` — Delete

请求:`?groupId=42`
权限:`write+`(owner | admin | writer)

## A5. `POST /kv/:key/duplicate` — 跨组复制

请求:
```json
{ "sourceGroupId": 42, "targetGroupId": 43 }
```

权限:源组 `read+` + 目标组 `write+`

响应:
```json
{ "newKey": "api_url", "targetGroupId": 43 }
```

- 目标 key 冲突自动加 `_copy` 后缀(**层叠**:重复 duplicate 会得到 `xxx_copy_copy`,不是覆盖)
- 复制后两版本**完全独立** —— 后续改副本不影响原组

## A6. `GET /kv/tags` — tag 频次

> ✅ **2026-08-05 已改 group 维度**:facet 统计组内**所有成员**的 tag(caller 只需是该组成员 read+,即可看到组内全部 tag)。

请求:`?groupId=42`(0 = caller 的 default_group_id)

- 权限:`read+`(非成员 → 403)
- 响应形如 `{ "tags": [{ "tag": "prod", "count": 3 }, ...] }`,按 count desc, tag asc

## A7. `GET /kv/:key/versions`

请求:`?groupId=42`
响应只回 `version_no / value_len / replaced_at`(**不**回 value 全文,避免大 value 撑爆响应)

## A8. `POST /kv/:key/restore`

请求:
```json
{ "version": 5, "groupId": 42 }
```

权限:`write+`
回滚本质是 `Set`,会**快照当前值** + 写 set 审计 + 写 restore 审计(**两条审计**,有意)

---

# 域 B:文件(file/v1) — 12 个端点

> 图床 / 工作空间文件。10 个管理端点(MustAuth,前缀 `/api/v1`)+ 2 个公开出图路由(`/files/...`,**不**挂 `/api/v1`,走 `middleware.FileAccess`)。
>
> **数据模型**:
> - `files`:`UNIQUE(group_id, file_id) WHERE is_deleted=FALSE`(同组内 file_id 唯一,删除后可复用);`uploader_id` **仅审计不参与权限**
> - `file_tags`:每文件多 tag,PK(file_id, tag)
> - `file_shares`:`code` 10-hex UNIQUE,`status` 是 **SMALLINT**(1=active / 0=revoked)—— 与 `files.status` VARCHAR(16) **不同类型别混**
> - `file_access_logs`:出图流水(result ∈ OK / DENIED / NOT_FOUND / EXPIRED),匿名 viewer 存 NULL

## B1. `POST /files` — Upload(multipart)

请求:`multipart/form-data`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `file` | binary | 是 | — | 文件本体(multipart 字段名 = `file`) |
| `accessLevel` | string | 否 | `public` | `public` / `private` / `protected` |
| `expireSeconds` | int64 | 否 | `0` | 0=永不过期 |
| `tags` | []string | 否 | `[]` | 传 `tags[]=test&tags[]=blog` 多值最稳(CSV `"test,blog"` 服务端也会拆,见 controller) |
| `groupId` | int64 | 否 | `0` | 0=落 caller 的 default_group_id |

权限:`write+`

响应:
```json
{
  "fileId": "1dda8ad322522d987626a13bd251196e",
  "url": "http://localhost:8080/files/1dda8ad322522d987626a13bd251196e",
  "accessLevel": "public",
  "expireAt": "",
  "size": 21,
  "contentType": "image/jpeg",
  "groupId": 174,
  "groupName": "verify",
  "myRole": "owner",
  "tags": ["test", "blog"],
  "md5": "2b7061108c5b...",
  "sha256": "2fcb462c..."
}
```

- 流式计算 md5/sha256;同 group 内同 md5 命中 → 复用旧记录,**不重复落盘**

## B2. `GET /files/:fileId` — Download(公开 + Range)

> ⚠️ **公开路由**(`/files/...` 前缀,不挂 `/api/v1`)。由 `middleware.FileAccess` 处理。

权限判定:
- `access_level=public` → 匿名直出图
- `access_level=private` → 登录用户组成员 **OR** `?share=<valid_code>` 出图
- `access_level=protected` → 登录用户组成员出图
- 软删 / 过期 → 404(+ 写 file_access_logs)

支持:
- `Range: bytes=0-1023` → **206 Partial Content**
- `If-Range: "<md5>"` 校验;`Last-Modified` / `If-Modified-Since` 协商缓存
- 响应 header:`Content-Type` / `ETag` / `Cache-Control: public, max-age=3600` / `Accept-Ranges: bytes`

```bash
curl -sI $BASE/files/$FILE_ID                      # 完整 GET(匿名,公开图)
curl -H "Range: bytes=0-99" -s $BASE/files/$FILE_ID -o /tmp/part
curl -s $BASE/files/$FILE_ID?share=abc123 -o /tmp/file   # 私图 + share 码
```

## B3. `GET /files/:fileId/info` — 元数据

权限:caller 需在文件所属 group **可读**(4 档任意成员)。

请求:`?groupId=0`(0=caller default group)

响应 = `FileInfoRes`:
```json
{
  "fileId": "...", "url": "http://.../files/...", "accessLevel": "private",
  "expireAt": "", "size": 21, "contentType": "image/jpeg",
  "groupId": 42, "groupName": "project-x", "myRole": "writer",
  "tags": ["test", "blog"], "md5": "...", "sha256": "...",
  "createdAt": "2026-08-08T16:30:54+08:00"
}
```

> 时间字段已修复为真实 RFC3339(controller 用 `.Time.Format("2006-01-02T15:04:05Z07:00")`),**可以安全解析**。

## B4. `PATCH /files/:fileId` — 改元数据

请求(所有字段可选,pointer 字段,nil=不修改):
```json
{
  "accessLevel": "private",
  "tags": ["x", "y"],
  "expireSeconds": 86400,
  "category": "blog"
}
```

- `accessLevel` 枚举 `public|private|protected`
- `expireSeconds <= 0` 视为清除 expire_at(置 NULL)
- `tags` 全量替换(先删旧 tag 再插新 tag)

权限:`write+`
响应:`{ "file": FileInfoRes }`

## B5. `DELETE /files/:fileId` — 软删

请求:`?groupId=0`

权限:**仅 owner / admin**(writer/reader 拒绝 403 `permission denied`)

副作用:
- `files.is_deleted=TRUE`, `status='deleted'`, `deleted_at=now()`, `deleted_by=<uid>`
- `file_shares` / `file_access_logs` ON DELETE CASCADE 自动清
- 文件本体**不立即删除**(YAGNI)

## B6. `GET /files` — List

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `groupId` | int64 | 0 | 0=默认组 |
| `tags` | []string | [] | 重复多值;建议 `?tags[]=a&tags[]=b` |
| `match` | string | `any` | `any` / `all`(全部命中) |
| `key` | string | "" | 按 `original_name` LIKE 模糊(已 `ESCAPE '\'` 转义) |
| `accessLevel` | string | "" | 精确过滤 |
| `limit` | int | 100 | |
| `offset` | int | 0 | |

响应:
```json
{ "code": 0, "data": { "items": [FileInfoRes, ...], "total": 7 } }
```

## B7. `GET /files/tags` — tag facet

请求:`?groupId=0`
权限:`read+`(非成员 → 403)

响应:
```json
{ "code": 0, "data": { "tags": [ { "tag": "blog", "count": 12 }, { "tag": "test", "count": 5 } ] } }
```
按 count desc, tag asc 排序。

## B8. `POST /files/:fileId/duplicate` — 硬复制

请求:
```json
{ "sourceGroupId": 42, "targetGroupId": 43 }
```

权限:src group `read+` + target group `write+`

- 同 group 也走同一路径(仍生成新 fileId)
- 跨 group 时文件本体复制到 target storage(新 fileId 写盘)

响应:
```json
{ "code": 0, "data": { "fileId": "新 fileId", "targetGroupId": 43, "url": "http://.../files/新 fileId" } }
```

## B9. `POST /files/share` — 创建分享

请求:
```json
{ "fileId": "...", "maxUses": 5, "ttl": 86400, "groupId": 0 }
```

- `maxUses` 0=无限;`ttl` 单位秒,0=永不过期
- 权限:源组 `write+`

响应:
```json
{ "code": 0, "data": {
  "code": "b20eb03e4f",
  "fileId": "原 fileId",
  "maxUses": 5,
  "usedCount": 0,
  "expiresAt": "2026-08-09T16:30:54+08:00",
  "createdAt": "2026-08-08T16:30:54+08:00",
  "accessUrl": "http://.../files/<fileId>?share=b20eb03e4f"
} }
```

## B10. `GET /files/shares` — 列我创建的分享

请求:`?groupId=0&limit=100&offset=0`
只列**当前 caller 创建**的 share(`creator_id == uid`)。

响应:
```json
{ "code": 0, "data": {
  "items": [
    { "code": "...", "fileId": "...", "maxUses": 5, "usedCount": 1,
      "remaining": 4, "expiresAt": "...", "status": 1, "createdAt": "...",
      "accessUrl": "http://.../files/<fileId>?share=..." }
  ],
  "total": 7
} }
```
`remaining` = `-1` 表示 unlimited。

## B11. `DELETE /files/share/:code` — 撤销

权限:**仅 `creator_id == caller`**(其他人 → 403)
副作用:`status=0`(已撤销 share 立即失效,访问 → 404 + 流水 NOT_FOUND)。

## B12. `GET /files/share/:code` — 公开出图

> ⚠️ **公开路由**(`/files/...` 前缀),由 middleware.FileAccess 处理。

无需 JWT。校验 share 有效(status=1 + 未过期 + 未超 max_uses)→ 出图 + 计数 +1。
失败:share 不存在 / 已撤销 / 已过期 / 已用完 → 404 `share invalid`(**对外统一 404**,细节进 file_access_logs)。

> **路由注册顺序敏感**:`/files/share/:code` 必须**先于** `/files/:fileId` 注册,否则 share 子路径会被 `:fileId` 通配吞掉(后端 cmd.go 已处理)。

---

# 错误码表(完整)

| 场景 | code | HTTP | message 示例 |
|---|---|---|---|
| 业务/权限 | 50 | 200 | `permission denied: need write role in group 42, current=reader` / `key not found` |
| 参数校验 | 51 | 200 | `InvalidRules: ...` |
| 未登录 | 401 | 401 | `unauthorized` |
| JWT 无效/过期 | 401 | 401 | `unauthorized: invalid token` |
| 文件不存在 / 软删 | 404 | 404 | `file not found` |
| 文件过期 | 404 | 404 | `file expired` |
| 文件大小超限 | 413 | 413 | `file too large` |
| 文件类型不在白名单 | 415 | 415 | `unsupported media type` |
| share 无效 / 过期 / 用完 | 404 | 404 | `share invalid` |
| duplicate 跨组 dst 无写权 | 50 | 200 | `permission denied` |
| delete file 非 owner/admin | 50 | 200 | `permission denied` |
| 重复组 key 写入 | 52 | 200 | duplicate key(已由 OnConflict upsert 走通) |
| 无默认组 | 50 | 200 | `user has no default group, set default_group_id first` |

---

# 反直觉点(接口层)

### 业务错误 HTTP 是 200

见「响应信封」——判断成败**永远看 `body.code`**。

### 不要传 visibility

`visibility (private/public)` 已废弃,传了也是历史残留字段。权限由 `access_level`(file)或 group RBAC(kv)决定。

### tags 必须显式多值

见「通用规则 §tags 多值参数」。

### duplicate 的 `_copy` 是层叠的

kv duplicate:目标 key 冲突加 `_copy`;**再次 duplicate 会得到 `_copy_copy`**,不是覆盖。需要幂等请在客户端先查目标 key 再决定。

### upsert 撞唯一约束要 DELETE+POST 兜底

后端 `Set` 用 `OnConflict().Insert()` 期望 upsert,**实际**撞 `uq_kv_group_key` 唯一约束 → PG 23505 → `{code: 52, message: "duplicate key value ..."}`。

```ts
let r = await kv.set(payload);
if (!r.ok && isDuplicateKeyError(r.error)) {
  await kv.delete({ key: BLOB_KEY });  // 后端 upsert 没生效 → 手动删
  r = await kv.set(payload);            // 再 POST
}
```

判据:`code === 52` OR message 含 `duplicate key value` OR `23505`。
