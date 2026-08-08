---
name: user-kv-integration
description: 把前端组件接到后端 user/kv + user/groups + file 体系(/api/v1,邮箱 + JWT + group 维度键值存储 + 文件图床 + 匿名上传 + 共享 key)。Triggers on building email login flows, JWT-bearer storage, single-blob cloud sync with offline LS fallback, sync mode toggles (auto/manual), dirty-state tracking, group/RBAC-aware KV or file reads, backend default-group resolution, anonymous file upload, file shared-key (by-key) access, or adding a new component that needs backend API.
---

# user-kv-integration

把前端组件接到 **user/kv + user/groups + file**(`/api/v1`)的标准化模式。本 skill 是**路由表** —— 按你要做的事选 ref。

> 基于 dev_ctr_hello 后端的 user + kv + file 模块。覆盖邮箱登录、邮箱 + JWT 身份、组维度 RBAC、单 key 云端同步、离线降级、同步模式 + 脏状态、跨组复制、图床文件、新增组件接入。

## 路由表

| 你在做什么 | 读 |
|---|---|
| 想理解**登录注册流程 / 验证码 / JWT 生命周期**、token 存哪、401 怎么处理、`jwtAuthState` init race | [[auth-jwt]] |
| 想查**某个接口的路径 / 方法 / 请求响应字段** —— 字符串 KV(kv/v1)或文件图床(file/v1) | [[api-reference]] |
| 想判断**「我这种组件」该用哪些接口** —— 个人空间(user-space,显式 groupId)vs 普通组件(single-blob,不传 groupId)、权限门槛、单 blob 决策、同步模式 | [[usage-scope]] |
| 想给**新组件接入后端** —— registry 注册 API、写 service client、封装 store、接 UI、上线部署 / 405 排查 | [[adding-a-component]] |

## 快速定位

- **只用一次就从这开始**:[[api-reference]] §通用规则(groupId 契约 + 权限门槛)是整体系的地基,其它 ref 都建立在它上面。
- **不确定自己组件是哪类**:先读 [[usage-scope]] 的决策树。
- **上线报错**:直接看 [[adding-a-component]] §三(dev/prod 两套代理)。

## 范围外

- WebCrypto 加密(那是 e2ekv 的事,user/kv 服务端能看明文)
- 多端实时同步(webrtc / websocket)
- KV 跨用户共享(走 `kv_shares` 短码通道,见 dev_ctr_hello 后端 skill)
- 重置密码(/user/reset-password)、TTL 清理、邀请链可视化
