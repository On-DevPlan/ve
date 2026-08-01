---
ref: component-level-dev-proxy
parent: dev-server-patterns
---

# 组件级 dev proxy(按需)

`vite.config.ts` 不应硬编码组件特定的 proxy(如 shortcut-library 需要 `:8080`)。proxy 是**组件的 dev 依赖**,应由组件自己声明,host 零感知。

## 三件套

| 角色 | 文件 | 职责 |
|---|---|---|
| 声明 | `packages/{vue,react}-components/src/<id>/component.config.ts` 的 `api` 字段 | 该组件需要的后端代理规则 |
| 收集 | `packages/manifest-generator/src/mfe-dynamic-proxy.ts` 的 `mfeDynamicProxy(configs)` 工厂 | 启动时把 configs 归一成 `Map<id, ApiRule[]>`,运行时按 `activeId` 查表 |
| 生命周期 | `apps/showcase/src/pages/DetailPage.vue` | mount 前 `fetch /__mfe/activate?id=<id>`,unmount 前 `fetch /__mfe/deactivate?id=<id>` |

## 声明格式(`ComponentConfig.api`)

```ts
// 数组写法 —— 推荐,显式穷举
api: [
  { context: '/v1', target: 'http://localhost:8080', changeOrigin: true },
]

// 对象映射 —— key 自动推 context 为 `/api/<key>`
api: {
  shortcut: 'http://localhost:8080',                          // → /api/shortcut
  sync: { target: 'http://localhost:9000', rewrite: { '^/api/sync': '' } },
}
```

字段:`context`(必填,前缀匹配)、`target`(必填)、`rewrite`(正则映射或函数)、`changeOrigin`(默认 true)、`ws`(WebSocket 代理)。

## 为什么需要动态 dispatcher

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

## DetailPage 钩子

`MountSession` 已经管 cleanup,集成点两个:

```ts
// mount(componentId) 里,拿到 entry 之后,调 loader 之前
void fetch(`/__mfe/activate?id=${encodeURIComponent(componentId)}`).catch(() => {});

// MountSession.cleanup() 里,最先(在 unmount 之前)
void fetch(`/__mfe/deactivate?id=${encodeURIComponent(this.id)}`).catch(() => {});
```

**不 await activate** —— fetch 同步发起,server 端同步设 `activeId`,组件首个 fetch 在同一 microtask 后执行,一定看到 `activeId` 已设。失败被吞(没声明 api 的组件 activate 是 no-op,降级到直接走 origin → 可能 CORS 失败,但 dev 便利不应影响功能)。

## 验证

```bash
# 启动后端 + 前端
go run .  # 后端 :8080
pnpm dev  # 前端 :5173(若被占顺延)

# 1. 无 activate → /v1 不被监听,走 SPA fallback (text/html)
curl -i http://localhost:5173/v1/e2ekv/healthz

# 2. 手动 activate(模拟挂载)
curl -i 'http://localhost:5173/__mfe/activate?id=shortcut-library'

# 3. /v1 现在被代理到 :8080,server 头变 GoFrame
curl -i http://localhost:5173/v1/e2ekv/healthz
# → 200 + 'server: GoFrame HTTP Server'

# 4. deactivate 后,fallback 恢复
curl -i 'http://localhost:5173/__mfe/deactivate?id=shortcut-library'
curl -i http://localhost:5173/v1/e2ekv/healthz
# → SPA fallback

# 5. 非法 id 静默忽略(不激活)
curl -i 'http://localhost:5173/__mfe/activate?id=nonexistent-component'
```

## 已知边界

- **独占语义**:同时只有一个 `activeId`。两组件声明同 path 不同 target,切换组件即切换代理 —— 这是预期行为,不是 bug。
- **deactivate 漏发**(用户直接关 tab):`activeId` 残留,新会话需要 deactivate 才能切走。dev 阶段可接受,生产 build 不跑 vite dev。
- **多 vite 进程**:每个 dev server 有自己的 `activeId`,进程间不共享。多个 `pnpm dev` 跑不同端口时会各自独立激活。
- **声明多组件同 path**:运行期只看当前 activeId 的表,不会冲突;声明期也无 warning(可考虑加,但当前不做)。
- **activate 时序**:理论上 microtask 顺序保证首个 fetch 看到 activeId,但极端情况下(网络极慢 + 组件立刻发请求)可能 race。观察无问题。

## 与 vite proxy 的取舍

| 方案 | 优 | 缺 |
|---|---|---|
| 静态收集(本方案) | 一处声明,host 零感知 | proxy 表常驻 |
| 原始 `server.proxy` 硬编码 | vite 原生 | 破坏组件隔离,host 知道组件细节 |

`mfeDynamicProxy` 内部仍然常驻一个 dispatcher 中间件 —— 但**只一个**,且**不绑定任何 path**;只在 `activeId` 匹配时才转发。运行时性能可忽略。

## 复用本 ref 给其他场景

任何"组件需要 dev 后端"的情况:WebSocket 转发、多后端、路径重写 —— 都用 `api` 字段声明。规则表是静态的,运行期不重新扫描;新增组件 / 修改 api 后**重启 dev server** 才会生效(跟 `manifestPlugin` 一致)。