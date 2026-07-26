// component-contract 包对外的入口。
// 通过 "@style-library/component-contract" 这个 workspace alias,
// 其它包(manifest-generator / mount-adapters / showcase)从这里取类型与校验函数。
//
// 导出内容:
//   1) 全部类型 —— 通过 './types.ts' 的 export * 透传
//   2) validateConfig() —— ajv 包装的运行时校验函数(内部直接消费 schema)
//
// JSON Schema 文件由 validate-config.ts 内部直接 import,不再对外 re-export
// (没有外部消费者,且暴露会扩大需要维护的公开 API 面)。

// 透传所有类型导出 —— ComponentConfig / ManifestEntry / MountAdapter 等
export * from './types.ts';
// 重新导出 validateConfig 函数与 ValidationResult 类型,便于其它包直接 import
export * from './validate-config.ts';
