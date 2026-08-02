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
  // 组件级 dev 依赖 + 生产路由的**唯一事实源**:
  //   dev  → mfeDynamicProxy 读这里 → 挂载本组件时 /api 才被代理到 target.dev
  //   prod → scripts/gen-nginx.mjs 读这里 → 生成 nginx location 到 target.prod
  // 两端共用 normalizeApi(),所以本地能跑就等于线上能跑。
  //
  // target 必须分环境:dev 的 localhost:8080 是开发机上 `go run .` 的进程,
  // 这个值印进生产 nginx 后,在容器里 localhost 是容器自身回环 → 502。
  api: [
    {
      context: '/api',
      target: {
        dev: 'http://localhost:8080',
        prod: 'http://47.110.80.47:8988',
      },
      changeOrigin: true,
    },
  ],
} satisfies ComponentConfig;
