---
ref: component-level-dev-proxy
parent: dev-server-patterns
---

# 组件级 API 代理(dev + prod 共用一张表)

`vite.config.ts` 不应硬编码组件特定的 proxy(如 shortcut-library 需要 `:8080`)。proxy 是**组件的 dev 依赖**,应由组件自己声明,host 零感知。

**`ComponentConfig.api` 是 dev 与 prod 路由的唯一事实源**:

```
component.config.ts 的 api 字段
        │
        ├── dev  → mfeDynamicProxy 读它 → http-proxy 中间件(按 activeId 动态代理)
        └── prod → scripts/gen-nginx.mjs 读它 → nginx location 片段(构建期生成)
                          │
                    两端共用 normalizeApi()
```

共用归一化实现是关键 —— 否则两边对 `api` 的解释会漂移,那就等于又造了第二个事实源,恰好是这套设计要消灭的东西("本地能跑、上线 404")。

## 三件套 + prod 出口

| 角色 | 文件 | 职责 |
|---|---|---|
| 声明 | `packages/{vue,react}-components/src/<id>/component.config.ts` 的 `api` 字段 | 该组件需要的后端代理规则(**两端共用**) |
| 收集(dev) | `packages/manifest-generator/src/mfe-dynamic-proxy.ts` 的 `mfeDynamicProxy(configs)` | 启动时归一成 `Map<id, ApiRule[]>`,运行时按 `activeId` 查表 |
| 生命周期(dev) | `apps/showcase/src/pages/DetailPage.vue` | mount 前 `fetch /__mfe/activate?id=<id>`,unmount 前 deactivate |
| 生成(prod) | `packages/manifest-generator/src/nginx-emit.ts` + `scripts/gen-nginx.mjs` | 扫同一批 config → nginx location 片段,Docker builder 阶段跑 |

## 声明格式(`ComponentConfig.api`)

```ts
// 数组写法 —— 推荐,显式穷举
api: [
  {
    context: '/api',
    target: {
      dev:  'http://localhost:8080',        // 开发机上 `go run .` 的进程
      prod: 'http://47.110.80.47:8988',     // 生产后端
    },
    changeOrigin: true,
  },
]

// target 也可以是纯 string —— 仅当两端**真的**共用一个后端(如公网托管的第三方 API)
api: [{ context: '/api/weather', target: 'https://api.example.com' }]

// 对象映射 —— key 自动推 context 为 `/api/<key>`
api: {
  shortcut: 'http://localhost:8080',        // → /api/shortcut,两端同 target
}
```

字段:`context`(必填,前缀匹配)、`target`(必填,`string | { dev, prod }`)、`rewrite`(正则映射或函数,**prod 不支持**见下)、`changeOrigin`(默认 true)、`ws`(WebSocket 代理)。

### 为什么 target 必须能分环境

`http://localhost:8080` 指的是**开发机上**的进程。这个值一旦被原样印进生产 nginx 配置,在 `ve_app` 容器里 `localhost` 是**容器自身的回环地址** —— 那儿什么都没有 → connection refused → **502**。

分环境让"唯一事实源"成立的同时不牺牲正确性。缺对应环境的值时 `resolveTarget` **抛错而非回退**:回退到 dev 值就意味着把 localhost 印进生产配置,正是要防的失败模式。宁可构建期炸,不要运行期 502。

### 两端可以取相同值(当前 shortcut-library 的选择)

分环境**允许**但不**强制**两端不同。`shortcut-library` 目前 `dev` 与 `prod` 都指向生产后端:

```ts
target: {
  dev:  'http://47.110.80.47:8988',
  prod: 'http://47.110.80.47:8988',
},
```

好处:本地 `pnpm dev` 不必再起 `go run .`,克隆仓库即可调。

**代价:本地写操作直接落到生产数据库。** 加分组、删分组都是真实数据,没有回滚。需要隔离时把 `dev` 改回 `http://localhost:8080` 并在本地起后端。

> 即使两端取值相同,也**不要**简写成单个 string。简写的语义是"两端共用一个后端"这件事是**永久的**(如公网托管的第三方 API);而这里是临时取值相同。写成 string 后将来要拆环境,得先改回对象形态,反而丢了意图。

## 为什么需要动态 dispatcher(dev 侧)

