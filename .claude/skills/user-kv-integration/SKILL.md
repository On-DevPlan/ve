---
name: user-kv-integration
description: Use when integrating a frontend component with the user/kv API at /api/v1 (email + JWT + owned key-value store). Triggers on building email login flows, JWT-bearer storage, single-blob cloud sync with offline LS fallback, sync mode toggles (auto/manual), dirty-state tracking, or backend upsert conflict workarounds.
---

# user-kv-integration

把前端组件接到 **user/kv API**(`/api/v1`)的标准化模式。基于 dev_ctr_hello 的 user + kv 模块。覆盖邮箱登录、单 key 云端同步、离线降级、同步模式 + 脏状态、就地二次确认等可复用模式。

> **本文档不**讲 user/kv 协议本身(那是后端 skill),只讲**前端怎么接**。协议字段见 `references/protocol.md`。

## 何时使用

- 给某个组件加"用户登录 + 数据云端同步"能力
- 单 key 存储整个组件的 JSON 配置/数据
- 想做 auto / manual 同步模式切换
- 看到后端返回 `code: 52 / duplicate key value violates unique constraint` 23505 → 用本 skill 知道如何在前端兜底

## 何时**不**使用

- 数据需要**跨用户共享**(用 `visibility: public` + `?ownerId=`)—— 本 skill 默认假设单用户私密
- 需要**强实时同步**(webrtc / websocket / SSE)—— 本 skill 是 HTTP 轮询 + debounce
- 服务端支持真正的 version-based upsert(`PUT /kv/{key}?version=N`)—— 用原生接口

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
│  │  UserKVStore (ShortcutStore impl)       │    │
│  │  load() / save() / init() / login()     │    │
│  │  + syncState + lastSyncAt + lastError   │    │
│  └────────┬─────────────────────────────────┘    │
│           │ fetch('/api/v1/kv/{key}')         │
└───────────┼─────────────────────────────────────┘
            │ Vite proxy (mfeDynamicProxy)
            ▼
   /api  →  http://localhost:8080  (dev)
