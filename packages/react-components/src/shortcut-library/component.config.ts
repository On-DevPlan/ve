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
  // 目前 dev 与 prod 都指向生产后端 —— 本地不必再起 `go run .`,开箱即可调。
  //
  // ⚠️ 代价:本地 `pnpm dev` 的写操作直接落到**生产数据库**。加分组、删分组
  // 都是真实数据,没有回滚。要隔离时把 dev 改回 'http://localhost:8080' 并
  // 在本地起后端 —— 契约本来就支持分环境,这里只是当前选择让两端一致。
  //
  // 注意 target 仍必须保留 { dev, prod } 形态而不能简写成单个 string:
  // 简写意味着"两端共用一个后端"是**永久语义**,而这里是临时取值相同。写成
  // string 后将来要拆分环境,得先改回对象形态,反而丢了意图。
  api: [
    {
      context: '/api',
      target: {
        dev: 'http://47.110.80.47:8988',
        prod: 'http://47.110.80.47:8988',
      },
      changeOrigin: true,
    },
  ],
} satisfies ComponentConfig;
