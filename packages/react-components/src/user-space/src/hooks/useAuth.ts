// src/hooks/useAuth.ts —— host jwtAuth 跨框架桥(组件不重实现)。
// 组件需要的所有登录态 / 实例化方法都来自 host 的 jwtAuth 单例。

export { useJwtAuth, getJwtAuthSnapshot, jwtAuth } from '@/api/http/auth-store';
export type { JwtAuthStatus } from '@/api/http/auth-store';
