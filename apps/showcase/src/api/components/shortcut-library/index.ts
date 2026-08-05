// services/shortcut-library/index.ts —— shortcut-library 持久化 barrel。
//
// 收 createShortcutStore 和 Group/Shortcut/KeyStroke 域类型,跟 userV1/、kvV1/
// 同构。index.ts 让 services/index.ts 顶部能 `export * from './shortcut-library'`,
// 也让外部 `import { createShortcutStore } from '@/api/services/shortcut-library'`
// 走 Node 的目录 index 解析。

export * from './types';
export * from './createShortcutStore';
