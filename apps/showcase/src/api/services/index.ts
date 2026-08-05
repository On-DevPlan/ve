// api/services/index.ts —— services 汇总导出(barrel)。
//
// 命名导出:tree-shaking 友好,组件 import { userV1Service, kvV1Service }
// from '@/api/services' 一次拿全。调用方不需要知道每个 service 在哪个子目录。
//
// 域类型也从各自的 ./types.ts 透传出来(userV1 / kvV1 都有)。
// 未来加新 backend:在 userV1/ 或 kvV1/ 同级新建目录,加 types.ts + index.ts,
// 在这里补一行 re-export,**并同步 README.md 的"加 backend 步骤"**。

export * from './userV1';
export * from './kvV1';
