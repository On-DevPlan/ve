// theme/apply-theme.ts —— 把 token 集灌进 document 根元素的工具函数。
//
// 职责:
//   1) 接受任意 Record<string, string>(key 必须是 CSS 自定义属性名)
//   2) 把每个 key/value 写到 document.documentElement.style
//   3) 让组件内部通过 var(--sl-color-...) 直接消费,无需关心值来源
//
// 为什么挂在 documentElement:
//   - ShadowRoot 内的组件拿不到外部 CSS 变量;但可以继承根元素的 custom properties
//   - 把 token 挂在根上后,所有 ShadowRoot 都会自动继承(spec §10.6 的 contract)
//
// 调用时机:
//   - showcase 启动时(main.ts 在 mount 之前调用一次,落回默认主题)
//   - 主题切换时(后续如接主题包,只需重新调用并传新 token 集)

export function applyThemeToDocument(tokens: Record<string, string>): void {
  // 根元素 <html> —— CSS 变量写在这里,子节点 + 所有 ShadowRoot 都能继承
  const root = document.documentElement;
  // 逐项写入;Object.entries 顺序与插入顺序一致,便于调试时对照
  for (const [k, v] of Object.entries(tokens)) {
    // setProperty 会触发样式重新计算;对于 ~10 个 token,启动期开销可忽略
    root.style.setProperty(k, v);
  }
}
