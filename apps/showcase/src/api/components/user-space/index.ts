// api/components/user-space/index.ts —— user-space 业务封装 barrel。
//
// 收 createUserSpaceStore + 域类型,跟 shortcut-library 同构。
// 组件层 import from '@api/components/user-space' 拿全部。
//
// hasMinRole / ROLE_RANK 从 services/groupV1 透传一份,方便组件页面直接
// `import { hasMinRole } from '@api/components/user-space'`(RBAC 闸门用)。

export { hasMinRole, ROLE_RANK } from '../../services/groupV1';
export * from './types';
export * from './createUserSpaceStore';
