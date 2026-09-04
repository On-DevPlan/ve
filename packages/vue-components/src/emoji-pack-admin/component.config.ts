// emoji-pack-admin 组件的 config（对应 spec §4.1 ComponentConfig）。
//
// 与 fr 侧 lib/core/game_kit/emoji/emoji_pack_meta.dart 派生规则一一对应：
//   KV key = emoji_<scope>:index   (scope = common | <gameId>)
//   tag    = <scope>-emoji
//   file key = emoji/<scope>/<emojiId>（fileV1 tags 二级）
// ve 端单组件 + scope 切换器，不再为每游戏新建目录。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'emoji-pack-admin',
  name: 'EmojiPackAdmin',
  title: '表情包管理',
  description:
    '跨游戏表情包管理（KV public emoji_<scope>:index，scope = common | <gameId>）；开放集合，上/删/排序，scope 切换器 + ?scope deep-link。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '管理工具',
  category: '内容管理',
  tags: ['emoji', 'kv', 'admin', 'game-kit', 'emoji-pack'],
  platform: 'both',
  status: 'stable',
  route: {
    path: '/components/emoji-pack-admin',
    title: '表情包管理',
    keepAlive: false,
    query: {
      scope: { type: 'string', required: false, default: 'common' },
    },
  },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
