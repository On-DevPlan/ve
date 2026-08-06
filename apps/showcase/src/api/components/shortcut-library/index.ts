// services/shortcut-library/index.ts —— shortcut-library 持久化 barrel。
//
// 收 createShortcutStore,跟 userV1/、kvV1/ 同构。index.ts 让 services/index.ts
// 顶部能 `export * from './shortcut-library'`,也让外部
// `import { createShortcutStore } from '@/api/services/shortcut-library'`
// 走 Node 的目录 index 解析。
//
// 域类型 Group/Shortcut/KeyStroke 现在收在 user-space 的 barrel(per-component
// contract 跟着 KV 管家走,避免两边都定义同名类型触发 export collision)。

export * from './createShortcutStore';
