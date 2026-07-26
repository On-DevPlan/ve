// 自定义规则:valid-component-config
// 强制 component.config.ts 的字段与文件系统约定一致,加组件"格式不对直接报错"。
//
// 触发条件:文件名为 component.config.ts。
// 校验项:
//   1. 必须有 `export default { ... }`(可能带 `satisfies ComponentConfig`)
//   2. `id` 必须是字符串字面量,且等于所在目录名(import.meta.glob 按目录名扫)
//   3. `framework` 必须是 'vue' / 'react' 字面量,且与所在包目录一致:
//        - packages/vue-components/  → 'vue'
//        - packages/react-components/ → 'react'
//   4. `route.path` 必须以 /components/ 开头(详情路由约定)
//   5. `route.path` 必须等于 /components/<id>(保证 id 与路由一致)

import path from 'node:path';

// 从绝对路径里抓 framework 包名(vue-components / react-components)
// filename 可能是 / 或 \ 分隔,统一规范化再匹配
function detectFrameworkFromPath(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const m = normalized.match(/\/(vue|react)-components\//);
  return m ? m[1] : null;
}

// 取所在目录名作为期望 id
function expectedIdFromPath(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const dir = path.posix.dirname(normalized);
  return path.posix.basename(dir);
}

// 从 default export 的 declaration 里抽出 ObjectExpression
// 跳过 satisfies / as 包裹
function unwrapObject(node) {
  if (!node) return null;
  if (node.type === 'ObjectExpression') return node;
  // TS satisfies / as 表达式
  if (node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression') {
    return unwrapObject(node.expression);
  }
  return null;
}

// 从对象字面量里按 key 取出"字面量值"或"子对象"
function getFieldMap(objectNode) {
  const map = {};
  for (const prop of objectNode.properties) {
    if (prop.type !== 'Property') continue;
    const keyNode = prop.key;
    const key =
      keyNode.type === 'Identifier' ? keyNode.name :
      keyNode.type === 'Literal' ? String(keyNode.value) : null;
    if (!key) continue;
    map[key] = prop.value;
  }
  return map;
}

// 取字面量字符串值;非字面量返回 undefined
function literalString(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'component.config.ts must match file-system conventions: id === directory name, framework matches package, route.path starts with /components/<id>.',
    },
    schema: [],
    messages: {
      noDefaultExport: 'component.config.ts must have an `export default { ... }` object.',
      idLiteral: 'component.config.ts `id` must be a string literal.',
      idMismatch: '`id` must equal the directory name. Expected "{{expected}}", got "{{actual}}".',
      frameworkLiteral: 'component.config.ts `framework` must be a string literal.',
      frameworkUnknown: '`framework` must be "vue" or "react", got "{{actual}}".',
      frameworkMismatch: '`framework` must match the package directory. Package is {{pkg}}, framework is "{{actual}}".',
      routePathLiteral: '`route.path` must be a string literal.',
      routePathPrefix: '`route.path` must start with "/components/", got "{{actual}}".',
      routePathIdMismatch: '`route.path` must be "/components/{{id}}", got "{{actual}}".',
    },
  },
  create(context) {
    const filename = context.getFilename();
    // 只对 component.config.ts 生效
    if (!/(^|[\\/])component\.config\.ts$/.test(filename)) return {};

    const expectedId = expectedIdFromPath(filename);
    const expectedFramework = detectFrameworkFromPath(filename);

    return {
      // 同时覆盖 Program 级别的"缺 default export"和节点级字段校验
      Program(ast) {
        const body = ast.body || [];
        const defaultExport = body.find(
          (n) => n.type === 'ExportDefaultDeclaration',
        );
        if (!defaultExport) {
          context.report({ node: ast, messageId: 'noDefaultExport' });
          return;
        }
        const objectNode = unwrapObject(defaultExport.declaration);
        if (!objectNode) {
          // default export 存在但不是对象字面量(可能是变量引用等)
          context.report({ node: defaultExport, messageId: 'noDefaultExport' });
          return;
        }

        const fields = getFieldMap(objectNode);

        // --- id ---
        const idNode = fields.id;
        if (idNode === undefined) return; // ajv schema 会报缺字段,ESLint 不重复
        const idValue = literalString(idNode);
        if (idValue === undefined) {
          context.report({ node: idNode, messageId: 'idLiteral' });
        } else if (idValue !== expectedId) {
          context.report({
            node: idNode,
            messageId: 'idMismatch',
            data: { expected: expectedId, actual: idValue },
          });
        }

        // --- framework ---
        const fwNode = fields.framework;
        if (fwNode !== undefined) {
          const fwValue = literalString(fwNode);
          if (fwValue === undefined) {
            context.report({ node: fwNode, messageId: 'frameworkLiteral' });
          } else if (fwValue !== 'vue' && fwValue !== 'react') {
            context.report({
              node: fwNode,
              messageId: 'frameworkUnknown',
              data: { actual: fwValue },
            });
          } else if (expectedFramework && fwValue !== expectedFramework) {
            context.report({
              node: fwNode,
              messageId: 'frameworkMismatch',
              data: { pkg: `${expectedFramework}-components`, actual: fwValue },
            });
          }
        }

        // --- route.path ---
        const routeNode = fields.route;
        if (routeNode && routeNode.type === 'ObjectExpression') {
          const routeFields = getFieldMap(routeNode);
          const pathNode = routeFields.path;
          if (pathNode !== undefined) {
            const pathValue = literalString(pathNode);
            if (pathValue === undefined) {
              context.report({ node: pathNode, messageId: 'routePathLiteral' });
            } else {
              if (!pathValue.startsWith('/components/')) {
                context.report({
                  node: pathNode,
                  messageId: 'routePathPrefix',
                  data: { actual: pathValue },
                });
              } else {
                // 校验 path 末段 == id
                const trailing = pathValue.replace(/\/$/, '').split('/').pop();
                if (idValue && trailing !== idValue) {
                  context.report({
                    node: pathNode,
                    messageId: 'routePathIdMismatch',
                    data: { id: idValue, actual: pathValue },
                  });
                }
              }
            }
          }
        }
      },
    };
  },
};
