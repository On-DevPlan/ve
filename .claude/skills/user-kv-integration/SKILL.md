---
name: user-kv-integration
description: Use when integrating a frontend component with the user/kv + user/groups API at /api/v1 (email + JWT + group-owned key-value store). Triggers on building email login flows, JWT-bearer storage, single-blob cloud sync with offline LS fallback, sync mode toggles (auto/manual), dirty-state tracking, group/RBAC-aware KV reads, or backend default-group resolution.
---

# user-kv-integration

把前端组件接到 **user/kv + user/groups API**(`/api/v1`)的标准化模式。基于 dev_ctr_hello 的 user + kv 模块。覆盖邮箱登录、邮箱 + JWT 身份、组维度 RBAC、单 key 云端同步、离线降级、同步模式 + 脏状态、就地二次确认等可复用模式。

> **本文档不**讲 user/kv 协议本身(那是后端 skill),只讲**前端怎么接**。协议字段见 `references/protocol.md`。

## 何时使用

- 给某个组件加"用户登录 + 数据云端同步"能力
- 单 key 存储整个组件的 JSON 配置/数据(整库 blob)
- 想知道"tag 应该起什么名"以及"组维度怎么走"
- 看到后端返回 `code: 50` 的「no default group」/「permission denied」 → 用本 skill 知道如何在前端兜底
- 看到后端返回 `code: 52 / duplicate key value violates unique constraint` 23505 → 见「已知坑」一节
- **线上 405 Not Allowed(本地正常)** → 见 [[deployment]],这是路由问题不是代码问题

## 何时**不**使用

- 数据需要**跨用户共享**(用单独的 `kv_shares` 短码通道,见 dev_ctr_hello skill [[kv-share]])—— 本 skill 默认假设单用户私密
- 需要**强实时同步**(webrtc / websocket / SSE)—— 本 skill 是 HTTP 轮询 + debounce
- 服务端支持真正的 version-based upsert(本 skill 教你怎么用 versions/restore 端点,见 KV §6.7-6.8)
- 想要"per-item 粒度"(多 key + listByTag)—— 见「不要走 per-item」一节

## 关键后端契约(2026-08-04 模型迁移后)

> ⚠️ **2026-08-04 起的迁移**:旧的 `visibility (private/public)` 已废弃。所有 KV 现在归属 `kv_items.group_id`(FK → `user_groups`),权限由 `group_members.role` 决定。任何看到 `visibility` / `ownerId` 字段的代码 / 文档 / 接口都是历史遗留,应忽略。

**最重要的契约**(前端必须知道的):**groupId 参数 `0` 或不传 → 后端自动用 caller 的 `default_group_id` (个人空间) 解析**。这意味着:

```ts
// ❌ 错:前端解析 default groupId 再发请求
const defaultGid = await userV1Service.getDefaultGroup(); // 这个端点根本不该存在
const groups = await userSpaceStore.listKvs(defaultGid, { ... });

// ✅ 对:不传 groupId,后端自己解析
const groups = await userSpaceStore.listKvs(0, { ... });
// 后端把 0 / 缺失都当 "use caller's default_group_id"
```

这条契约只服务于"caller 的个人空间"场景。**跨组访问必须显式传 groupId**(`?groupId=42`),且 caller 在该组必须有 read+ / write+ 角色。

权限门槛(后端自动检查,前端不需要再校验):
- **Set/Delete** → caller 在该组必须是 `owner|admin|writer`(`write+`)
- **Get/List/Versions** → caller 是任意成员(含 `reader`)(`read+`)

## 架构速查

