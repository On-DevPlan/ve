// api/types.ts —— api 层的类型支柱(SPEC §4)。
//
// 提供:
//   - BackendRegistration:一条后端注册(单 route + target)。
//   - ApiRegistry:注册表形态(Record<string, …>),key 由 registry.ts 的
//     `as const` 字面量对象自动推导,不强制也不依赖手写的 BackendId。
//
// 为什么 ApiRegistry 是 Record<string, …> 而不是 Record<BackendId, …>:
//   BackendId 自身就是从 `typeof registry` 反推而来,这里再 Record<BackendId, …>
//   会形成循环依赖(value → type → value)。去掉 key 约束,运行时 registry
//   仍由启动期校验保证 key 与 BackendId 一一对应。
//
// 为什么 route 是**单值**而不是数组:
//   数组形态曾让 dev 侧(to-vite-proxy 遍历全部)与 prod 侧(gen-nginx 只取
//   routes[0])行为分叉 —— 第二条 route 在 dev 能通、在 prod 静默丢失。
//   单值让"一个 backend 一个前缀"成为类型级事实,两侧不可能再漂移。
//   真需要同一后端挂多个前缀时,注册两个 backend entry(各自 id),
//   registry 的冲突校验会保证它们互不重叠。
//
// 为什么没把 ApiPathLiteral 做成 brand:
//   service 里 `BASE = apiPaths.<id>` 这条约束靠 registry.ts 的
//   `apiPaths as const` derive 实现 —— 字面量类型从那里出,这一层不需要 brand。

/** 代理目标。string = 两端永久共用同一后端;{dev,prod} = 分环境。 */
export type ApiTarget = string | { dev: string; prod: string };

/**
 * 单条后端的注册信息:一个 target + 一个 path 前缀。
 *
 * `route` 是**规范化前**的作者书写形态;唯一的形态约束是"以 / 开头"
 * (normalize.ts 校验)。尾斜杠由 normalize.ts 统一剥除,dev 与 prod
 * 都消费 normalize 的输出,不各自解释。
 */
export interface BackendRegistration {
  target: ApiTarget;
  route: string;
}

/** registry 形态(apps/showcase/src/api/registry.ts 的契约) */
export type ApiRegistry = Record<string, BackendRegistration>;