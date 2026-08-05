// manifest-generator 包对外入口。
// 上层(apps/showcase、build pipeline)通过 "@style-library/manifest-generator"
// 这个 workspace alias 取 manifestPlugin(以及 scanner/generator 的构建期能力)。
//
// 不导出 validateConfig:那是 component-contract 的职责。
//
// 历史说明:本包曾包含 mfe-dynamic-proxy (dev 组件级 proxy) + nginx-emit
// (prod nginx 生成器),它们构成"组件级 API 代理"方案。
// apps/showcase 自 2026-08 起切到 apiGateway + registry.ts 单一事实源后,
// 这两文件已被删除。如果还有组件 config 的 api 字段残留,
// 见 apps/showcase/src/api/registry.ts 与 apps/showcase/src/api/gen-nginx.ts。
//
// ComponentConfig.api 字段本身仍在 @style-library/component-contract
// 类型定义里(@deprecated 标注),保留是为了外部 schema 兼容性,后续移除。

// 透传 scanner 的扫描函数与类型
export * from './scanner.ts';
// 透传 generator 的生成函数与类型
export * from './generator.ts';
// 透传 vite 插件(工厂函数 + 选项类型)
export * from './vite-plugin.ts';
// 透传 loader-inventory(对账的 loader 扫描侧)
export * from './loader-inventory.ts';
// 透传 reconcile(对账器 + 报告类型)
export * from './reconcile.ts';
