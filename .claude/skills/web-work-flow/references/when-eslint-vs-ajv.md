---
ref: when-eslint-vs-ajv
parent: eslint-rule-authoring
---

# 何时用 ESLint 规则 vs ajv schema

wb 项目里有两套校验机制,各自负责不同性质的事。**写错地方** = 校验不全或误报。

## ajv schema(已在用)

文件:`packages/component-contract/src/component-config.schema.json` + `validate-config.ts`

构建期(`scanner.ts` 扫 component.config.ts 时)跑一次,**失败直接抛错不产 manifest**。

## ESLint 规则(自定义)

文件:`eslint/rules/*.js`,在 `pnpm lint` 时跑。**提供编辑器实时反馈**(vscode + ESLint 插件给红线)。

## 决策表

| 约束性质 | 用 ajv | 用 ESLint | 例子 |
|---|---|---|---|
| 字段类型(string / number / object) | ✅ | ❌ | `id: string` |
| 字段必填 | ✅ | ❌ | `version` 必填 |
| 枚举 | ✅ | ❌ | `framework: 'vue' \| 'react'` |
| 字符串格式(SemVer / URL) | ✅ | ❌ | `version: '1.0.0'` |
| 数值范围 | ✅ | ❌ | 暂无 |
| 字段值与**文件名/目录名**一致 | ❌ | ✅ | `id` = 目录名 |
| 字段值与**所在包**一致 | ❌ | ✅ | `framework: 'vue'` 但目录在 `react-components/` |
| 字段值与**路由约定**一致 | ❌ | ✅ | `route.path === '/components/<id>'` |
| 命名约定 / 类名模式 | ❌ | ✅ | 类名 `sl-` 前缀 |
| 文件结构约束 | ❌ | ✅ | 必须有 `index.tsx` |
| 跨多个 config 的一致性 | ❌ | ⚠️(需要 state) | 所有 `id` 唯一 |
| 必须有 `export default { ... }` | ❌ | ✅ | TS 结构校验,ajv 不感知 |

## 关键区别

- **ajv 只看数据**,ESLint 看 AST + 文件名 + 跨文件关系。
- ajv 在 build 时一次性跑。ESLint 在编辑器每次保存跑(快反馈)+ `pnpm lint` 时跑。
- ajv schema 改了,影响**所有配置文件的合法性**。ESLint 规则改了,只影响**新一次 lint**。

## 经验法则

> **字段本身的合法性 → ajv。字段与外部世界的一致性 → ESLint。**

如果你想校验"`id` 必须是 kebab-case"——ajv 已经有 regex 了,你不需要写 ESLint。
如果你想校验"`id` 必须等于目录名"——ajv 做不到,写 ESLint。

## 同时存在时

ajv 和 ESLint 可以**叠加**校验同一字段。`valid-component-config` 校验 `id === 目录名`,ajv 同时校验 `id` 是 string + kebab-case。**两层不冲突**——前者关心"对的文件",后者关心"对的格式"。

## 不要做的事

- ❌ 在 ESLint 里校验字段类型(string/number)——重复 ajv,且 ESLint AST 里类型是推断的,实现复杂
- ❌ 在 ajv 里校验与文件系统结构的一致性——ajv 拿不到 `context.getFilename()`
- ❌ 让 ESLint 规则触发**自动修复**(`fixable: 'code'`)除非真的安全——误修可能破坏配置文件
- ❌ 在 ESLint 规则里做**跨多个文件的状态聚合**(`Program.exit` 收集所有 visitor 的违规然后统一报)——ESLint 规则应该是单文件 stateless 的,跨文件逻辑用 lint 摘要脚本或 ajv