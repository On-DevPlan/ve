import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'user-space',
  name: 'UserSpace',
  title: '用户空间',
  description: '工作空间（group）/ 成员 / 邀请 / 默认组切换 的可视化管理;KV 库存只读快照。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '工具',
  category: '账号',
  tags: ['workspace', 'group', 'rbac', 'invitation', 'kv'],
  platform: 'both',
  status: 'stable',
  route: { path: '/components/user-space', title: '用户空间' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { fullscreen: false, resizable: false },
} satisfies ComponentConfig;
