---
ref: pattern-recipes
parent: eslint-rule-authoring
---

# AST 处理模式 + filename 处理样板

基于 `valid-component-config.js` 提炼,wb 项目加新规则的常用模式。

---

## 模式 1: 文件名匹配触发

只对特定文件生效(比如 `component.config.ts`)。

```js
create(context) {
  const filename = context.getFilename();
  // 用 regex 匹配文件名;Windows 路径可能是 \ 或 /
  if (!/(^|[\\/])component\.config\.ts$/.test(filename)) return {};

  // 否则返回正常 visitor
  return { Program(ast) { ... } };
}
```

**关键**:
- 返回空 `{}` 让 ESLint 跳过该文件
- 同时匹配 `/` 和 `\`(Windows)
- 用 `[\\/]` 在字符类里转义反斜杠

---

## 模式 2: 取所在目录名作为期望值

```js
function expectedIdFromPath(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const dir = path.posix.dirname(normalized);
  return path.posix.basename(dir);
}
```

**关键**:
- 路径规范化后再 split,避免 Windows 反斜杠
- 用 `path.posix.*` 强制 POSIX 分隔符(跨平台一致)

---

## 模式 3: 检测所在包

```js
function detectFrameworkFromPath(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const m = normalized.match(/\/(vue|react)-components\//);
  return m ? m[1] : null;
}
```

---

## 模式 4: 解包 `export default { ... }` + `satisfies`

`component.config.ts` 通常是:
```ts
export default { id: 'foo' } satisfies ComponentConfig;
```

AST 结构(typescript-eslint parser):
- `ExportDefaultDeclaration`
  - `declaration`: `TSSatisfiesExpression`
    - `expression`: `ObjectExpression`
      - `properties`: `Property[]`

```js
function unwrapObject(node) {
  if (!node) return null;
  if (node.type === 'ObjectExpression') return node;
  if (node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression') {
    return unwrapObject(node.expression);
  }
  return null;
}

// 用法
Program(ast) {
  const body = ast.body || [];
  const defaultExport = body.find(n => n.type === 'ExportDefaultDeclaration');
  if (!defaultExport) {
    context.report({ node: ast, messageId: 'noDefaultExport' });
    return;
  }
  const objectNode = unwrapObject(defaultExport.declaration);
  if (!objectNode) {
    context.report({ node: defaultExport, messageId: 'noDefaultExport' });
    return;
  }
  // ... 校验 objectNode
}
```

---

## 模式 5: 从 ObjectExpression 提取字段

```js
function getFieldMap(objectNode) {
  const map = {};
  for (const prop of objectNode.properties) {
    if (prop.type !== 'Property') continue;  // 跳过 SpreadElement
    const keyNode = prop.key;
    const key =
      keyNode.type === 'Identifier' ? keyNode.name :
      keyNode.type === 'Literal' ? String(keyNode.value) : null;
    if (!key) continue;
    map[key] = prop.value;
  }
  return map;
}
```

**关键**:
- `key` 可能是 `Identifier`(普通字段名)或 `Literal`(带引号的字段名 / 计算属性)
- 跳过 `SpreadElement`(`...spread`)
- 返回 `Record<key, AST node>`,值是字面量或子对象

---

## 模式 6: 字符串字面量提取

```js
function literalString(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}
```

如果节点不是字符串字面量,返回 `undefined` 让调用方报"必须是字面量"的错。

---

## 模式 7: 报告节点选择

| 错误类型 | 报告节点 | 高亮范围 |
|---|---|---|
| 字段类型错 | `idNode`(字段值节点) | 那个值 |
| 字段值与目录不一致 | `idNode` | 那个值 |
| 缺必填字段 | `objectNode` 或具体字段 | 整个对象 / 那个字段 |
| 缺 `export default` | `ast` 或 `defaultExport` | 整个文件 / 那一行 |

**经验**:`context.report({ node: X, messageId, data })` 里 `node` 决定 ESLint 编辑器下划线在哪。把节点选到具体出错的位置最有用。

---

## 完整样板:字段必须等于目录名

```js
const targetPath = (filename) => {
  const norm = filename.replace(/\\/g, '/');
  return path.posix.basename(path.posix.dirname(norm));
};

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      idMismatch: '`id` must equal directory name. Expected "{{expected}}", got "{{actual}}".',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (!/(^|[\\/])component\.config\.ts$/.test(filename)) return {};

    const expected = targetPath(filename);

    return {
      Program(ast) {
        const def = (ast.body || []).find(n => n.type === 'ExportDefaultDeclaration');
        const obj = def && unwrapObject(def.declaration);
        const idNode = obj && getFieldMap(obj).id;
        const idValue = idNode && literalString(idNode);
        if (idValue && idValue !== expected) {
          context.report({
            node: idNode,
            messageId: 'idMismatch',
            data: { expected, actual: idValue },
          });
        }
      },
    };
  },
};
```

---

## 常见陷阱

| 陷阱 | 后果 | 解法 |
|---|---|---|
| 忘记跳过非目标文件 | 规则在所有文件报"无 default export" | `if (!/<pattern>/.test(filename)) return {}` |
| Windows 路径用 `/` 拆分失败 | 找不到目录名 | `replace(/\\/g, '/')` 规范化 |
| AST 是 `TSAsExpression` | unwrap 漏层 | 递归 unwrap |
| `key` 是 `Literal` | `Identifier.name` undefined | 类型分支判断 |
| 不处理 `SpreadElement` | crash 在 `prop.key.type` | `if (prop.type !== 'Property') continue` |
| `data` 字段拼写错 | message 模板不替换 | 严格按 `{{varName}}` 命名 |