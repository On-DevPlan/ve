// 自定义规则:no-card-loader
// 强制 spec §6.3 —— 卡片层 ≠ 组件实现。
// 卡片层文件(HomePage / 卡片网格 / 搜索 / 分组筛选等)只能渲染 ManifestEntry(metadata);
// 不允许触发 entry.loader() / registry.load() / loaders[id](),因为这些会让卡片层
// 在首屏(用户打开 /components 或首页时)就拉组件实现 chunk,破坏 first-paint 边界。
// 加载由详情页(/pages/Detail.*)独享。
//
// 判定文件属于"卡片层"的两条规则(任一命中):
//   1) 路径在 apps/showcase/src/components/(卡片子组件集合)
//   2) 路径在 apps/showcase/src/pages/(除 Detail.* 之外的页面——HomePage 不应触发 loader)
//   3) 文件名以 Card.<ext> 结尾(用于将来可能的新卡片命名约定,如 DataCard.vue)
// 命中卡片层文件的以下调用将报错:
//   - entry.loader() / entry.load()
//   - registry.load()
//   - loaders[id]() 或 useLoaders()[id]() —— 即对 loaders 字典的直接调用

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Card-layer files must not call entry.loader() / registry.load() / loaders[id](). Only the detail route may load component implementations.',
    },
    schema: [],
    messages: {
      noLoader:
        'Card-layer files must render ManifestEntry fields only; do not call {{callee}}. Move component loading to the detail page.',
    },
  },
  create(context) {
    // 当前检查的文件路径
    const filename = context.getFilename();
    // 把 Windows 反斜杠统一成正斜杠,避免正则匹配错
    const norm = filename.replace(/\\/g, '/');
    // 卡片层只针对 apps/showcase/ 内的文件(其他包是组件实现,允许 loader)
    // 注意 filename 可能是相对路径('apps/showcase/...'),不带前导 /
    const inShowcase = /(^|\/)apps\/showcase\//.test(norm);
    // 是否是"卡片层文件":
    //   - apps/showcase/src/components/ 目录下(卡片子组件)
    //   - apps/showcase/src/pages/(除 Detail.* 外)
    //   - apps/showcase/ 下文件名以 Card.<ext> 结尾(命名约定)
    const isCardLayer =
      inShowcase && (
        /\/components\//.test(norm) ||
        /\/pages\/(?!Detail)/.test(norm) ||
        /Card\.(vue|tsx|jsx)$/.test(filename)
      );

    return {
      // 监听函数调用表达式
      CallExpression(node) {
        // 非卡片层文件直接放行
        if (!isCardLayer) return;
        // 取调用者:必须是 obj.prop() 形式
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        const obj = callee.object; // obj 部分
        const prop = callee.property; // prop 部分
        // 防御性校验
        if (!obj || !prop) return;
        // 只匹配简单的标识符调用(entry / registry),不匹配复杂表达式
        if (obj.type !== 'Identifier') return;

        // 命中规则 1: entry.loader() 或 entry.load()
        const isEntryLoader =
          obj.name === 'entry' && (prop.name === 'loader' || prop.name === 'load');
        // 命中规则 2: registry.load()
        const isRegistryLoad =
          obj.name === 'registry' && prop.name === 'load';

        // 任一命中则报错
        if (isEntryLoader || isRegistryLoad) {
          context.report({
            node, // 高亮整个调用表达式
            messageId: 'noLoader',
            data: { callee: `${obj.name}.${prop.name}` },
          });
        }
      },
    };
  },
};