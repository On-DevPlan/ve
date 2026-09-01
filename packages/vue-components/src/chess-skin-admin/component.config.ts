// chess-skin-admin 组件的 config(对应 spec §4.1 ComponentConfig)。
//
// 字段名 / 类型严格对齐 packages/component-contract/src/types.ts —— 改字段名
// 会导致 manifest 校验失败、ESLint 规则 style-library/valid-component-config 报错。
//
// 后端契约:
//   - KV key  chess_skin:index  value = JSON 数组（每元素一套 skin meta）
//   - groupId 190（shared 公共组）；file 在各自用户默认组（add_skin.py 没显式指定）
//   - tags 维度对齐后端 tag facet（详见 fr/.claude/skills/chess-skin-pipeline）
//
// 鉴权:dev+prod 都可见，按 KvItem.myRole === 'owner' 决定修改 UI 的可见性，
// 后端按 groupId=190 的角色兜底校验。

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'chess-skin-admin',
  name: 'ChessSkinAdmin',
  title: '国际象棋皮肤管理',
  description:
    '上传、预览、替换国际象棋皮肤图片（12 张 webp / png）；按后端 KV public chess_skin:index 管理；生成 AI 提示词辅助批量生产 meta JSON。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '管理工具',
  category: '内容管理',
  tags: ['chess', 'skin', 'kv', 'admin', 'ai-prompt'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/chess-skin-admin', title: '国际象棋皮肤管理', keepAlive: false },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: false, fullscreen: true, fullscreenMode: 'container' },
} satisfies ComponentConfig;
