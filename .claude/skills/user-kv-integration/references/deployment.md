---
ref: deployment
parent: user-kv-integration
---

# 部署:让 `/api` 在生产环境真正可达

> 本 ref 讲**前端组件接 user/kv 后如何上线**。协议字段见 [[protocol]];组件级 API 声明的完整机制见 `ve` 仓库的 `web-work-flow` skill 的 `component-level-dev-proxy` ref。

主 SKILL.md 讲的三件套(`authClient` / `userKvClient` / `userKvStore`)在本地 `pnpm dev` 下能跑通,**不代表上线能跑**。dev 的代理层和 prod 的代理层是两套东西,必须分别接。

## 症状:405 Not Allowed

```
POST http://<host>/api/v1/user/login 405 (Not Allowed)
authClient.ts:184
```

### 先分清是谁返回的 405

```bash
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
```

| 响应特征 | 含义 |
|---|---|
| `Server: nginx/...` + HTML 错误页 | **请求没到后端**。nginx 层的问题,往下看 |
| `Server: GoFrame HTTP Server` + `{"code":...}` | 请求到后端了,是路由或方法不匹配,查后端 |

再补一刀确认:

```bash
curl -i http://<host>/api/v1/user/login          # 同路径改 GET
curl -i -X POST http://<host>/definitely-not-a-route
```

**GET 返回 200 + `<!doctype html>`,且随便一个不存在的路径 POST 也是 405** → 判定成立:nginx 把 `/api/...` 当成了 SPA 路由。

### 根因

`default.conf` 里只有 `location / { try_files $uri $uri/ /index.html; }` 时:

1. `/api/v1/user/login` 匹配 `location /`
2. `try_files` 找不到实体文件 → fallback 到 `/index.html`
3. nginx 的**静态文件 handler** 只接受 `GET` / `HEAD`
4. `POST` → **405 Not Allowed**

所以这个 405 **从来没到过 Go 后端**,错误页是 nginx 品牌的,不是 `{code, message, data}` 信封。

### 为什么本地正常

`apiGateway()` 活在 `configureServer(server: ViteDevServer)` 里 —— 它是 **Vite dev-server 中间件**,读 `apps/showcase/src/api/registry.ts` 把 `/api/*` 转给不同后端。生产环境是 nginx 托管静态 `dist/`,没有 Vite,没有 dev server。因此:

- `apps/showcase/src/api/registry.ts` 的 `target.prod` 在生产**默认无效**(除非跑 `pnpm gen:nginx` 生成 nginx 配置文件)
- 旧设计里 `/__mfe/activate` 这种 fetch 钩子**已删除** —— 现在 dev 端是常驻 dispatch,无 activate/deactivate 协议
- 所以直到发出第一个 POST 之前,一切看起来都正常

> 旧设计细节参见 `.claude/skills/web-work-flow/references/component-level-dev-proxy.md` 顶部 deprecation banner。

## 解法:同源反向代理

在 nginx 加 `/api` 反代。**不要**改前端 `baseUrl` 去直连后端端口 —— 原因见下一节。

`ve` 仓库的做法是从 `apps/showcase/src/api/registry.ts` 单一事实源**构建期生成** nginx location(`pnpm --filter @style-library/showcase gen:nginx`),保证 dev/prod 路由永远一致。手写版本长这样:

```nginx
server {
    # ...

    location ^~ /api/ {
        proxy_pass http://<backend-host>:<port>;
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
| `location ^~` 而非普通前缀 | nginx 优先级 `=` > `^~` > **正则** > 普通前缀。若 `default.conf` 里有 `location ~* \.(js\|css\|png...)$`,它会**赢过普通前缀**,`/api/foo.svg` 之类被当静态资源 |
| `proxy_pass` 结尾**不带**斜杠 | 带 `/` 时 nginx 剥掉 location 前缀:`/api/v1/user/login` → `/v1/user/login` → 后端 404 |
| `proxy_set_header Host` | 等价于 http-proxy 的 `changeOrigin: true`,后端拿不到正确 host 时可能影响重定向 / cookie domain |

## 为什么不能直连后端端口

最省事的想法是把 `UserKVStore` 的 `baseUrl` 改成 `http://<host>:8988`。**这会把 405 换成 CORS 错误。**

先测:

```bash
curl -s -D - -o /dev/null -X POST http://<host>:8988/api/v1/user/login \
  -H 'content-type: application/json' -H 'Origin: http://<frontend-host>' -d '{}' \
  | grep -i "access-control"
```

