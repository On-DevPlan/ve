---
ref: usage-scope
parent: user-kv-integration
---

# ref3 — 应用限制:什么组件该用哪些 API

> 接口层契约见 [[api-reference]]。本 ref 回答:**你的组件是哪种用法**,该用哪几个接口、不该用哪几个。选错端点的后果通常不是报错,而是「数据落在你看不到的地方」或「越权」。

## 核心:两种用法模型,不要混用

| 维度 | 模型一:个人空间(user-space) | 模型二:普通组件(single-blob) |
|---|---|---|
| 典型组件 | `user-space`(概览 / 成员 / 邀请 / 库存 / 文件) | `shortcut-library`、未来的 `theme-*` 等 |
| 语义 | 用户**显式选了一个组**去管理该组的 KV/文件 | 整组件数据只属于「我自己」,跨组没意义 |
| KV 用法 | **按 group 维度管理多个 KV** | 单 key 存整库 blob |
| `groupId` 传不传 | **显式传**当前选中的 `groupId` | **不传** → 后端走 caller default_group_id |
| tags | 在组内筛选(`?tags=...`) | tags 等于 key 名,用于 facet 扫表 |
| 数据归属 | 用户看哪个组的数据,就操作哪个组 | 同账号多端共享即可 |

### 端点选择决策树

```
组件是否要「按 group 管理多个 KV / 文件」?
  ├─ 是 → 模型一(user-space):显式传 groupId,tags 可选筛
  │       例:GET /api/v1/kv?groupId=42&tags=shortcut
  │       例:POST /api/v1/files?groupId=42
  └─ 否 → 模型二(single-blob):不传 groupId,key 自解释
          例:GET /api/v1/kv/shortcut-library
          tags 等于 key 名
```

### 选错端点的症状

- 模型一走了不传 groupId → 后端给的是**个人空间**的 KV 列表,看不到用户当前组的 KV
- 模型二传了 `groupId=<我的工作空间>` → 后端校验该组是否给该组件用,正常情况直接走个人空间更安全

---

## 模型一:个人空间(user-space)组件 — 用这些 API

用户显式选了一个组,操作该组的 KV / 文件 / 成员。核心是**显式传 groupId**。

### 用(字符串域 kv)

| 接口 | 用途 | groupId |
|---|---|---|
| `POST /kv` | 在所选组新建 / 覆盖 key | ✅ 显式传 |
| `GET /kv` | 列所选组的 KV(可 tags 筛选 + 分页) | ✅ 显式传 |
| `GET /kv/:key` | 看单个 value | ✅ 显式传 |
| `DELETE /kv/:key` | 删所选组的 key | ✅ 显式传 |
| `POST /kv/:key/duplicate` | 跨组复制(`{sourceGroupId, targetGroupId}`) | ✅ 两个都显式 |
| `GET /kv/tags` | 组内 tag 频次(做筛选下拉) | ✅ 显式传 |
| `GET /kv/:key/versions` / `POST /kv/:key/restore` | 版本 / 回滚(做版本 UI 时才用) | ✅ 显式传 |

### 用(文件域 file)

| 接口 | 用途 | groupId |
|---|---|---|
| `POST /files` | 上传到所选组 | ✅ 显式传 |
| `GET /files` | 列所选组文件 | ✅ 显式传 |
| `GET /files/:fileId/info` / `PATCH` / `DELETE` | 元数据 / 改 / 软删 | ✅ 显式传 |
| `POST /files/:fileId/duplicate` | 跨组硬复制 | ✅ 两个都显式 |
| `POST /files/share` / `GET /files/shares` / `DELETE /files/share/:code` | 分享管理 | ✅ 显式传 |
| `GET /files/:fileId` / `GET /files/share/:code` | 出图(前端直接 `<img src>` 即可) | 无(公开路由) |

### 用(groups 系列 — user-space 组管理 UI)