```text
┌─────────────────────────────────────────────────┐
│  Frontend Component                              │
│  ┌─────────────────┐  ┌──────────────────┐    │
│  │  useShortcuts    │  │   useAuth(...)    │    │
│  │  数据 CRUD + state│  │ login/register   │    │
│  └────────┬─────────┘  └────────┬─────────┘    │
│           │ debounce 200ms       │ JWT in LS   │
│  ┌────────▼──────────────────────▼─────────┐    │
│  │  ShortcutStore (LS + UserSpace.delegating) │
│  │  load() / save() / importGroups()         │    │
│  │  + saveMode (auto/manual) + dirty         │    │
│  └────────┬─────────────────────────────────┘    │
│           │ userSpace.getShortcuts() / setShortcuts()
│           │ 不传 groupId,后端走 default
└───────────┼─────────────────────────────────────┘
            │ fetch('/api/v1/kv/{key}')         ← 相对路径,同源不跨域
            │
      ┌─────┴──────┐
      │            │
   dev│            │prod
      ▼            ▼
 Vite 中间件    nginx location
 (apiGateway()  (gen-nginx.ts
  from           构建期生成)
 registry.ts)
      │            │
      ▼            ▼
 :8080 (本机)   :8988 (生产后端)

  两端读同一份 apps/showcase/src/api/registry.ts —— 详见 [[deployment]]
```

## 关键设计决策(从前端工程经验总结)

### 1. 持久化分层:游客降级 + 登录升级

```
未登录游客 → 改本地 → LSStore 写 localStorage
登录后 → 改本地 → UserSpace.setShortcuts() 写 /api/v1/kv
```

`useShortcuts` 内部同时持 `LSStore` + `cloudStore`,根据 JWT 态切换 activeStore。token 切换时 effect 自动重 load:
- 首次访问**不需要登录**就能用(本地缓存)
- 登录后**无缝接管**,数据 push 到云端
- 登出回游客模式,LS 仍可用

### 2. 单 key 策略 + key = tag 命名

把整个组件状态 JSON 序列化,放**一个固定 key**。**key 与 tag 同名**:
```
POST /api/v1/kv
{
  key: "shortcut-library",   ← 与 tag 同名
  value: JSON.stringify(groups[]),
  tags: ["shortcut-library"],
  ttl: 0
  // groupId 不传 → 后端用 default
}
```

**为什么 key 与 tag 同名**:
- API 路径 `/api/v1/kv/shortcut-library` 自解释,看就知道属于哪个组件
- `listByTag('shortcut-library')` 扫出来一眼能对到本组件
- 旧版本迁移:扫 tag 列表时所有匹配 key 都能识别

**为什么单 blob 而不是 per-item**:
- 改动最小,K/V 原生契合
- 整库改一条也只重传 KB 级数据
- 端点契约只有 `set/get/delete/list`,不暴露内部结构

**代价**:服务端能看明文(零知识要求 → 别用 user/kv)。

### 3. 不要走 per-item(踩过的坑)

早期版本把每个 group / shortcut 拆成 `sl-group-<id>` / `sl-shortcut-<id>` 多个 KV key:
- 198 条数据 → list 端点要分页
- 单条更新要 read-modify-write 串行化(并发 op 互相覆盖)
- 旧版本迁移链路:list + 按 order 重组 + DELETE 旧行 + 写 blob
- 与单 blob 相比没有任何收益,只有复杂度

**当前统一是单 blob**。如果将来有"组件按资源分粒度"的真实需求,再考虑回归 per-item。

### 4. jwtAuthState init race(关键反直觉点)

`main.ts` 里 `void jwtAuth.init()` 是 fire-and-forget。存在一个"token 落 ref 已设但 `jwtUser` 还在拉 /user/info"的中间态。`useJwtAuth()` 第一次返回的快照里:

```ts
{
  token: 'jwt-abc',              // ← 已设置(从 LS 读出来的)
  jwtUser: null,                 // ← 还没拿到(/user/info 还在 await)
  jwtAuthState: 'logged-out',    // ← 还是初始值
}
```

如果只 watch `auth.token`,**会选 cloudStore** → 调 `userSpace.getShortcuts()` → `requireAuth()` 抛 "not logged in" → 页面空白 + **不会再重试**(jwtUser 后续到位没有 trigger)。

