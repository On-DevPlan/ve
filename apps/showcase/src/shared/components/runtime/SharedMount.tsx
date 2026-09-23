// SharedMount.tsx —— 在 React 树里消费一个共享组件（当前均为 Vue 实现）。
//
// 这是整套方案里唯一的「跨框架」机制代码：把 Vue 组件挂到 React 交出的一块 DOM 上。
// 动作与 mount-adapters 的 VueMountAdapter 相同，但有一处关键差异 ——
// **它不自建 ShadowRoot**：
//   - anchor 由 React 提供，可能落在 Light DOM，也可能落在 DetailPage 已经建好的
//     ShadowRoot 内（共享组件被 demo 组件消费时就属于后者）；
//   - 自建 shadow root 会得到嵌套的第二层 shadow，引入事件 retarget、样式注入层次
//     等一整类坑；复用已有那一层则完全避开；
//   - 样式落点交给 host-env 策略按 anchor.getRootNode() 决定。
//
// 用法：
//   import FileDropZone from '@/shared/components/FileDropZone';
//   <SharedMount module={FileDropZone} componentProps={{ accept: '.toml' }} />

import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { createApp, shallowReactive, type App } from 'vue';
import { createHostEnvs, selectHostEnv } from './host-env';
import type { SharedModule } from './descriptor';

// * as React 引入是为了让 classic JSX 运行时（React.createElement）在 showcase 的
// .tsx 编译环境下找到 React —— showcase tsconfig 用 jsx: preserve，esbuild 默认转
// classic。React 在代码里不被直接引用，但 JSX 编译后会在文件顶层读 React.createElement。
// （与 shared/LoadingSkeleton/host-react.tsx 的同类注释一致。）

export interface SharedMountProps {
  /** 组件的 descriptor（通常直接传组件目录的 default 导出）。 */
  module: SharedModule;
  /** 透传给组件本身的 props。必须是框架无关的纯数据 + 回调。 */
  componentProps?: Record<string, unknown>;
  /** 可选：挂在容器 div 上的类名，便于调用点微调布局。 */
  className?: string;
}

export function SharedMount({
  module,
  componentProps = {},
  className,
}: SharedMountProps): React.ReactElement {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  // 传给 Vue 的根 props。用 shallowReactive 承载，这样 componentProps 变化时
  // 只需 Object.assign 即可触发组件更新，不必重建 app 实例。
  const rootProps = useRef(shallowReactive<Record<string, unknown>>({}));

  // 挂载 / 卸载各执行一次。
  //
  // 空依赖是**必须**的：非空依赖会让 React 重渲染时重跑 effect，先 unmount 再
  // mount —— Vue 实例被销毁重建，组件内部状态（输入框内容、选择中的文件、
  // 滚动位置）全部丢失。
  //
  // 同时下面始终返回**空的** div：Vue 的 DOM 写在这个容器里，React 不能重渲染
  // 它的子节点。因为 React 认为它没有子节点，只要保持空，就不会去动它。
  //
  // 约定：module 必须是静态 import 出来的常量，运行期不更换；换成另一个组件
  // 不在本壳的语义范围内（需要重建 app，应通过 key 让 React 重建本组件）。
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    // 注入样式（策略按 anchor 的根节点类型决定注到 document.head 还是当前 shadow root）。
    selectHostEnv(createHostEnvs(), el).injectCss(el, [module.css]);

    Object.assign(rootProps.current, componentProps);
    const app: App = createApp(module.Component as never, rootProps.current);
    app.mount(el);

    return () => {
      app.unmount();
    };
    // 依赖数组留空是本壳的核心约束（不要在 React 重渲染时重建 Vue 实例），
    // 理由见上方注释。
  }, []);

  // componentProps 变化时同步给 Vue（浅合并，不重建 app）。
  // 声明在挂载 effect 之后，因此首次渲染时挂载先执行、这一步是幂等的空写。
  useLayoutEffect(() => {
    Object.assign(rootProps.current, componentProps);
  });

  return <div ref={anchorRef} className={className} />;
}
