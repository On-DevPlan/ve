// services/userV1/types.ts —— /api/v1/user/* 后端请求 / 响应类型。
//
// 与 userV1/index.ts 的 service class 分离:域类型独立可被下游(如 auth-store)
// 引入,不需要把整个 service class 拖进来。

import type { GroupRole } from '../groupV1/types';

export type { GroupRole };

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

/** GET /oidc/config —— 统一身份认证中心(go-ah auth-hub)的公开参数。 */
export interface OidcConfig {
  enabled: boolean;
  /** 认证中心 issuer(须与 IdP IDP_ISSUER 逐字一致)。 */
  issuer: string;
  /** 在认证中心注册的 client_id(公共客户端 + 强制 PKCE,无 client_secret)。 */
  clientId: string;
  /**
   * 后端自己登记的回调地址(go-co 静态参考页)。**前端不要用它** ——
   * 认证中心按 redirect_uri 逐字匹配白名单,ve 用自己的 origin + /oidc/callback。
   */
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  /** 统一登出地址(RP 发起的单点登出,会连带注销认证中心全局会话)。 */
  endSessionEndpoint: string;
  /** false = 发现文档没拉到,认证中心不可达(idpError 带原因)。 */
  idpAvailable: boolean;
  idpError?: string;
}

/** POST /oidc/callback —— 用 OIDC 授权码换本系统 JWT。 */
export interface OidcCallbackArgs {
  code: string;
  /** 发起授权时生成的 PKCE code_verifier(与 code 同一次会话)。 */
  codeVerifier: string;
  /** 发起授权时用的回调地址;必须与 authorize 请求逐字一致。 */
  redirectUri: string;
}

/** POST /oidc/callback 响应 —— 与旧 /user/login 同构(token + userId),外加落地方式字段。 */
export interface OidcCallbackResult {
  token: string;
  userId: number;
  email: string;
  username: string;
  nickname: string;
  /** 认证中心内的用户标识(id_token.sub),仅作辅助定位。 */
  sub: string;
  idpIssuer: string;
  /** true = 认证中心给的邮箱本系统没有,本次自动建了本地账号。 */
  provisioned: boolean;
  /** true = 第一次见这个外部身份,新建了 (issuer,sub) 绑定。 */
  identityBound: boolean;
  /** true = 该外部身份原本绑在别的本地账号上,本次按邮箱改绑。 */
  rebound: boolean;
}

/** GET /default-group —— 当前默认工作空间;groupId=0 表示未设置。 */
export interface DefaultGroupInfo {
  groupId: number;
  name: string;
  myRole: GroupRole;
}
