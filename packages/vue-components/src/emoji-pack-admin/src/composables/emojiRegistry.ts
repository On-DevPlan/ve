// emojiRegistry.ts — scope 维度的表情包管线注册表
//
// 与 fr 侧 lib/core/game_kit/emoji/emoji_pack_meta.dart 派生规则一一对应：
//   KV key   = emoji_<scope>:index   (scope = common | <gameId>)
//   tagPrefix= <scope>-emoji
//   file tags 二级：[tagPrefix, `${tagPrefix}:${emojiId}`]
//   groupId  = 190（全游戏共享，与 GameSkinSpec.kGroupId 一致）
//
// 语义：open-set list（非固定 12 宫格），资产集合长度可变；
// scope 维度的"游戏"复用 game-skin-admin 的 GAME_SKIN_REGISTRY 的 gameId 集合。

import { GAME_SKIN_REGISTRY } from '../../../game-skin-admin/src/composables/gameSkinRegistry';

const SHARED_GROUP_ID = 190;

export interface EmojiScopeEntry {
  /** scope 原串：'common' 或某个 gameId（如 'chess'） */
  scope: string;
  /** 展示名（scope 切换器标签） */
  displayName: string;
  /** KV 索引 key：`emoji_<scope>:index` */
  kvIndexKey: string;
  /** 文件/KV 公共 tag 前缀：`<scope>-emoji` */
  tagPrefix: string;
  /** KV public 共享组（全 scope 190） */
  groupId: number;
}

export function kvIndexKeyForScope(scope: string): string {
  return `emoji_${scope}:index`;
}

export function tagPrefixForScope(scope: string): string {
  return `${scope}-emoji`;
}

export function emojiTags(scope: string, emojiId: string): string[] {
  const p = tagPrefixForScope(scope);
  return [p, `${p}:${emojiId}`];
}

export function resolveEmojiScopeEntry(scope: string): EmojiScopeEntry {
  const key = EMOJI_SCOPE_REGISTRY[scope] ? scope : 'common';
  return EMOJI_SCOPE_REGISTRY[key]!;
}

export function isSupportedEmojiScope(scope: string): boolean {
  return scope in EMOJI_SCOPE_REGISTRY;
}

/** 单一事实源：scope → EmojiScopeEntry。derived from GameSkinRegistry + common。 */
export const EMOJI_SCOPE_REGISTRY: Record<string, EmojiScopeEntry> = (() => {
  const out: Record<string, EmojiScopeEntry> = {};
  // common 永远第一项（置顶）
  out.common = {
    scope: 'common',
    displayName: '通用',
    kvIndexKey: kvIndexKeyForScope('common'),
    tagPrefix: tagPrefixForScope('common'),
    groupId: SHARED_GROUP_ID,
  };
  for (const [gameId, entry] of Object.entries(GAME_SKIN_REGISTRY)) {
    out[gameId] = {
      scope: gameId,
      displayName: entry.displayName,
      kvIndexKey: kvIndexKeyForScope(gameId),
      tagPrefix: tagPrefixForScope(gameId),
      groupId: SHARED_GROUP_ID,
    };
  }
  return out;
})();

export const SUPPORTED_EMOJI_SCOPES: readonly string[] = Object.keys(EMOJI_SCOPE_REGISTRY);