| 接口 | 用途 |
|---|---|
| `GET /groups` | 列我的全部组(带 `myRole` / `isDefault`),做工作空间切换器 |
| `POST /groups` | 建组(自动成 owner) |
| `GET /groups/{id}` / `PATCH` / `DELETE` | 组详情 / 改名描述 / 解散(解散前需清空 KV) |
| `GET /groups/{id}/members` / `PATCH` / `DELETE` | 成员列表 / 改角色 / 踢人 |
| `POST /groups/{id}/invitations` / `GET` / `POST /group-invitations/{id}/revoke` | 邀请管理(role 只能给 admin/writer/reader,不能给 owner) |
| `POST /group-invitations/accept` | 接受邀请(20 字符短码) |
| `POST /groups/{id}/leave` | 主动退组(owner 不可退) |

### 不用

- 不传 groupId 的 kv 调用 —— 会命中个人空间而不是用户当前选的组
- `PATCH /user/default-group` 之外的「切默认组」逻辑 —— user-space 是显式选组,不依赖默认组

---

## 模型二:普通组件(single-blob)— 用这些 API

整组件状态 JSON 序列化,放**一个固定 key**。**key 与 tag 同名**。

### 用

| 接口 | 用途 |
|---|---|
| `POST /kv` | 整库 blob 写入(不传 groupId → 后端用 default) |
| `GET /kv/<key>` | 整库 blob 读取 |
| `DELETE /kv/<key>` | 清空 |
| `GET /kv/tags` 或 `GET /kv` | 仅旧版本迁移时扫表用 |

```ts
// 写:POST /api/v1/kv
{
  key: "shortcut-library",   // ← 与 tag 同名
  value: JSON.stringify(groups[]),
  tags: ["shortcut-library"],
  ttl: 0
  // groupId 不传 → 后端用 default
}
```

### 不用

- **不传 `groupId`**(传了反而越权 / 绑死某个组)
- 不碰 `groups` 系列、`duplicate`、`versions/restore`、file 域 —— 它们没有单用户语义

### 为什么单 blob(踩过的坑)

早期版本把每个 group / shortcut 拆成 `sl-group-<id>` / `sl-shortcut-<id>` 多个 KV key:
- 198 条数据 → list 端点要分页
- 单条更新要 read-modify-write 串行化(并发 op 互相覆盖)
- 旧版本迁移链路:list + 按 order 重组 + DELETE 旧行 + 写 blob
- 与单 blob 相比没有任何收益,只有复杂度

**当前统一是单 blob**。如果将来有「组件按资源分粒度」的真实需求,再考虑回归 per-item。

### key 与 tag 同名的原因

- API 路径 `/api/v1/kv/shortcut-library` 自解释,看就知道属于哪个组件
- `listByTag('shortcut-library')` 扫出来一眼能对到本组件
- 旧版本迁移:扫 tag 列表时所有匹配 key 都能识别

### 旧版本懒迁移(self-heal on first read)

如果 `getShortcuts()` 拿 `'shortcut-library'` blob 返回 404(典型:用户从老版本升级上来),**不要直接返回 []**。**自愈读**流程:

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

关键:写/删失败都吞掉,本次读依然返回数据。一次读路径就把用户旧数据迁移好,**不需要后端写迁移脚本**。

> 注意:**不要为「旧 key 是 'shortcuts'」(单数)这种再之前的版本写迁移**。只迁移最近一次(per-item `sl-*` 形态),更老的用户数据需要手动重置。

---

## 持久化分层:游客降级 + 登录升级

```
未登录游客 → 改本地 → LSStore 写 localStorage
登录后   → 改本地 → UserSpace.setShortcuts() 写 /api/v1/kv
```

`useShortcuts` 内部同时持 `LSStore` + `cloudStore`,根据 JWT 态切换 activeStore。token 切换时 effect 自动重 load:
- 首次访问**不需要登录**就能用(本地缓存)
- 登录后**无缝接管**,数据 push 到云端
- 登出回游客模式,LS 仍可用

---

## 跨模型通用决策

### 不解析 defaultGroupId,让后端来

**不要写 `getDefaultGroup` 端点**:
- 端点信息多余 —— 后端 KV 端点已经处理 default
- 多一个 round-trip
- 多一份测试 / 维护成本
- 多一个让用户困惑的 API