**正确**:**同时 watch `auth.token` 和 `auth.jwtAuthState === 'logged-in'`**:

```ts
const store = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
useEffect(() => { /* load */ }, [auth.token, auth.jwtAuthState, ...]);
```

init 完成后态变 `logged-in` → effect 重跑 → 真正发请求。`user-space` 的 `useUserSpaceStore` 用的是 `auth.jwtAuthState !== 'logged-in' || !auth.token`,效果相同 —— 两边契约一致。

### 5. 旧版本懒迁移(self-heal on first read)

如果 `getShortcuts()` 拿 `'shortcut-library'` blob 返回 404(典型:用户从老版本升级上来,后端还有 198 个 `sl-group-*` / `sl-shortcut-*` 行),不要直接返回 []。**自愈读**流程:

```
1) GET /api/v1/kv/shortcut-library
   → 404 (code 50)
2) GET /api/v1/kv?tags=shortcut-library&limit=200  (分页扫完)
   → 命中旧 per-item 行
3) consolidateLegacy(groups, shortcuts) → 还原 groups[] 形状
4) POST /api/v1/kv 写 'shortcut-library' blob
5) best-effort DELETE 每个 sl-group-* / sl-shortcut-* (失败不阻塞)
6) return 合并后的 groups[]
```

关键:写/删失败都吞掉,本次读依然返回数据。这样一次读路径就把用户的旧数据迁移好,**不需要后端写迁移脚本**。

注意:**不要为「旧 key 是 'shortcuts'」(单数)这种再之前的版本写迁移**。如果你的组件经历过多次 schema 变更,只迁移最近一次(per-item `sl-*` 形态),更老的用户数据需要手动重置。

### 6. 不解析 defaultGroupId,让后端来

详见「关键后端契约」。**不要写 `getDefaultGroup` 端点**:
- 端点信息多余 —— 后端 KV 端点已经处理 default
- 多一个 round-trip
- 多一份测试 / 维护成本
- 多一个让用户困惑的 API

如果 UI 需要"我自己的默认组是哪个"(比如显示「默认」徽章),用 `listGroups()` 然后看哪些是 `isDefault`(后端标记)。**这才是 user-space 多组管理 UI 的事,不是 per-user 数据组件的事**。

### 7. 同步状态精细化

`authState`(logged-out / syncing / error)**不够**—— save 期间短暂 syncing 会被误判为登出。

正确做法:**三态独立**:
- `userId > 0` → 登录判断(同步中不变)
- `syncState: 'idle' | 'syncing' | 'error'` → 同步状态
- `lastSyncAt: number` → UI 实时显示"5 秒前同步"
- `lastSyncError: string | null` → 显示失败原因

UI 判断"是否登录"用 `userId`,显示同步状态用 `syncState` + `lastSyncAt`。

### 8. 同步模式: auto / manual + dirty

| 模式 | 行为 | UI 提示 |
|---|---|---|
| auto | 改本地 → 立即 sync(200ms debounce) | sync pill 显示"刚刚同步" |
| manual | 改本地 → 仅标 dirty | dirty 时 modal 显示"保存到云端"按钮 |

切换 manual→auto 时如果 dirty,**立即 flush**(避免切完才发现数据没传)。

### 9. 后端 upsert bug 前端 workaround

后端 `internal/service/kv` 的 `Set` 用 `OnConflict().Insert()` 期望 upsert,**实际**撞 `uq_kv_group_key` 唯一约束 → PG 23505 → `{code: 52, message: "duplicate key value ..."}`。

**前端兜底**:

```ts
let r = await kv.set(payload);
if (!r.ok && isDuplicateKeyError(r.error)) {
  await kv.delete({ key: BLOB_KEY });  // 后端 upsert 没生效 → 手动删
  r = await kv.set(payload);            // 再 POST
}
```

