// game-skin-admin 组件的 config（对应 spec §4.1 ComponentConfig）。
//
// 由 chess-skin-admin 泛化而来：id / route / tags / description 扩展为
// 多游戏；查询参数 game 声明在 route.query 上，支持 ?game=gomoku deep-link。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'game-skin-admin',
  name: 'GameSkinAdmin',
  title: '游戏皮肤管理',
  description:
    '跨游戏皮肤管理（chess 12 枚 + gomoku 黑/白/棋盘）；按各游戏 KV public *_skin:index 管理，游戏切换器 + ?game=gomoku deep-link。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '管理工具',
  category: '内容管理',
  tags: ['chess', 'gomoku', 'skin', 'kv', 'admin', 'ai-prompt', 'game-skin'],
  platform: 'both',
  status: 'stable',
  route: {
    path: '/components/game-skin-admin',
    title: '游戏皮肤管理',
    keepAlive: false,
    query: {
      game: { type: 'string', required: false, default: 'chess' },
    },
  },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
