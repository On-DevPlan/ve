// api/components/shortcut-library/createShortcutStore.ts —— 快捷键库的持久化封装。
//
// 职责:把整个 group+shortcut 库作为单个 JSON 字符串,委托给 user-space
// 组件的 getShortcuts / setShortcuts 业务方法存取。组件不直接接触 kvV1Service,
// 也不感知 user-space 的 key/tags/groupId 协议。
//
// 为什么 import 走相对路径 '../../user-space' 而不是 '@api':
//   '@api' 解析到 api/index.ts,而 index.ts 又 `export * from './components'`
//   —— 本文件正在 components 里,形成 self-cycle(index → components →
//   createShortcutStore → index)。ESM 循环虽然能靠 hoisting 侥幸跑通,但
//   求值顺序取决于谁先被 import,一旦有人在 index 顶层加副作用就会拿到
//   undefined。**目录内部一律走相对路径,'@api' 只留给 src/api/ 外部调用方。**

import { jwtAuth } from '../../http/auth-store';
import { createUserSpaceStore } from '../user-space';
import type { ShortcutsBlob } from '../user-space/types';

/** shortcut-library 持久化的极简契约 —— 整个库一次性读写。 */
export interface ShortcutStoreLite {
  load(): Promise<ShortcutsBlob>;
  save(groups: ShortcutsBlob): Promise<void>;
  /** 登录态条显示用;user-space 场景返回 'logged-in' 让 UI 显示已登录。 */
  readonly authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
}

/**
 * 建一个 shortcut-library 持久化实例。
 *
 * 两个方法都是**独立闭包**,不依赖 `this` —— 因为调用方常这样用:
 *   const { load, save } = createShortcutStore();
 * 如果内部写 `this.load()`,解构后 `this` 是 undefined,运行时崩。
 */
export function createShortcutStore(): ShortcutStoreLite {
  const userSpace = createUserSpaceStore();

  async function load(): Promise<ShortcutsBlob> {
    if (!jwtAuth.state.token) return [];
    return userSpace.getShortcuts();
  }

  async function save(groups: ShortcutsBlob): Promise<void> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
    await userSpace.setShortcuts(groups);
  }

  return { load, save, authState: 'logged-in' };
}
