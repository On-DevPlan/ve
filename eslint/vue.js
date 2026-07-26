// Vue 3 + script-setup 规则层。
// 仅对 .vue 单文件组件生效;模板使用 vue-eslint-parser,
// <script lang="ts"> 使用 typescript-eslint 解析。

import vue from 'eslint-plugin-vue'; // Vue 官方插件
import vueParser from 'vue-eslint-parser'; // 解析 .vue SFC 的 parser
import tseslint from 'typescript-eslint'; // <script lang="ts"> 的解析器

export default [
  // 引入 Vue flat config 推荐集
  ...vue.configs['flat/recommended'],
  // 立即覆盖 deprecated 的 vue/component-tags-order:它在 eslint-plugin-vue 9.x
  // 被标记 deprecated / replacedBy=['block-order'],但 flat/recommended 仍将其启用,
  // 导致 ESLint 给每个文件都生成 usedDeprecatedRules 噪声。这里关闭它;等价检查
  // 由 flat/recommended 里同等级别的 vue/block-order 提供,关闭不会丢检查。
  // 放在根级(无 files 限定)是必须的——ESLint 计算 usedDeprecatedRules 用的是合并后的
  // 顶层 config.rules,只对 .vue 段关闭对 .ts 类型的文件不起作用。
  { rules: { 'vue/component-tags-order': 'off' } },
  {
    // 仅作用于 .vue 单文件组件
    files: ['**/*.vue'],
    languageOptions: {
      // SFC parser 把 <template> 与 <script> 分开解析
      parser: vueParser,
      parserOptions: {
        // <script lang="ts"> 内嵌 TypeScript
        parser: tseslint.parser,
        // 告诉 parser 还有 .vue 这种扩展名要处理
        extraFileExtensions: ['.vue'],
      },
    },
    // 仓库对 Vue 的具体约束
    rules: {
      // 关闭"组件名必须多词"——展示中心大量单字组件(如 Button、Card)
      'vue/multi-word-component-names': 'off',
      // 强制 <script setup> 与 composition API 写法
      'vue/component-api-style': ['error', ['script-setup', 'composition']],
      // 模板里组件名必须是 PascalCase
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      // prop 名必须是 camelCase
      'vue/prop-name-casing': ['error', 'camelCase'],
      // 模板必须有且只有一个根节点
      'vue/no-multiple-template-root': 'error',
      // 计算属性必须有返回值
      'vue/return-in-computed-property': 'error',
      // 模板中 import 但未使用的组件必须删除
      'vue/no-unused-components': 'error',
    },
  },
  {
    // 测试 fixture 文件放宽单行 HTML 元素换行规则
    // 让 fixture 写得紧凑,便于阅读
    files: ['eslint/__tests__/fixtures/**'],
    rules: {
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
];