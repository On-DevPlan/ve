// services/userV1/types.ts —— /api/v1/user/* 后端请求 / 响应类型。
//
// 与 userV1/index.ts 的 service class 分离:域类型独立可被下游(如 auth-store)
// 引入,不需要把整个 service class 拖进来。

export interface UserInfo {
  id: number;
  email: string;
  username: string;
  nickname: string;
  invitationCode: string;
  /**
   * 默认工作空间 id。后端 DTO 当前未返回(遗留:doc 注 e2e 用 SQL 适配),
   * 仍声明可选 —— 后续 DTO 加字段后类型自动对齐;若未返回,前端用
   * listGroups() 兜底(由 createUserSpaceStore.resolveDefaultGroupId 处理)。
   */
  defaultGroupId?: number;
}

export interface RegisterArgs {
  email: string;
  password: string;
  code: string;
  invitationCode: string;
  nickname?: string;
}
