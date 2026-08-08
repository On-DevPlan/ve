---
ref: adding-a-component
parent: user-kv-integration
---

# ref4 — 新增组件接入 user/kv:要怎么办

> 前提:先读 [[usage-scope]] 确定你的组件是**模型一(user-space)**还是**模型二(single-blob)**,这决定你接哪些接口。本 ref 讲**接的过程**:注册 API → 写 service → 封装 store → 接 UI → 上线。

## 架构速查

```
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
 :8988 (后端)   :8988 (生产后端)

  两端读同一份 apps/showcase/src/api/registry.ts
```

---

## 一、组件需要后端 API 吗?

`ve` 的 API 分三层,各有各的位置:

| 层 | 路径 | 干什么 |
|---|---|---|
| registry(路由事实源) | `apps/showcase/src/api/registry.ts` | 声明 `/api/xxx` 转发到哪个后端(dev 代理 + prod nginx 共用) |
| services(HTTP wrapper) | `apps/showcase/src/api/services/<id>/` | 每个后端一个目录:`index.ts`(类,继承 `HttpService`)+ `types.ts`(请求/响应类型) |
| components(业务封装) | `apps/showcase/src/api/components/<id>/` | 每个 micro-frontend 一个目录:如 `createShortcutStore` / `createUserSpaceStore` |

**不需要后端的组件**(纯本地状态)→ 什么都不用改,直接跳过本节。

---

## 二、接入步骤

> 以「新增一个 file 域 service(`fileV1`),供一个工作空间文件管理组件用」为例。已有后端 `userV1 / kvV1 / groupV1 / groupInvitationV1` 就是这么接的。

### Step 1 — registry.ts 加路径 + entry

```ts
// apps/showcase/src/api/registry.ts
export const apiPaths = {
  userV1: '/api/v1/user',
  kvV1: '/api/v1/kv',
  groupV1: '/api/v1/groups',
  groupInvitationV1: '/api/v1/group-invitations',
  fileV1: '/api/v1/files',          // ← 新增
} as const;

const registry = {
  // ...现有 4 条
  fileV1: {
    target: {
      dev: 'http://47.110.80.47:8988',
      prod: 'http://47.110.80.47:8988',
    },
    route: apiPaths.fileV1,
  },
} as const satisfies ApiRegistry;
```

- `route` 不能与已有 entry 前缀重叠,否则启动期校验 `throw`(fail-fast)
- `BackendId` / `ApiPathLiteral` 从 registry key 自动推导,不用手写
- **不要**改 `vite.config.ts` / 手写 `default.conf` —— dev/prod 都由 registry 单一事实源生成
- 更不要回退到 `component.config.ts` 的 `api` 字段(已废弃)

### Step 2 — services/<id>/ 写 HTTP wrapper

```ts
// apps/showcase/src/api/services/fileV1/types.ts
export interface FileInfo {
  fileId: string;
  url: string;
  accessLevel: 'public' | 'private' | 'protected';
  size: number;
  contentType: string;
  groupId: number;
  groupName: string;
  myRole: string;
  tags: string[];
  md5: string;
  sha256: string;
  createdAt?: string;
}
export interface FileListArgs {
  groupId?: number;   // 0 = caller default(见 ref2 通用规则)
  tags?: string[];
  match?: 'any' | 'all';
  key?: string;
  limit?: number;
  offset?: number;
}
export interface FileListResponse { items: FileInfo[]; total: number }
// ...
```

```ts
// apps/showcase/src/api/services/fileV1/index.ts
import { HttpService } from '../base';
import { apiPaths } from '../../registry';
import type { /* ... */ } from './types';

export class FileV1Service extends HttpService {
  readonly BASE = apiPaths.fileV1;

  async list(args: FileListArgs = {}): Promise<FileListResponse> {
    const qs = new URLSearchParams();
    if (args.groupId !== undefined && args.groupId > 0) qs.set('groupId', String(args.groupId));
    for (const tag of args.tags ?? []) qs.append('tags', tag);   // tags 多值必须 append
    if (args.match) qs.set('match', args.match);
    if (args.key) qs.set('key', args.key);
    if (args.limit !== undefined) qs.set('limit', String(args.limit));
    if (args.offset !== undefined) qs.set('offset', String(args.offset));
    return this.reqGet<FileListResponse>(`${qs.toString() ? `?${qs}` : ''}`);
  }

  async info(args: { fileId: string; groupId?: number }): Promise<FileInfo> {
    const qs = args.groupId && args.groupId > 0 ? `?groupId=${args.groupId}` : '';
    return this.reqGet<FileInfo>(`/${encodeURIComponent(args.fileId)}/info${qs}`);
  }
  // ...
}
export const fileV1Service = new FileV1Service();
```