Vite 的 `server.proxy` 是**启动时静态注册**的中间件,运行期不能增删。所以"点进去才监听"做不到字面意义。变通方法:

- 启动时只注册**一个**常驻 dispatcher 中间件,**不绑定 path**
- 内部维护 `activeId: string | null`(独占语义)
- 收到请求:若 `activeId` 非空,从 `table[activeId]` 找最长前缀匹配规则 → `http-proxy` 转发;否则 `next()` 让 vite 走 SPA fallback

视觉上等价于按需监听,但只用一个中间件。

## vite.config.ts 集成

`mfeDynamicProxy` 需要 configs,所以 `defineConfig` 改成 async 形态:

```ts
import { manifestPlugin, mfeDynamicProxy, scanConfigs } from '@style-library/manifest-generator';

const COMPONENT_ROOTS = [
  path.resolve(__dirname, '../../packages/vue-components/src/*/component.config.ts'),
  path.resolve(__dirname, '../../packages/react-components/src/*/component.config.ts'),
];

async function buildMfeProxyPlugin() {
  const scanned = await scanConfigs({ roots: COMPONENT_ROOTS });
  return mfeDynamicProxy({ configs: scanned.map(s => s.config) });
}

export default defineConfig(async () => ({
  plugins: [vue(), react(), await buildMfeProxyPlugin(), manifestPlugin({ componentRoots: COMPONENT_ROOTS })],
  server: { host: '0.0.0.0', port: 5173 },  // 不要再加 proxy 字段
  // ...
}));
```

`manifestPlugin` 内部也独立扫一次 configs —— 两次扫描浪费但无副作用(几十个组件 ~50ms)。后续可共享缓存。

> `scripts/gen-nginx.mjs` 里的 `COMPONENT_ROOTS` 与这里是同一组 glob,目前两处各写一份。真要收敛应提到 workspace 级共享常量,但那是独立重构。

## DetailPage 钩子

`MountSession` 已经管 cleanup,集成点两个:

```ts
// mount(componentId) 里,拿到 entry 之后,调 loader 之前
void fetch(`/__mfe/activate?id=${encodeURIComponent(componentId)}`).catch(() => {});

// MountSession.cleanup() 里,最先(在 unmount 之前)
void fetch(`/__mfe/deactivate?id=${encodeURIComponent(this.id)}`).catch(() => {});
```

**不 await activate** —— fetch 同步发起,server 端同步设 `activeId`,组件首个 fetch 在同一 microtask 后执行,一定看到 `activeId` 已设。失败被吞。

> 生产环境这两个 fetch 拿到的是 `index.html`(没有 dev 中间件),`.catch` 把它静默吞掉 —— 无害,但也意味着**dev 代理在 prod 完全不生效**。这正是需要 nginx 生成器的原因。

## prod 侧:nginx 生成

```bash
pnpm gen:nginx        # → nginx/api-locations/generated.conf(gitignored)
```

Docker builder 阶段自动跑;产物 `COPY` 到 runtime 镜像的 `/etc/nginx/api-locations/`,由 `default.conf` 在 `server{}` 内 `include`。

生成的形态:

