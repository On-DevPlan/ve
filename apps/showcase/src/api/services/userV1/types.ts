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
}

export interface RegisterArgs {
  email: string;
  password: string;
  code: string;
  invitationCode: string;
  nickname?: string;
}