- 继承 `HttpService`,`BASE = apiPaths.<id>`(类型约束保证不写错路径)
- 端点用 `this.reqGet / reqPost / reqPatch / reqDelete`(`reqPost` 见 kvV1 `duplicate` 的写法:`${encodeURIComponent(key)}/duplicate`)
- **鉴权自动**:`setBearerProvider` 已注入,`Authorization: Bearer` 头由 `request.ts` 统一加;401 由 `request.ts` 静默降级

### Step 3 — barrel + README 同步

- `apps/showcase/src/api/services/index.ts` 加一行 `export * from './fileV1';`
- `apps/showcase/src/api/services/README.md` 的「加 backend 步骤」补一句
- 组件 import:`import { fileV1Service } from '@api'`(别名经 `api/index.ts` 收口)

### Step 4 — api/components/<id>/ 业务封装

```ts
// apps/showcase/src/api/components/file-manager/createFileManagerStore.ts
// 模式对照:user-space/createUserSpaceStore.ts、shortcut-library/createShortcutStore.ts
export function createFileManagerStore() {
  // - saving / error state,和 createUserSpaceStore 的 createKv/updateKv/deleteKv 同风格
  // - 每个业务方法包一个 fileV1Service 调用,错误走 store 的 saving/error
  // - 登录判断:auth.jwtAuthState !== 'logged-in' || !auth.token(见 ref1)
}
```

**三件套模式**(现有 `user-kv-integration` 惯例,实际对应到 ve 结构):
1. **authClient** → `useJwtAuth()` / `getJwtAuthSnapshot()`(`apps/showcase/src/api/http/auth-store.ts`)—— 读登录态、token
2. **userKvClient** → `kvV1Service` / 新 `fileV1Service`(`services/`)—— HTTP wrapper
3. **userKvStore** → `createShortcutStore` / `createUserSpaceStore`(`api/components/`)—— 业务封装 + UI state

### Step 5 — 登录态读取(组件侧)

- Vue:`useJwtAuth()`(跨框架订阅,`auth-store.ts:256`)
- React:`useJwtAuth()` 同款(force-rerender 订阅);或 `getJwtAuthSnapshot()` 一次性读
- token key:`sl-userkv:v1:token`(LS)
- ⚠️ 等 `jwtAuthState === 'logged-in'` 再选 cloudStore(init race 见 [[auth-jwt]])

### ⚠️ multipart 上传(file 域特有)

`request.ts` **只序列化 JSON**(`body: JSON.stringify(body)`),并注明「不要传 FormData/Blob 自处理」。接 `POST /files`(multipart)需要先给 `request.ts` 加一条**不 JSON 化的通道**(或 `api.raw` 变体),别直接传 FormData 撞断言。

---

## 三、上线(dev 能跑 ≠ prod 能跑)

### dev 与 prod 是两套代理

| | dev | prod |
|---|---|---|
| 代理 | Vite dev-server 中间件 `apiGateway()`(`configureServer`) | nginx 静态托管 `dist/` |
| 输入 | 读 `apps/showcase/src/api/registry.ts` | `vite build` 内联插件(closeBundle 调 `genNginxOut()` 写 `nginx/api-locations/generated.conf`) |
| 说明 | 本地 `pnpm dev` 即生效 | `default.conf` include 生成的 location |

`target.prod` 在生产**默认无效**,除非跑了 `pnpm --filter @style-library/showcase build` 生成 nginx 配置。

### 症状:线上 405 Not Allowed(本地正常)

```
POST http://<host>/api/v1/user/login 405 (Not Allowed)
```

**先分清是谁返回的 405**:

```bash
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
```

| 响应特征 | 含义 |
|---|---|
| `Server: nginx/...` + HTML 错误页 | **请求没到后端**。nginx 层问题 |
| `Server: GoFrame HTTP Server` + `{"code":...}` | 请求到后端了,查后端路由 |

根因:`default.conf` 只有 `location / { try_files ... /index.html; }` 时,`/api/v1/...` 被 SPA fallback 吞掉,nginx 静态 handler 只接受 GET/HEAD → POST 405。**这个 405 从来没到过 Go 后端**。

### 解法:同源反向代理

`ve` 的正确做法是从 `registry.ts` **构建期生成** nginx location(dev/prod 永远一致),手写版:

```nginx
server {
    location ^~ /api/ {
        proxy_pass http://<backend-host>:<port>;      # 不带尾斜杠!
        proxy_set_header Host              $proxy_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 三个写错就静默失效的点

| 细节 | 写错的后果 |
|---|---|
| `location ^~` 而非普通前缀 | 正则 location(`~* \.(js\|css...)$`)会赢过普通前缀,`/api/foo.svg` 被当静态资源 |
| `proxy_pass` 结尾**不带**斜杠 | 带 `/` 会剥掉 location 前缀 → 后端 404 |
| `proxy_set_header Host` | 后端拿不到正确 host,影响重定向 / cookie domain |

### 为什么不能直连后端端口

把 `baseUrl` 改成 `http://<host>:8988` 会把 405 换成 **CORS 错误**(后端通常无 CORS 中间件,`content-type: application/json` 是非简单请求,浏览器必定先发 OPTIONS 预检,预检没 `Access-Control-Allow-Origin` → 直接拒绝)。

**正确行为**:`new UserV1Service()` 不传 baseUrl → 相对路径 `/api/v1/...` → 同源 → 命中 nginx 的 `/api` location。**前端代码不用改,缺口在服务端。**

### 容器网络

`proxy_pass` target 在**容器内**解析。容器里 `localhost` = 容器自身回环:

| target 写法 | 结果 |
|---|---|
| `http://localhost:8080` | **502**(容器回环上没有后端) |
| `http://<公网 IP>:8988` | 可行,但绕公网 |
| `http://<容器名>:<port>` + 共享 docker network | **最优** |

先验可达:`docker exec <容器> wget -qO- http://<target>/api/v1/user/info`

### 上线验证

```bash
# 应返回后端信封,而不是 nginx 的 405 HTML
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
# → Server: GoFrame HTTP Server
# → {"code":51,"message":"The email field is required","data":null}

# 需登录接口应返回 401
curl -o /dev/null -w "%{http_code}\n" http://<host>/api/v1/user/info
# → 401
```

判据:**`Server` 响应头**。`GoFrame HTTP Server` = 打到后端了;`nginx` + HTML = 还在 SPA fallback。`{"code":51}` 是**成功信号** —— 证明请求穿透 nginx 到了后端。

---

## 四、验证清单(开发自测)

```bash
# 后端已启动 + 前端 pnpm dev 后:

# 1. 游客:加数据,刷新 → 数据还在(LS)
# 2. 注册:send-code 注入法绕过邮箱(或真收邮件)
# 3. 登录 → 顶部变 sync pill
# 4. 加数据 → DevTools Network 看:
#      GET /api/v1/user/info  (init)
#      GET /api/v1/kv/<key>   ← 模型二不带 groupId / 模型一带显式 groupId
# 5. 关 tab → 新 incognito → Login 同账号 → 数据回来
# 6. 切 manual → 加数据 → 没 POST;modal 出现「保存到云端」
```

> ⚠️ 当组件 dev target 指向生产后端时,**这些步骤写的是生产数据**。用测试账号。

上线后**必须**再验证一次 —— dev 通过不代表 prod 通过(代理层两套,见第三节)。

---

## 已知坑(接入 / 部署层)

| 坑 | 症状 | 修复 |
|---|---|---|
| 线上 405,本地正常 | dev 代理是 vite 中间件,prod 没有 | nginx 加 `/api` 反代,见第三节 |
| 改 baseUrl 直连后端端口 | 405 变 CORS 错误 | 后端通常无 CORS;走同源反代 |
| `proxy_pass` 带尾斜杠 | 后端 404 | 去掉尾斜杠 |
| target 写 `localhost` | 502 | 容器内 localhost ≠ 宿主机 |
| dev 的 target 印进 prod | 502 | target 分环境(`{ dev, prod }`) |
| 新 backend 忘了 registry entry | 路由没注册,405 | 先写 service 再回来加 entry,见 Step 1 |
| `tags` 用了 `.set()` | 只保留最后一个 tag | `URLSearchParams.append()` |
| file 上传直接传 FormData | 断言/类型错 | 先给 `request.ts` 加非 JSON 通道 |

## 维护

改字段前:同步改 `services/<id>/types.ts` / `services/<id>/index.ts` / `api/components/<id>/` 三件套 + UI。加新场景前先问:
1. **有真实消费者吗?** 没有 → 不加
2. **走 single-blob 还是 per-resource?** 见 [[usage-scope]]
3. **JWT 过期时 UX?** 默认 sync pill 红点 + 重试;不自动登出
4. **要不要加新端点?** 99% 不要,先确认后端 default 解析能直接解决