判据:`code === 52` OR message 含 `duplicate key value` OR `23505`。

> 这一节历史性。`shortcut-library` 当前用单 blob,set 同一 key 不会撞(本来就覆盖)。但如果将来有 per-item 写入,**记得加这个兜底**。

### 10. 401 不自动 logout(关键反直觉点)

**默认行为**(原 e2ekv)是 401 → 自动清 creds + 跳游客模式。
**问题**:save 中途遇 401(后端 jwt 中间件 bug)→ 用户**莫名其妙被退出**,sync pill 状态混乱。

**正确**:`_doSave` 和 `load` 遇 401 → 设 `_authState = 'error'` + 抛错,**保留 creds**。让用户从 sync pill 看到红点 + 错误消息,**自己决定重登或重试**。

**唯一例外**:`init()` 启动时的 401(无操作可丢)→ 自动 logout。

### 11. 退出确认只在 manual + dirty

banner 退出按钮的逻辑:
```ts
if (saveMode === 'manual' && dirty && warnOnDirtyExit) {
  const save = window.confirm('先保存 vs 直接退出?');
  // ...
}
```

**不要在 useShortcuts 的 activeStore 切换 effect 里再弹窗** — 双重弹窗。

### 12. 删除就地二次确认(× → ? → 删除)

`window.confirm()` 太重(浏览器原生 modal,体验断裂)。改成本地 state:
```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState(null);
// × → ?(变红 + 脉冲)→ 再点 → 真删
<button onClick={confirmDeleteId === id ? () => onDelete(id) : () => setConfirmDeleteId(id)}>
  {confirmDeleteId === id ? '?' : '×'}
</button>
// 失焦自动取消,避免"?"跨分组残留
onBlur={() => confirmDeleteId === id && setConfirmDeleteId(null)}
```

## 已知坑

| 坑 | 症状 | 修复 |
|---|---|---|
| HKDF salt 非空导致跨客户端不互通 | 加密互通失败 | WebCrypto `new Uint8Array()`(零长) |
| 200 OK 但 code: 51 参数错误 | 业务错误 HTTP 200 | 判断看 body.code,不只看 HTTP |
| save 401 自动 logout | sync pill 状态错乱 | 401 不 logout,设 error + 抛 |
| 后端 upsert 失败 (23505) | 第二次 POST 必失败 | DELETE + POST 兜底 |
| 同步 pill authState 误判 | sync 期间被切游客 | 用 `userId > 0` 判断登录 |
| 双重 confirm 弹窗 | 退出按钮 + effect 各弹一次 | 只在按钮 onClick 弹 |
| `credentials: 'omit'` 失败 | cookie 不带 | fetch 默认就是 omit,别手动加 |
| 401 后 JWT 残留 LS | 下次启动又拿坏 token 试 | logout 时清 LS token |
| 线上 405,本地正常 | dev 代理是 vite 中间件,prod 没有 | nginx 加 `/api` 反代,见 [[deployment]] |
| 改 baseUrl 直连后端端口 | 405 变 CORS 错误 | 后端通常无 CORS 中间件;走同源反代 |
| **jwtAuthState 没 watch** | 页面打开后空白,不调 API | effect dep 包含 `auth.jwtAuthState === 'logged-in'`,不只是 `auth.token` |
| **前端解析 default groupId** | 多打一次 /user/default-group,逻辑重复 | 不传 groupId,后端走 default |
| **per-item KV** | listByTag 要分页 + 串行化 read-modify-write | 单 blob,改一条整体重传(KB 级无影响) |
| **`/user/default-group` GET 端点** | 端点多余,后端 KV 自己解析 | **不要加这个端点**,只有 PATCH |

## 复用清单