若输出为空 → 后端**没有 CORS 中间件**。此时:

- 前端发 `content-type: application/json`,属于**非简单请求**,浏览器**必定**先发 `OPTIONS` 预检
- 预检响应没有 `Access-Control-Allow-Origin` → 浏览器直接拒绝,请求根本不发出

补充判据:如果 `OPTIONS` 请求返回的是业务错误(如 `{"code":51,"message":"The email field is required"}`),说明框架把 `OPTIONS` 直接路由给了业务 handler,预检压根没被拦截处理 —— 更加确认没有 CORS 支持。

反过来说,这恰恰证明**反向代理才是正解**:走同源转发,浏览器全程只跟前端端口对话,CORS 概念根本不存在。

> CSP 通常不是拦你的那个。`default-src 'self' http: https:` 是放行 `http:` 的。

## 容器网络

`proxy_pass` 的 target 在**容器内**解析。若前端容器这样起:

```bash
docker run -d --name ve_app -p 80:80 ve:latest
```

没有 `--network`、没有 link、没有 `extra_hosts`,那么容器里的 `localhost` 是**容器自身的回环地址**:

| target 写法 | 结果 |
|---|---|
| `http://localhost:8080` | **502** —— 容器自身回环上没有后端 |
| `http://<公网 IP>:8988` | 可行,但流量绕公网出去再回来,且端口必须对外开放 |
| `http://<容器名>:<port>` + 共享 docker network | **最优** —— 内网直连,后端端口可从公网收回 |

先验证可达性再改配置:

```bash
# 从前端容器内部测
docker exec ve_app wget -qO- http://<target>/api/v1/user/info
```

## 前端代码要不要改

**不要改。** `new UserKVStore()` 不传 `baseUrl` → `baseUrl = ''` → `authClient` 拼出相对路径 `/api/v1/user/login` → 同源 → 命中 nginx 的 `/api` location。这是正确行为,缺口完全在服务端。

只有在**确认后端有 CORS 中间件**、且明确要跨域直连时,才需要传 `baseUrl`。

## 上线验证

```bash
# 应返回后端信封,而不是 nginx 的 405 HTML
curl -i -X POST http://<host>/api/v1/user/login \
  -H 'content-type: application/json' -d '{}'
# → Server: GoFrame HTTP Server
# → {"code":51,"message":"The email field is required","data":null}

# 需登录接口应返回 401(而不是 200 + HTML)
curl -o /dev/null -w "%{http_code}\n" http://<host>/api/v1/user/info
# → 401
```

判据:**`Server` 响应头**。`GoFrame HTTP Server` = 打到后端了;`nginx` + HTML = 还在 SPA fallback。

注意 `{"code":51}` 是**成功信号** —— 它证明请求穿透 nginx 到达了后端并被业务逻辑处理(见 [[protocol]]:业务错误走 HTTP 200)。

## 排查清单

线上 API 不通时按顺序过:

1. `curl -i` 看 `Server` 头 —— 分清 nginx 还是后端返回的
2. 后端本身活着吗?`curl <backend-host>:<port>/api/v1/user/info` 应返回 401 而非连接失败
3. nginx 有 `/api` location 吗?`docker exec <container> cat /etc/nginx/conf.d/default.conf`
4. nginx 配置解析通过吗?`docker exec <container> nginx -t`
5. `proxy_pass` 的 target 从容器内可达吗?`docker exec <container> wget -qO- <target>`
6. 前端发的是相对路径吗?DevTools Network 看 Request URL 的 origin

## 已知坑

| 坑 | 症状 | 修复 |
|---|---|---|
| nginx 无 `/api` 反代 | POST 405,GET 返回 HTML | 加 `location ^~ /api/` |
| `proxy_pass` 带尾斜杠 | 后端 404 | 去掉尾斜杠 |
| 用普通前缀 location | 特定后缀路径被当静态资源 | 改用 `^~` |
| 片段放进 `conf.d/` | nginx 起不来 | `conf.d/` 在 http 层 include,裸 `location` 是语法错误;放独立目录由 `server{}` 内 include |
| target 写 `localhost` | 502 | 容器内 localhost ≠ 宿主机 |
| 改 `baseUrl` 直连后端 | CORS 报错 | 改回同源相对路径,走反代 |
| dev 的 target 印进 prod | 502 | target 分环境(`{ dev, prod }`) |
