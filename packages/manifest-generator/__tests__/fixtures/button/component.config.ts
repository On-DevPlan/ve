// 测试 fixture:Vue 组件 button 的 component.config.ts。
// 用作 manifest-generator scanner 与 generator 的"最小合法"样例。
// 字段故意保持最少,以便 generator 的"补全默认字段(route / isolation)"逻辑
// 有真实数据可以走。

import type { ComponentConfig } from '@style-library/component-contract'; // 类型导入
export default {
  id: 'button', // 组件 id
  name: 'Button', // 技术名称
  title: '按钮', // 卡片标题
  description: '基础按钮', // 简介
  version: '1.0.0', // SemVer
  framework: 'vue', // 框架
  entry: './index.vue', // 实现入口(相对本文件)
  group: '基础', // 一级分组
  category: '交互', // 二级分类
  tags: ['button'], // 检索标签
  mount: { kind: 'vue' }, // 挂载配置
  // route 不补 isolation 时,generator 会自动补 isolation.mode = 'shadow-dom'
  route: { path: '/components/button', title: '按钮' },
} satisfies ComponentConfig; // 用 satisfies 校验形状但不丢失字面量类型