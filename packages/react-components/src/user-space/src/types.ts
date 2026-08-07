// src/types.ts —— user-space 组件域类型(从 api/components 透传一份给 UI 内部用,
// 避免组件 import 跨包深路径)。

export type { GroupRole, GroupSummary, GroupMemberView, GroupInvitationView, ViewMode } from '@api/components/user-space';
export type { KvListResult, KvView } from '@api/components/user-space';