```nginx
location ^~ /api/ {
    proxy_pass http://47.110.80.47:8988;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 三个不能省的 nginx 细节

| 细节 | 写错的后果 | 为什么 |
|---|---|---|
| `location ^~` 而非普通前缀 | `/api/foo.svg` 被静默当静态资源 | nginx 优先级 `=` > `^~` > **正则** > 普通前缀。`default.conf` 里的 `location ~* \.(js\|css\|png...)$` 是正则,**会赢过普通前缀** |
| `proxy_pass` 结尾**不带**斜杠 | 后端 404 | 带 `/` 时 nginx 剥掉 location 前缀:`/api/v1/user/login` → `/v1/user/login`。不带才透传原始 URI |
| 片段**不能**放 `conf.d/` | nginx 起不来 | `conf.d/` 是在 **http 层** include 的,裸 `location` 在那儿是语法错误。必须放独立目录,由 `default.conf` 在 `server{}` 内 include |

`include` 用**通配符**(`/etc/nginx/api-locations/*.conf`):没有任何组件声明 api 时目录为空,nginx 依然能启动;固定路径 include 不存在的文件会直接 fail。

### 构建期会中断的四种情况

生成器**拒绝生成**而不是产出一份"语法合法但路由错误"的配置:

| 情况 | 报错 |
|---|---|
| 两组件声明同 `context` 但不同 `target` | `location conflict on context "/api"` + 指名两个组件 id |
| 缺 `target.prod` | `missing target.prod` |
| `context` 不以 `/` 开头,或含空白 / `{};` | `does not start with "/"` / `whitespace or one of` |
| 声明了 `rewrite` | `not auto-translated` |

**冲突为什么必须中断**:dev 靠 `activeId` 消歧(同时只有一个组件活跃),nginx **没有"当前激活组件"这个概念**,同名 location 无法共存。让后写的静默覆盖先写的,会生成一份看起来正常实则错误的配置。解法是改用互不重叠的 `context`(如 `/api/<component-id>`)。

**rewrite 为什么不翻译**:JS 正则语义与 PCRE 有差异,函数形式根本无法序列化。生成一份"看着对但行为不同"的 rewrite 比直接拒绝更危险。需要时手写进 `default.conf`。

镜像构建里还有 `RUN nginx -t` —— 配置坏了**构建失败**,而不是部署后容器 crash-loop(那种情况下健康检查只报失败,完全看不出 nginx 压根没解析成功)。

## 验证

### dev

```bash
pnpm dev  # 前端 :5173(被占则顺延,看日志里的实际端口)
# shortcut-library 当前 dev target 指向生产后端,不必再起 go run .
# 若把 dev 改回 localhost:8080,则需要先 `go run .`

# 1. 无 activate → 走 SPA fallback (text/html)
curl -i http://localhost:5173/api/v1/user/info

# 2. 手动 activate(模拟挂载)
curl -i 'http://localhost:5173/__mfe/activate?id=shortcut-library'

# 3. 现在被代理到后端,401 + server 头变 GoFrame
curl -i http://localhost:5173/api/v1/user/info
# → HTTP/1.1 401 Unauthorized
# → server: GoFrame HTTP Server

# 4. deactivate 后 fallback 恢复
curl -i 'http://localhost:5173/__mfe/deactivate?id=shortcut-library'

# 5. 非法 id 静默忽略
curl -i 'http://localhost:5173/__mfe/activate?id=nonexistent-component'
```

### prod

```bash
# 生成 + 肉眼检查(重点:有没有 localhost 泄漏)
pnpm gen:nginx && cat nginx/api-locations/generated.conf

# 单测(20 个,覆盖尾斜杠 / ^~ / 环境隔离 / 冲突检测)
pnpm exec vitest run --project manifest-generator

# 部署后:应返回后端信封,而不是 nginx 的 405 HTML
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
# → {"code":51,"message":"The email field is required"}
```

判据:响应头 `Server: GoFrame HTTP Server` = 打到后端了;`Server: nginx` + HTML = 还在 fallback。

## 已知边界

- **独占语义(dev)**:同时只有一个 `activeId`。两组件声明同 path 不同 target,切换组件即切换代理 —— dev 的预期行为。但**prod 无法这样消歧**,所以生成器会在构建期报错。
- **deactivate 漏发**(直接关 tab):`activeId` 残留。dev 阶段可接受。
- **多 vite 进程**:每个 dev server 有自己的 `activeId`,进程间不共享。
- **规则表静态**:新增组件 / 改 `api` 后需**重启 dev server**(跟 `manifestPlugin` 一致);prod 侧则需重新构建镜像。
- **生成物 gitignored**:`nginx/api-locations/` 不入库 —— 提交它就等于重建了这次要消灭的第二事实源,且可能与 config 静默漂移。

## 与 vite proxy 的取舍

| 方案 | 优 | 缺 |
|---|---|---|
| 静态收集(本方案) | 一处声明,host 零感知,**dev/prod 一致** | proxy 表常驻 |
| 原始 `server.proxy` 硬编码 | vite 原生 | 破坏组件隔离,host 知道组件细节,**prod 完全没覆盖** |

## 复用本 ref 给其他场景

任何"组件需要后端"的情况:WebSocket 转发、多后端、路径重写 —— 都用 `api` 字段声明。新增第二个需要后端的组件时,**给它一个不重叠的 `context`**(如 `/api/<component-id>`),否则构建期会撞冲突检测。