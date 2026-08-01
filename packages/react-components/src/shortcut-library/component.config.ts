import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'shortcut-library',
  name: 'ShortcutLibrary',
  title: '快捷键库',
  description: '按应用分组管理键盘快捷键:增删改查、查询与可视化预览,数据本地持久化。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '效率',
  category: '快捷键管理',
  tags: ['shortcut', 'keyboard', 'productivity', 'localstorage'],
  platform: 'pc',
  status: 'stable',
  route: { path: '/components/shortcut-library', title: '快捷键库' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { fullscreen: false, resizable: false },
  // 组件级 dev 依赖:挂载到 shortcut-library 详情页时,/api 才会被 vite 代理
  // 到 :8080。其他组件(car-battle 等)不触发,完全不占用 dev server 路径。
  api: [
    {
      context: '/api',
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  ],
} satisfies ComponentConfig;
