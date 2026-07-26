// Node / 工具脚本规则层。
// 针对仓库内的工具与脚本目录放宽某些通用规则,
// 因为这些目录默认会有 console.log 等"调试意图"调用。

// 默认导出空注解以满足编辑器提示——本文件没有 import
export default [
  {
    // 这些目录默认会有 console.log(脚本就是给人看日志的)
    files: [
      'packages/manifest-generator/**/*.ts', // 构建期 manifest 生成器
      'packages/mount-adapters/**/*.ts', // 组件挂载适配层
      'scripts/**/*.{js,mjs}', // 仓库级脚本
      'eslint/**/*.js', // ESLint 配置自身
      'eslint/**/*.{js,mjs}',
    ],
    rules: {
      // 关掉 no-console:这些目录就是要输出日志的
      'no-console': 'off',
    },
  },
];