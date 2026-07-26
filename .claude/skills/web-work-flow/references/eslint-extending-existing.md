---
ref: extending-existing
parent: eslint-rule-authoring
---

# 扩展现有规则(`valid-component-config`)

当需要加新的校验项(比如 `theme.requiredTokens` 必填 / `isolation.mode` 枚举)时,有 3 种扩展方式。**选错会破坏现有组件**。

## 3 种扩展方式

### 方式 1: 加新 messageId 到现有规则(推荐 80% 情况)

如果新校验和现有规则**作用域相同**(都是 `component.config.ts` 字段与文件系统一致性),直接加 `messages` + visitor。

```js
// eslint/rules/valid-component-config.js
meta: {
  messages: {
    // 已有
    idMismatch: '...',
    // 新增
    themeNamespaceFormat: '`theme.namespace` must be kebab-case, got "{{actual}}".',
  },
},

create(context) {
  // ...
  return {
    Program(ast) {
      // ... 提取 fields map
      const themeFields = fields.theme;
      if (themeFields && themeFields.type === 'ObjectExpression') {
        const themeMap = getFieldMap(themeFields);
        const ns = literalString(themeMap.namespace);
        if (ns && !/^[a-z][a-z0-9-]*$/.test(ns)) {
          context.report({
            node: themeMap.namespace,
            messageId: 'themeNamespaceFormat',
            data: { actual: ns },
          });
        }
      }
    },
  };
}
```

**优点**: 复用同一触发条件、复用 AST 提取代码、单一规则单一 messageId 集合。
**缺点**: 规则会随时间膨胀。

### 方式 2: 新建独立规则

如果新校验是**完全不同的关注点**(比如"类名必须 `sl-` 前缀"——作用于 `index.vue`,不是 `component.config.ts`),建独立规则。

```js
// eslint/rules/css-class-prefix.js
// 针对 *.vue / *.css 文件
// 不同 filename 触发,不同 AST,不同 messageId
```

**优点**: 单一职责、规则可以独立开关。
**缺点**: 配置分散。

### 方式 3: 加 ajv schema

如果新校验是"字段类型 / 必填 / 枚举 / 格式"(纯数据合法性),加 JSON schema 字段约束,不要写 ESLint。

参考 `eslint-rule-authoring` skill 主文档的判断框架。

## 选哪种

| 新校验性质 | 用方式 |
|---|---|
| 仍是 component.config.ts 字段,且与文件/包/路由相关 | **方式 1**(加到 `valid-component-config`) |
| 是完全不同文件的约束(比如 index.vue 内部) | **方式 2**(新规则) |
| 纯字段类型/必填/枚举/SemVer | **方式 3**(加 ajv) |

## 加 messageId 时的检查清单

- [ ] 在 `meta.messages` 加新 id 和模板
- [ ] 在 visitor 里检测 + `context.report({ messageId: '新id', data: {...} })`
- [ ] 在测试 `eslint/__tests__/valid-component-config.test.mjs` 加合法 + 非法用例
- [ ] 跑 `pnpm exec vitest run eslint/__tests__/valid-component-config.test.mjs`
- [ ] 跑 `pnpm lint` 看现有 component.config.ts 不会误报
- [ ] 如果校验涉及新文件类型,更新 `if (!/<pattern>/.test(filename)) return {}` 的正则

## 不要做的事

- ❌ 不要把"类名约定"塞到 `valid-component-config`——它是针对 `component.config.ts` 的,不是针对 `index.vue` 的
- ❌ 不要让一条规则触发多种 file pattern(用 `files` 配置而不是 filename 判断)
- ❌ 不要在已有 messageId 上改文案——会破坏其它依赖 messageId 的代码(虽然没有,但保持契约稳定)
- ❌ 不要加 `fixable: 'code'` 自动修复——除非你 100% 确定自动修复的字符串是安全的(对 component.config 这种用户写的文件,自动修可能引入新错)

## 测试样板:加新 messageId

```js
// 在 describe('valid-component-config') 里加
it('flags theme.namespace format', () => {
  ruleTester.run('valid-component-config', rule, {
    valid: [
      {
        filename: 'packages/vue-components/src/foo/component.config.ts',
        code: `export default {
          id: 'foo', framework: 'vue',
          route: { path: '/components/foo' },
          theme: { namespace: 'sl' },
        } satisfies ComponentConfig;`,
      },
    ],
    invalid: [
      {
        filename: 'packages/vue-components/src/foo/component.config.ts',
        code: `export default {
          id: 'foo', framework: 'vue',
          route: { path: '/components/foo' },
          theme: { namespace: 'SL_INVALID' },
        };`,
        errors: [{ messageId: 'themeNamespaceFormat' }],
      },
    ],
  });
  expect(true).toBe(true);
});
```

## messageId 命名约定

wb 项目里现有 messageId 用 camelCase + 名词性:
- `noDefaultExport`(动名词短语)
- `idMismatch`(X + Y 关系)
- `frameworkMismatch`
- `routePathPrefix`
- `routePathIdMismatch`

新加的保持同样风格。