```

## 三件套最小实现

| 文件 | 职责 | 行数参考 |
|---|---|---|
| `authClient.ts` | 5 个端点 wrapper:`sendCode` / `register` / `login` / `info` / `regenerateInvitation` | ~170 |
| `userKvClient.ts` | 4 个端点 wrapper:`set` / `get` / `delete` / `list`,带 `getAuthToken` 工厂参数 | ~160 |
| `userKvStore.ts` | `UserKVStore implements ShortcutStore`,JWT 存 LS,单 key BLOB,同步状态字段,DELETE+POST upsert fallback | ~280 |

加上 UI 改动(`useShortcuts.ts` 默认 store + 状态条 + Settings 面板),整套约 **700-900 行**。

## 关键设计决策

### 1. 持久化分层:游客降级 + 登录升级

```
未登录游客 → 改本地 → LSStore 写 localStorage
登录后 → 改本地 → UserKVStore 写 /api/v1/kv
```

**为什么**:`useShortcuts` 内部同时持 LSStore + UserKVStore,根据 `cloudStore.userId > 0` 切换 activeStore。这样:
- 首次访问**不需要登录**就能用(本地缓存)
- 登录后**无缝接管**,数据 push 到云端
- 登出回游客模式,LS 仍可用

### 2. 单 key 策略(plan §C)

把整个组件状态 JSON 序列化,放**一个固定 key**(如 `shortcuts`):

```
POST /api/v1/kv
{
  key: "shortcuts",
  value: JSON.stringify(groups[]),  // 明文(服务端能看!)
  visibility: "private",
  ttl: 0
}
```

**为什么**:改动最小,K/V 原生契合。代价:服务端能看明文(零知识要求 → 别用 user/kv)。改一条 → 整个 blob 重传(KB 级无影响)。

### 3. 同步状态精细化

`authState`(logged-out / syncing / error)**不够**—— save 期间短暂 syncing 会被误判为登出。

正确做法:**三态独立**:
- `userId > 0` → 登录判断(同步中不变)
- `syncState: 'idle' | 'syncing' | 'error'` → 同步状态
- `lastSyncAt: number` → UI 实时显示"5 秒前同步"
- `lastSyncError: string | null` → 显示失败原因

UI 判断"是否登录"用 `userId`,显示同步状态用 `syncState` + `lastSyncAt`。

### 4. 同步模式: auto / manual + dirty

| 模式 | 行为 | UI 提示 |
|---|---|---|
| auto | 改本地 → 立即 sync(200ms debounce) | sync pill 显示"刚刚同步" |
| manual | 改本地 → 仅标 dirty | dirty 时 modal 显示"保存到云端"按钮 |

切换 manual→auto 时如果 dirty,**立即 flush**(避免切完才发现数据没传)。

### 5. 后端 upsert bug 前端 workaround

后端 `internal/service/kv` 的 `Set` 用 `OnConflict().Insert()` 期望 upsert,**实际**撞 `uq_kv_owner_key` 唯一约束 → PG 23505 → `{code: 52, message: "duplicate key value ..."}`。

**前端兜底**:

```ts
let r = await kv.set(payload);
if (!r.ok && isDuplicateKeyError(r.error)) {
  await kv.delete({ key: BLOB_KEY });  // 后端 upsert 没生效 → 手动删
  r = await kv.set(payload);            // 再 POST
}
```

判据:`code === 52` OR message 含 `duplicate key value` OR `23505`。

### 6. 401 不自动 logout(关键反直觉点)

**默认行为**(原 e2ekv)是 401 → 自动清 creds + 跳游客模式。
**问题**:save 中途遇 401(后端 jwt 中间件 bug)→ 用户**莫名其妙被退出**,sync pill 状态混乱。

**正确**:`_doSave` 和 `load` 遇 401 → 设 `_authState = 'error'` + 抛错,**保留 creds**。让用户从 sync pill 看到红点 + 错误消息,**自己决定重登或重试**。

**唯一例外**:`init()` 启动时的 401(无操作可丢)→ 自动 logout。

### 7. 退出确认只在 manual + dirty

banner 退出按钮的逻辑:
```ts
if (saveMode === 'manual' && dirty && warnOnDirtyExit) {
  const save = window.confirm('先保存 vs 直接退出?');
  // ...
}
```

**不要在 useShortcuts 的 activeStore 切换 effect 里再弹窗** — 双重弹窗。

### 8. 删除就地二次确认(× → ? → 删除)

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

## 复用清单

| 现成资源 | 路径 | 怎么用 |
|---|---|---|
| 协议 + DTO 字段 | [[protocol]] | 客户端 wire 字段权威来源 |
| 后端 user/kv 设计 | dev_ctr_hello/.claude/skills/user-kv-invitecode/SKILL.md | 完整说明(数据库 / 路由 / 中间件) |
| 后端 kv 模块命令 | `dev_ctr_hello/internal/service/kv/` | 服务端 upsert bug 位置(目前用 workaround) |
| Vite mfeDynamicProxy | `ve/packages/manifest-generator/src/mfe-dynamic-proxy.ts` | 改 api 字段,不动 vite.config.ts |
| ShortcutStore 抽象 | `ve/packages/react-components/src/shortcut-library/store.ts` | LSStore + UserKVStore 都 implements |

## 验证

```bash
# 后端
cd dev_ctr_hello && go run .        # :8080

# 前端
cd ve && pnpm dev                    # :5173

# 1. 游客:加几个分组,刷新页面 → 数据还在(LS)
# 2. 注册:dev_ctr_hello/docs/api/e2ekv.md §附录的 send-code 注入法绕过邮箱
# 3. 登录 → 顶部变 sync pill(email + 邀请码 + ⚙)
# 4. 加一组 → DevTools Network 看 POST /api/v1/kv 带 Bearer
# 5. 关 tab → 新 incognito → Login 同账号 → 数据回来
# 6. 切到 manual → 加一组 → 没 POST;modal 出现"保存到云端"
```

## 范围外

- WebCrypto 加密(那是 e2ekv 的事,user/kv 服务端能看明文)
- 多端实时同步(webrtc / websocket)
- KV 共享(visibility=public + ownerId 读他人)
- 重置密码(/user/reset-password)
- TTL 清理
- 邀请链可视化

## References

| ref | 何时读 | 路径 |
| --- | -------- | ---- |
| [[protocol]] | 客户端对接 wire 字段(请求/响应/状态码) | references/protocol.md |
| (可加更多:如坑点 / 实现模板) | | references/ |

## 维护

加新字段或新场景前先问:
1. **有真实消费者吗?** 没有 → 不加
2. **走 single-blob 还是 per-resource?** 单 key 简单但服务端能看;per-key 粒度细但调用多
3. **多端冲突怎么办?** 当前总是后写覆盖;乐观锁需要后端支持 version
4. **JWT 过期时 UX?** 默认 sync pill 红点 + 重试按钮;不自动登出

改字段前:同步改 `authClient.ts` / `userKvClient.ts` / `userKvStore.ts` 三件套 + CSS sync pill 状态映射。