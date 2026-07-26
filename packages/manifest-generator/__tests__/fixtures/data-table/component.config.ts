// 测试 fixture:React 组件 data-table 的 component.config.ts。
// 与 button fixture 配对,验证 scanner 能扫到多个不同 framework 的组件,
// 也验证 generator 的 groupMap 能正确跨 framework 聚合分组。

import type { ComponentConfig } from '@style-library/component-contract';
export default {
  id: 'data-table',
  name: 'DataTable',
  title: '数据表格',
  description: '通用数据表格',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据展示', // 与 button 不同 group,验证 groups.length
  category: '表格',
  tags: ['table', 'data'],
  mount: { kind: 'react' },
  route: { path: '/components/data-table', title: '数据表格' },
} satisfies ComponentConfig;