| 现成资源 | 路径 | 怎么用 |
|---|---|---|
| 协议 + DTO 字段(visibility 已弃) | [[protocol]] | 客户端 wire 字段权威来源;**优先信任 groupId 模型** |
| 上线部署 / 405 排查 | [[deployment]] | nginx 反代、CORS、容器网络 |
| 后端 user/kv 设计 | dev_ctr_hello/.claude/skills/user-kv-invitecode/SKILL.md | 完整说明(数据库 / 路由 / 中间件 / RBAC) |
| 后端 KV 版本/审计 | dev_ctr_hello/.claude/skills/user-kv-invitecode/[[kv-versioning-audit]] | Set 前的快照 / restore / 审计表 |
| 后端 KV 多 tag | dev_ctr_hello/.claude/skills/user-kv-invitecode/[[kv-multi-tag]] | tag 过滤、facet 频次表 |
| 组件级 API 声明(dev + prod) | `apps/showcase/src/api/registry.ts` | 改 target,不动 vite.config.ts / default.conf |
| nginx 路由生成器 | `apps/showcase/src/api/gen-nginx.ts` | 从 registry 单一事实源生成 prod location |
| ShortcutStore 抽象 | `ve/packages/react-components/src/shortcut-library/src/engine/store.ts` | LSStore (本地) + user-space 委托 (云端) 都 implements |

## 验证

```bash
# 后端(dev_ctr_hello)启动
cd dev_ctr_hello && go run .        # :8080

# 前端启动
cd ve && pnpm dev                   # :5173(被占则顺延)

# 1. 游客:加几个分组,刷新页面 → 数据还在(LS)
# 2. 注册:send-code 注入法绕过邮箱(或真收邮件)
# 3. 登录 → 顶部变 sync pill
# 4. 加一组 → DevTools Network 看:
#      GET /api/v1/user/info  (init)
#      GET /api/v1/kv/shortcut-library  ← 不带 groupId
# 5. 关 tab → 新 incognito → Login 同账号 → 数据回来
# 6. 切到 manual → 加一组 → 没 POST;modal 出现"保存到云端"
```

> ⚠️ 当组件的 dev target 指向生产后端时,**这些步骤写的是生产数据**。用测试账号,别拿真实用户的 key 练手。

上线后**必须**再验证一次 —— dev 通过不代表 prod 通过(代理层是两套):

```bash
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
# → Server: GoFrame HTTP Server + {"code":51,...}  = 通了
# → Server: nginx + HTML                            = 还在 SPA fallback,见 [[deployment]]
```

## 范围外

- WebCrypto 加密(那是 e2ekv 的事,user/kv 服务端能看明文)
- 多端实时同步(webrtc / websocket)
- KV 跨用户共享 —— 走 `kv_shares` 短码通道(dev_ctr_hello [[kv-share]]),不是本 skill
- 重置密码(/user/reset-password)
- TTL 清理
- 邀请链可视化

## References

| ref | 何时读 | 路径 |
| --- | -------- | ---- |
| [[protocol]] | 客户端对接 wire 字段(请求/响应/状态码);**看 groupId 模型,不是 visibility** | references/protocol.md |
| [[deployment]] | 上线:nginx 反代 / 405 排查 / CORS / 容器网络 | references/deployment.md |

## 维护

加新字段或新场景前先问:
1. **有真实消费者吗?** 没有 → 不加
2. **走 single-blob 还是 per-resource?** 单 key 简单但服务端能看;per-key 粒度细但调用多
3. **多端冲突怎么办?** 当前总是后写覆盖;乐观锁需要后端支持 version(看 [[kv-versioning-audit]])
4. **JWT 过期时 UX?** 默认 sync pill 红点 + 重试按钮;不自动登出
5. **新组件的 key 与 tag 命名?** 必须同名,见「关键设计决策 §2」
6. **要不要加新端点?** 99% 不要。先确认后端 KV 端点用 default 解析不能直接解决,再考虑加。

改字段前:同步改 `authClient.ts` / `userKvClient.ts` / `userKvStore.ts` 三件套 + CSS sync pill 状态映射。
