// 运行时校验:用 ajv 校验 ComponentConfig 是否符合 component-config.schema.json。
// 对应 spec §11.1"构建与协议测试"里的"config schema 合法/非法样例"。
//
// 设计要点:
//   - ajv 实例化一次 + compile 一次,模块加载时就把验证器准备好
//     这样调用 validateConfig() 时不需要每次都重新编译 schema
//   - allErrors:true  —— 一次性收集全部错误,而不是"遇到第一个就停"
//     构建期友好,作者一次能看到所有要修的字段
//   - strict:false      —— schema 里用了 union / nullable 等比较宽松的写法,
//     关掉 strict 避免 ajv 自身的元约束报错

import Ajv from 'ajv'; // JSON Schema 校验器
import componentConfigSchema from './component-config.schema.json' with { type: 'json' }; // ComponentConfig 的 schema

// 初始化 ajv 实例
// allErrors:true —— 收集所有错误
// strict:false   —— 允许比较宽松的 schema 写法
const ajv = new Ajv({ allErrors: true, strict: false });
// 把 schema 编译成校验函数,模块加载时执行一次,后续直接调用 validate()
const validate = ajv.compile(componentConfigSchema);

// 校验结果
//   - ok:true  —— 通过
//   - ok:false —— 失败,errors 是 ajv 错误数组(形状由 ajv 决定,这里用 unknown[])
export interface ValidationResult {
  ok: boolean;
  errors?: unknown[];
}

// 对外暴露的校验入口
// 入参是 unknown,这样调用方必须先把自己的数据断言成 unknown 再传入,
// 强制经过 schema 校验,避免"看起来对但实际字段错了"漏过
export function validateConfig(config: unknown): ValidationResult {
  // ajv 返回 true/false;成功时只回 ok,失败时把 errors 一并带回
  const ok = validate(config);
  // ajv 8 的 errors 类型是 ErrorObject[] | null | undefined;
  // ValidationResult.errors 是 optional unknown[],要把 null/undefined 收掉
  if (ok) return { ok: true };
  const errs = validate.errors ?? [];
  return { ok: false, errors: errs };
}