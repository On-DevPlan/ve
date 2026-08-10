// api/index.ts —— API 层统一收口(客户端可见部分)。
//
// 调用方只需要 import from '@api' 就能拿到所有 backend HTTP wrappers + 组件层
// 业务封装,不需要记每个 service 在哪个子目录。
//
// 范围:
//   - '#api/services'  HttpService 基类 + 每个 backend 的 userV1Service / kvV1Service
//                       / authService,加上它们的域类型(UserInfo / KvItem / ...)
//   - '#api/components'  createShortcutStore 等具体 micro-frontend 的业务封装
//   - '#api/types'      ApiRegistry / ApiRule / ApiPathLiteral 的字面量类型
//   - '#api/registry'   getRegistry() / apiPaths(API 路由单一事实源)
//   - '#api/normalize'  prod/dev target 归一化(registry-tied)
//
// 不收口(避免 node-only 代码进客户端 bundle):
//   - './to-vite-proxy'  dev Vite middleware plugin(node:url, http-proxy)
//   - './gen-nginx'     prod nginx location 生成(node:fs, node:path)
//   这两个只在 vite.config.ts 跑,看 vite.config.ts 引 import 路径。
//
// 演进路线(SPEC §12):
//   1. 这里只 re-export —— 路径统一,不加抽象
//   2. 新 backend:在 services/ 加目录,自动被这里 re-export
//   3. 未来需要扫 services/ 自动注册到 registry 时,这里的 export * 保持供应商入口

export * from './services';
export * from './components';
export * from './types';
export * from './registry';
export * from './normalize';
export * from './tools/file-url';
