// game-skin-admin 组件的 config（对应 spec §4.1 ComponentConfig）。
//
// 游戏资产管理：对局皮肤 + 游戏封面 + 表情包（原 emoji-pack-admin 已迁入）。
// 深链：?game=gomoku / ?tab=covers / ?tab=emoji&scope=common

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'game-skin-admin',
  name: 'GameSkinAdmin',
  title: '游戏资产管理',
  description:
    '游戏资产管理：对局皮肤（chess/gomoku）、游戏封面、表情包（common/<gameId>）；KV public groupId 190；深链 ?game / ?tab=covers|emoji&scope=。',
  version: '1.1.0',
  framework: 'vue',
  entry: './index.vue',
  group: '管理工具',
  category: '内容管理',
  tags: ['chess', 'gomoku', 'skin', 'emoji', 'cover', 'kv', 'admin', 'game-skin'],
  platform: 'both',
  status: 'stable',
  route: {
    path: '/components/game-skin-admin',
    title: '游戏资产管理',
    keepAlive: false,
    query: {
      game: { type: 'string', required: false, default: 'chess' },
      tab: { type: 'string', required: false, default: 'games' },
      scope: { type: 'string', required: false, default: 'common' },
    },
  },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
