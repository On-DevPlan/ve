# user-space KV 增删改查 设计

- 日期:2026-08-05
- 分支:`feat/user-space-kv-crud`
- 状态:已批准(brainstorming 流程)

## 背景

`user-space` 组件的 KV 库存(Inventory tab)目前**只读快照**:store 调 `kvV1Service.list({groupId})` 拉 key 列表,再逐 key `get` 截断 value 预览。用户需要在这里对 KV 做完整增删改查。

同时发现 **kvV1Service 仍停留在后端遗留契约**:

- `set()` 发送已废弃的 `visibility` 字段,且**不支持 `groupId`**(只能写默认组)
- `get()` 用 `ownerId`、`delete()` 无参数

后端已迁移到 **groupId 维度**(`(group_id, key)` 唯一键,权限由 `group_members.role` 决定,`visibility` 废弃)。因此本次必须先升级 kvV1Service 到新契约,再做 CRUD UI。

## 需求与范围决策

| 决策点 | 结论 |
|---|---|
| CRUD 深度 | 基础 CRUD(新建 / 详情 / 编辑 / 删除),不含版本回滚、跨组复制 |
| UI 落点 | 扩展 Inventory tab 为「KV 管理」,不新增独立 tab |
| 列表交互 | 分页 + tag 过滤(复用后端 `limit/offset + total + tags` 参数) |
| 实现方案 | 方案 A:就地升级 kvV1Service + 扩展 Inventory(单一事实源) |

**默认细节**(未经额外确认,按后端契约与既有交互模式推断):

- key **不可改**(唯一键 `(group_id,key)`,后端无 rename endpoint)→ 编辑表单只改 value + tags + ttl
- 新建重复 key = upsert 覆盖;提交前若 key 已存在于当前列表,先 confirm 提示「将覆盖原值」
- 权限按 `myRole`:`owner/admin/writer` 可写(增/改/删),`reader` 纯只读(隐藏操作列)
- 详情用 modal;列表响应已带 `value` 全文,详情不额外请求

## 架构

### 服务层(kvV1Service 升级到 groupId 契约)

| 文件 | 改动 |
|---|---|
| `apps/showcase/src/api/services/kvV1/types.ts` | `KvSetArgs` 删 `visibility`、加 `groupId?`;`KvGetArgs` 删 `ownerId`、加 `groupId?`;`KvItem` 补 `groupId/groupName/myRole`;新增 `KvDeleteArgs {key, groupId?}` |
| `apps/showcase/src/api/services/kvV1/index.ts` | `set()` body 改 `{key, value, ttl, tags, groupId}`(不再发 visibility);`get()` 用 `?groupId=`;`delete()` 接受 `{key, groupId?}` 拼 query;`list()` 的 groupId 支持不变 |
| `apps/showcase/src/api/components/shortcut-library/createShortcutStore.ts` | `set({visibility:'private',…})` 去掉 `visibility`(写默认组,不传 groupId) |

### 业务封装(createUserSpaceStore 增加 CRUD)

`apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`:

- 新增 `createKv(groupId, {key, value, tags, ttl})` → `kvV1Service.set({...args, groupId})`
- 新增 `updateKv(groupId, {key, value, tags, ttl})` → 同 set(key 不变,后端 upsert)
- 新增 `deleteKv(groupId, key)` → `kvV1Service.delete({key, groupId})`
- 新增 `getKvDetail(groupId, key)` → `kvV1Service.get({key, groupId})`(刷新单条完整值用)
- `inventory` 改为 `listKvs(groupId, {page, pageSize, tags})` → 返回 `{items, total, page, pageSize}`
  - **消除 N+1**:后端 `list` 响应自带 `value` 全文,列表直接截断展示;不再逐 key `get`(当前实现是 N+1,去掉)
  - `value` 预览截断常量沿用现有 `VALUE_PREVIEW_MAX = 80`

对应 `types.ts`(组件域)新增:

- `KvView { key, value, valuePreview, valueLength, tags, groupId, groupName, myRole, expiresAt }`
- `KvListResult { items: KvView[], total, page, pageSize }`
- `KvEditorPayload { key?, value, tags: string[], ttl: number }`(key 编辑时忽略)

### UI(Inventory 管理视图)

`packages/react-components/src/user-space/src/pages/Inventory.tsx` 扩展:

