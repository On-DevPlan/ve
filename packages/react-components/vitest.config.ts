// react-components 包的 vitest 配置。
// 组件测试会 import 到 showcase 的 api 模块(`@api/...` / `@/...`),
// tsconfig 的 paths 只对类型检查生效、apps/showcase/vite.config.ts 的
// alias 只在应用构建时生效,这里与两者对齐,让 vitest 运行时也能解析。
// 刻意不设置 test.environment:各测试文件用 `// @vitest-environment` 自行声明。
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const showcaseSrc = fileURLToPath(new URL('../../apps/showcase/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // 注意顺序:长匹配在前。find 是前缀匹配,`@api/` 先于 `@api`,
      // 否则 `@api/components/...` 会被 `@api` 误吞成 `.../api/index/components/...`。
      // 不带尾斜杠的裸 `@` 有踩 scoped 包名的风险(`@scope/pkg` 也以 @ 开头),
      // 这里不注册,`@/` 已覆盖实际用到的 `@/...` 导入。
      { find: '@api/', replacement: `${showcaseSrc}/api/` },
      { find: '@api', replacement: `${showcaseSrc}/api/index` },
      { find: '@/', replacement: `${showcaseSrc}/` },
    ],
  },
});
