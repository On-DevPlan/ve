export * from './ShadowRootHost.ts';
export * from './VueMountAdapter.ts';
export * from './ReactMountAdapter.ts';
export * from './AdapterFactory.ts';

// 注意：style-adoption.ts 刻意**不**从这里再导出。
//
// 共享组件运行时（shared/components）的 shadowEnv 策略需要 adoptCssTexts / djb2，
// 走的是子路径入口 `@style-library/mount-adapters/style-adoption`（见 package.json
// 的 exports）。原因：本文件是 barrel，`export * from './ReactMountAdapter.ts'` 会把
// react-dom 一并拉进任何引用本包的文件；而 shared/components 是 Vue 侧与 React 侧
// 共用的底层 chunk，被它拉着加载 192 KB 的 react-vendor 是错的（实测过：加子路径
// 之前 shared-components chunk 会静态 import react-vendor）。
// 直接引叶子模块，Rollup 才能把 ReactMountAdapter 摇掉。
//
// 顺带：adoptStylesInto 是"远程组件兜底"路径，其文件顶部 KNOWN-LIMITATIONS 自述
// 带 3 个未修 latent bug（P0 白屏 / P1 破隔离 / P2 静默缺样式），只在该路径下触发 ——
// 也不应经 barrel 推上公共面。
