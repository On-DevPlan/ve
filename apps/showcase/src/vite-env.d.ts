// Vite 环境类型声明:为无对应实体文件的 virtual module 提供 TS 类型。
// virtual:vue-styles 由 vue-style-collector 插件(vue-style-collector.ts)在构建期生成,
// 运行时 default export 为 Record<componentId, () => Promise<string[]>>(懒加载 loader:
// resolve 后返回该组件目录下所有 style block 的 CSS 文本数组)。
// css-maps.ts 顶层 import 它,无此声明 tsc --noEmit 会报 Cannot find module。
declare module 'virtual:vue-styles' {
  const map: Record<string, () => Promise<string[]>>;
  export default map;
}
