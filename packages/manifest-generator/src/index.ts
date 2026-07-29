// manifest-generator 包对外入口。
// 上层(apps/showcase、build pipeline)通过 "@style-library/manifest-generator"
// 这个 workspace alias 取 manifestPlugin(以及 scanner/generator 的构建期能力)。
//
// 不导出 validateConfig:那是 component-contract 的职责。

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
