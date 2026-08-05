// api/registry.ts —— 后端注册表(SPEC §4,事实源)。
//
// 凡是后端代理(/api/xxx 转发到谁),从这里出发。
// dev 侧 to-vite-proxy.ts / prod 侧 gen-nginx.ts 都读这份配置,
// 共用 normalize.ts 的归一化,避免语义漂移(SPEC §决策 ⑤)。
//
// 启动校验:route 重叠即 throw。重复注册在同一 dev process 中是 bug,
// 在 nginx 里是 "location conflict"。fail-fast 总比"prod 路由错"好。
//
// 当前 list:userV1(JWT 邮箱登录)/ kvV1(JWT 键值存储)/ groupV1(工作空间 CRUD +
// 成员 + 邀请)/ groupInvitationV1(邀请撤销 / 接受,与 groupV1 同后端不同前缀)。
// 新增后端:先写 service,再回来加 entry —— 没有对应 service 实现的占位
// entry 不留在 registry 里。
//
// 路径单一事实源:`apiPaths`(下方字面量 map)是唯一写路径的地方。
//   - registry 的每条 `route` 引用 apiPaths.<id>
//   - service 的 `BASE` 也引用 apiPaths.<id>(见 services/*/index.ts)
//   加新后端:在 apiPaths 加一行 + registry 加 entry + 写 service(BASE = apiPaths.<id>)。
//   BackendId 从 registry key 自动推导,ApiPathLiteral 从 apiPaths 推导。

import { normalizeContext } from './normalize';
import type { ApiRegistry, BackendRegistration } from './types';

/** 路径单一事实源 —— 字符串只在这里出现一次。 */
export const apiPaths = {
  userV1: '/api/v1/user',
  kvV1: '/api/v1/kv',
  groupV1: '/api/v1/groups',
  groupInvitationV1: '/api/v1/group-invitations',
} as const;
export type ApiPathLiteral = (typeof apiPaths)[keyof typeof apiPaths];

// registry 类型收窄 = 字面量 Map,key 自动成为 BackendId 候选。
const registry = {
  userV1: {
    target: {
      dev: 'http://47.110.80.47:8988',
      prod: 'http://47.110.80.47:8988',
    },
    route: apiPaths.userV1,
  },
  kvV1: {
    target: {
      dev: 'http://47.110.80.47:8988',
      prod: 'http://47.110.80.47:8988',
    },
    route: apiPaths.kvV1,
  },
  // 工作空间 CRUD / 成员 / 组内邀请 —— 同一后端但前缀不同,按 SPEC §types
  // 拆成两个 backend entry 而不是数组 route。
  groupV1: {
    target: {
      dev: 'http://47.110.80.47:8988',
      prod: 'http://47.110.80.47:8988',
    },
    route: apiPaths.groupV1,
  },
  groupInvitationV1: {
    target: {
      dev: 'http://47.110.80.47:8988',
      prod: 'http://47.110.80.47:8988',
    },
    route: apiPaths.groupInvitationV1,
  },
} as const satisfies ApiRegistry;

/** 后端 id 联合 —— 从 registry 对象的 key 自动推导。 */
export type BackendId = keyof typeof registry;

// ───── 启动期校验:route 不重叠 ────────────────────────────────────
//
// 为什么在模块顶层跑(而不是只在 vite.config 里):registry 是 dev proxy 与
// prod nginx 生成器的共同输入,任何一侧 import 它都应立刻发现冲突。
// 开销是 O(n²) 字符串比较,n = backend 数(当前 2),可忽略。
//
// 比较前先 normalizeContext:作者若把 '/api/v1/kv' 与 '/api/v1/kv/' 写成两条,
// 归一化后能被识别为同一前缀,否则冲突检测会漏。
{
  const entries = Object.entries(registry).map(([id, backend]) => ({
    id,
    path: normalizeContext(backend.route),
  }));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      // 完全相等 / 前缀包含(后者吸收前者)都算冲突
      if (a.path === b.path || a.path.startsWith(b.path + '/') || b.path.startsWith(a.path + '/')) {
        throw new Error(
          `[api/registry] path conflict: backend "${a.id}" claims "${a.path}", ` +
            `backend "${b.id}" claims "${b.path}"`,
        );
      }
    }
  }
}

/** 运行时可读的注册表(只读,key 是 BackendId)。 */
export function getRegistry(): Readonly<{ [K in BackendId]: BackendRegistration }> {
  return registry;
}