- **列表列**:key / value 预览(截断 80 字符)/ tags badges / expires_at / 操作(详情、编辑、删除)
- **顶部工具条**(writer+ 可见):「新建 KV」按钮、tag 过滤下拉(从**当前列表** tags 聚合,不发额外请求)、分页控件(page/pageSize,total 来自后端)
- **删除**:行内二次确认(× → ? → 确认),沿用 shortcut-library 交互
- **详情**:点击行「详情」按钮弹 modal,展示完整 value + tags + expires_at + groupName + myRole(用列表已带数据,不额外请求)

新增 `packages/react-components/src/user-space/src/pages/KvEditorModal.tsx`(新建/编辑共用):

- portal 渲染到 shadowRoot 外,沿用 SettingsPanel 的 `[data-sl-portal]` 模式
- 字段:
  - 新建:key(文本)+ value(textarea)+ tags(逗号分隔 → 数组)+ ttl(天,0=永久;提交时 ×86400 换算秒)
  - 编辑:key **禁用**,其余同上
- 新建时 key 已存在 → 先 `confirm` 提示覆盖再提交

接线:`index.tsx` 把 `listKvs/createKv/updateKv/deleteKv` 经现有 `withError` 封装传给 Inventory;列表 reload 逻辑改为分页状态驱动。

`index.css` 新增:工具条、分页、modal 表单、tag 输入样式(类名沿用 `sl-us-*` 前缀)。

## 数据流

```
进入 tab      → store.listKvs(groupId, {page, pageSize, tags}) → kvV1Service.list → 渲染 + total
新建/编辑提交  → store.createKv / updateKv → kvV1Service.set → reload 当前页
删除确认      → store.deleteKv → kvV1Service.delete → reload(末页空则回退一页)
详情          → 列表已带 value,modal 直接展示(不额外请求;需刷新单条走 getKvDetail)
```

## 错误处理

- store 层透传 `ApiError`;401 由 host `request.ts` 全局降级游客,组件零感知
- UI 层沿用现有 `withError` 封装 → `actionError` banner
- 删除/保存失败仅提示,不改列表乐观状态
- 新建覆盖 confirm 仅在 key 存在于当前列表时弹出;不在列表(其他页/过滤外)的重复 key 由后端 upsert 语义静默覆盖,属可接受

## 测试

| 文件 | 内容 |
|---|---|
| `apps/showcase/__tests__/kvV1.test.ts`(改) | set 不再发 visibility、set/get/delete 的 groupId query 断言 |
| `apps/showcase/__tests__/shortcut-library-store.test.ts`(改,如受影响) | createShortcutStore.set 去 visibility 后 mock 断言对齐 |
| `apps/showcase/__tests__/user-space-store.test.ts`(新) | mock `global.fetch`,验证 createKv/updateKv/deleteKv/listKvs 的 URL/body/query;listKvs 分页参数映射 |
| 组件层(可选) | mock `@api` 渲染 Inventory,覆盖分页、新建、删除交互 |

## 涉及文件清单

**改**
- `apps/showcase/src/api/services/kvV1/types.ts`
- `apps/showcase/src/api/services/kvV1/index.ts`
- `apps/showcase/src/api/components/shortcut-library/createShortcutStore.ts`
- `apps/showcase/src/api/components/user-space/createUserSpaceStore.ts`
- `apps/showcase/src/api/components/user-space/types.ts`
- `packages/react-components/src/user-space/src/pages/Inventory.tsx`
- `packages/react-components/src/user-space/index.css`
- `packages/react-components/src/user-space/index.tsx`
- `apps/showcase/__tests__/kvV1.test.ts`
- `apps/showcase/__tests__/shortcut-library-store.test.ts`(如受影响)

**新**
- `packages/react-components/src/user-space/src/pages/KvEditorModal.tsx`
- `apps/showcase/__tests__/user-space-store.test.ts`

## 验收标准

1. `pnpm lint` 通过(`--max-warnings=0`)
2. `pnpm build` 成功,`rc-user-space-*.js` 独立 chunk 正常;manifest 含 user-space
3. `vitest` 全过(showcase + react-components)
4. 手动:登录 → user-space → KV 管理 tab → 新建(key+value+tags+ttl)/ 编辑 / 删除 / 分页 / tag 过滤均生效;reader 角色看不到操作列
5. kvV1Service.set 不再发送 `visibility` 字段(可在 devtools 验证请求 body)
