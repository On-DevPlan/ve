# api/services —— 业务接口封装层

> 单一事实源的下游:`apps/showcase/src/api/registry.ts` 写路径,本目录写端点。
> 组件不再裸 URL,只调 `xxxService.method()`。

## 文件角色

| 路径 | 角色 | 何时改 |
|---|---|---|
| `base.ts` | `HttpService` 抽象基类,`reqGet/reqPost/reqDelete` 转发到 `api/http/request` | 改鉴权 / body 序列化策略时 |
| `index.ts` | barrel:把所有 service 实例 + 域类型 re-export 出去 | 加新 service 时补一行 |
| `<backend>/index.ts` | 一个后端 = 一个子目录。class extends HttpService,声明 `BASE` + 端点方法 | 加端点 / 改端点 path 时 |
| `<backend>/types.ts` | DTO/响应类型。分离:域类型不必拖整个 service class 进来 | 加新字段、改字段名 |

## 三件硬约束

1. **`BASE` 必须来自 `apiPaths`(registry 单一事实源)**
   ```ts
   readonly BASE = apiPaths.<id>;
   ```
   `ApiPathLiteral` 由 `apiPaths as const` 推导;registry 删除或重命名路径,
   这里**编译期报错**。

2. **不自接 `fetch` / 不 import `api/http/request`**
   所有端点定义必须走 `this.reqGet/reqPost/reqDelete`。除非是基础设置
   (如 `http/request.ts` 内部),否则绕开 base 类的写法 = 绕过鉴权与 401 协议。
   `api/http/request` 不通过 `@api` barrel 导出,想裸发请求的唯一方式是显式
   深路径 import —— 组件层不该碰。

3. **第三方后端必须走 `api.raw.*`** —— 如果有的话(目前两个后端都是自有后端)。
   raw 入口不解 `{code,data}` 包络,免得把第三方响应拆坏。

## 加一个新 backend 的步骤

> 例:加 `weather`(公共天气 API,无鉴权)。

1. **在 `apps/showcase/src/api/registry.ts` 加 entry:**
   ```ts
   weather: {
     target: 'https://api.open-meteo.com',
     route: '/api/weather',
   },
   ```
   `route` 是**单值**(不是数组)—— 一个后端一个前缀。数组形态曾让 dev 侧
   (遍历全部)与 prod 侧(只取第一条)行为分叉,已废弃。真需要同一后端挂
   多个前缀时,注册两个 backend entry(各自 id),registry 冲突校验保证不重叠。

2. **在 `apps/showcase/src/api/services/weather/` 建:**
   - `types.ts` — DTO(`Weather`, `ForecastArgs` 等)
   - `index.ts` — `class WeatherService extends HttpService` + 端点方法

3. **在 `apps/showcase/src/api/services/index.ts` 补 re-export:**
   ```ts
   export * from './weather';
   ```

4. **跑测试:**
   ```bash
   pnpm --filter @style-library/showcase exec vitest run --project showcase
   ```
   registry 启动期路径冲突校验会自动检测重复注册。

## 不做什么

- **不持有 UI state**(loading/error/响应缓存) —— 那是 `useQuery` / composable 的事
- **不抛非 ApiError 的异常** —— 后端信封已由 `api/http/request` 拆成 ApiError,service 不重新包
- **不调其他 service** —— 端点不该跨 service 组合(组合在 UI 层或上游 store)
- **不写死 baseUrl / 端口 / localhost** —— BASE 只来自 registry,dev/prod 共用

## 与 `api/http/request.ts` 的契约

```
请求  ─►  api.get/post/delete  (共享 client,在 api/http/request.ts)
            ↓
         credentials:'include' (httpOnly cookie)
         + 鉴权头注入(setBearerProvider 注入 Bearer JWT)
            ↓
         fetch → 同源 → vite 中间件 / nginx → 后端
            ↓
         解 {code, data, message}  →  service.method() 返回 data
         或 ApiError(code, message) →  service 调用方 catch
```

`api/http/request` 是**无业务依赖**的传输层 —— 不 import 任何 auth 状态,只认
两个注入点(auth-store 在 init 时注册):

- `setBearerProvider(fn)` —— 返回当前 JWT token(或 null)
- `setBearerUnauthorizedHandler(fn)` —— Bearer 请求 401 时通知 auth 侧静默降级

401 信号由 `api/http/request` 单点发出:有 Bearer → 注入的 handler(auth-store
清 JWT 态)。**`skipUnauthorized: true`** 仅用于"返回 401 是合法业务语义"的端点
(典型:`sendCode` 邮件频率限制 401、`login` 密码错误 401)。其它端点必须
401 → 全局降级。

## 目录内部 import 规则

`api/` 目录**内部**一律走相对路径,`@api`(barrel)只留给 `src/api/` 外部调用方:

- `api/components/*` → `../../services/...`(不 import `@api`,避免
  `index → components → createShortcutStore → index` 循环)
- `api/services/*` → `../http/request`、`../registry`、`../../registry`
- `shared/auth-store.ts` → `@api`(外部调用方,合法)

依赖方向:`shared → api`,单向。`api` 完全不认识 `shared`。

## 关联阅读

- `../registry.ts` —— 单一事实源:路径 / target / 启动期冲突校验
- `../normalize.ts` —— dev/prod 共用归一化(target.{dev,prod} 分流 + 尾斜杠剥除 + 命中判定)
- `../http/request.ts` —— 唯一 fetch 出口(传输层,不依赖业务状态)
- `../to-vite-proxy.ts` —— dev:vite plugin `apiGateway()` 长前缀匹配
- `../gen-nginx.ts` —— prod:`pnpm gen:nginx` 生成 nginx location
- `.claude/skills/web-work-flow/references/component-level-dev-proxy.md` —— **已废弃** 的旧"组件级 api 字段"设计,作历史档案