如果 UI 需要「我自己的默认组是哪个」(比如显示「默认」徽章),用 `GET /groups` 然后看哪些是 `isDefault`(后端标记)。**这才是 user-space 多组管理 UI 的事,不是 per-user 数据组件的事**。

### 同步状态三态独立

`authState`(logged-out / syncing / error)**不够** —— save 期间短暂 syncing 会被误判为登出。

正确做法:**三态独立**:
- `userId > 0` → 登录判断(同步中不变)
- `syncState: 'idle' | 'syncing' | 'error'` → 同步状态
- `lastSyncAt: number` → UI 实时显示「5 秒前同步」
- `lastSyncError: string | null` → 显示失败原因

UI 判断「是否登录」用 `userId`,显示同步状态用 `syncState` + `lastSyncAt`。

### 同步模式:auto / manual + dirty

| 模式 | 行为 | UI 提示 |
|---|---|---|
| auto | 改本地 → 立即 sync(200ms debounce) | sync pill 显示「刚刚同步」 |
| manual | 改本地 → 仅标 dirty | dirty 时 modal 显示「保存到云端」按钮 |

切换 manual→auto 时如果 dirty,**立即 flush**(避免切完才发现数据没传)。

### 退出确认只在 manual + dirty

banner 退出按钮的逻辑:
```ts
if (saveMode === 'manual' && dirty && warnOnDirtyExit) {
  const save = window.confirm('先保存 vs 直接退出?');
  // ...
}
```

**不要在 activeStore 切换 effect 里再弹窗** —— 双重弹窗。

### 删除就地二次确认(× → ? → 删除)

`window.confirm()` 太重(浏览器原生 modal,体验断裂)。改成本地 state:
```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState(null);
// × → ?(变红 + 脉冲)→ 再点 → 真删
<button onClick={confirmDeleteId === id ? () => onDelete(id) : () => setConfirmDeleteId(id)}>
  {confirmDeleteId === id ? '?' : '×'}
</button>
// 失焦自动取消,避免「?」跨分组残留
onBlur={() => confirmDeleteId === id && setConfirmDeleteId(null)}
```

### 401 / jwtAuthState 处理

见 [[auth-jwt]] —— 401 不自动登出、`jwtAuthState === 'logged-in'` 必须进 effect dep。

---

## 已知坑(用法 / 组件层)

| 坑 | 症状 | 修复 |
|---|---|---|
| **前端解析 default groupId** | 多打一次 /user/default-group,逻辑重复 | 不传 groupId,后端走 default(见「不解析」) |
| **per-item KV** | listByTag 要分页 + 串行化 read-modify-write | 单 blob,改一条整体重传(KB 级无影响) |
| **user-space 不传 groupId** | 看不到当前组的 KV,看到的是个人空间 | user-space 显式传 groupId(见「模型一」) |
| **普通组件传 groupId** | 越权 / 绑死某个组 | 不传,后端走 default(见「模型二」) |
| `credentials: 'omit'` 失败 | cookie 不带 | fetch 默认就是 omit,别手动加 |
| 401 后 JWT 残留 LS | 下次启动又拿坏 token 试 | logout 时清 LS token |
| 同步 pill authState 误判 | sync 期间被切游客 | 用 `userId > 0` 判断登录 |
| 双重 confirm 弹窗 | 退出按钮 + effect 各弹一次 | 只在按钮 onClick 弹 |
| HKDF salt 非空导致跨客户端不互通 | 加密互通失败 | WebCrypto `new Uint8Array()`(零长) |

## 范围外(本 skill 不做)

- WebCrypto 加密(那是 e2ekv 的事,user/kv 服务端能看明文)
- 多端实时同步(webrtc / websocket)
- KV 跨用户共享 —— 走 `kv_shares` 短码通道(dev_ctr_hello 后端 [[kv-share]]),不是本 skill
- 重置密码(/user/reset-password)
- TTL 清理
- 邀请链可视化
