// descriptor.ts —— shared/components 下每个共享组件的统一对外契约。
//
// 为什么需要它：共享组件要同时被 Vue 树与 React 树消费，两种消费路径都需要
// 一个稳定入口来回答三个问题：
//   1) 组件本体是什么            → Component
//   2) 它的样式文本是什么         → css
//   3) 它由哪个框架实现           → meta.host（宿主侧据此决定是否需要 island 桥接）
//
// 为什么 css 要显式携带、不走自动注入：
//   SFC <style> 由 plugin-vue + vue-style-collector 按 packages/vue-components 目录
//   收集；React 的 index.css 由 css-maps.ts 里硬编码的 glob 收集。两条通道都
//   不覆盖 apps/showcase/src/shared —— 组件若依赖自动注入，挂上去就是裸样式。
//   所以共享组件的 CSS 必须显式挂在 descriptor 上，由 SharedMount 壳负责注入。
//
// 硬约定（完整版见 ../README.md）：
//   - props 只能是框架无关的纯数据 + 回调函数，不得出现 Ref / Slots / ReactNode
//   - css 必须来自 import './style.css?inline'，且 style.css 不得使用 scoped

import type { Component } from 'vue';

/** 共享组件由哪个框架实现。当前统一 Vue；保留联合类型以便将来扩 React。 */
export type SharedHostFramework = 'vue' | 'react';

/** 组件身份信息。 */
export interface SharedComponentMeta {
  /** 组件名。需与目录名一致 —— SharedMount 的样式注入按它做排查标记。 */
  readonly name: string;
  /** 实现框架。 */
  readonly host: SharedHostFramework;
}

/**
 * 共享组件的唯一入口契约。
 *
 * 由 defineSharedModule() 产出，不要手写字面量对象 —— 手写会漏掉 render 哨兵。
 */
export interface SharedModule {
  /** 组件本体。Vue 实现时即 SFC 的 default 导出。 */
  readonly Component: Component;
  /** 该组件全部 CSS 文本（非 scoped），由 SharedMount 注入到正确的样式作用域。 */
  readonly css: string;
  readonly meta: SharedComponentMeta;
  /**
   * 防误用哨兵。descriptor 被直接当组件渲染时抛错，把「静默渲染空」变成「立刻炸」。
   * 正常使用（`<SharedMount :module="..." />`）不会触碰它。
   */
  readonly render: () => never;
}

/**
 * 定义共享组件的入口 descriptor。每个组件目录的 index.ts 应当：
 *
 *   export default defineSharedModule({
 *     Component: FileDropZone,
 *     css,                                   // import css from './style.css?inline'
 *     meta: { name: 'FileDropZone', host: 'vue' },
 *   });
 *
 * 它除收集三个字段外，还会挂一个**防误用哨兵**：
 *
 *   <SharedMount :module="FileDropZone" />   正确 —— 唯一推荐用法
 *   <FileDropZone />                         错误 —— descriptor 不是组件
 *   mount(FileDropZone)                      错误 —— 同上
 *
 * 后两种写法在 Vue 眼里只是「一个没有 template / render 的组件选项对象」，
 * 结果是**静默渲染空**，控制台仅有一条极易被忽略的 warn —— 排查成本极高。
 * 补一个 render 抛错，就能把它变成启动即暴露的硬错误。
 * 正常用法不会触碰：SharedMount 只读 Component / css / meta 三个字段。
 */
export function defineSharedModule(input: {
  Component: Component;
  css: string;
  meta: SharedComponentMeta;
}): SharedModule {
  return {
    ...input,
    render(): never {
      throw new Error(
        `[shared/components] ${input.meta.name} 的 descriptor 不是组件，不能直接渲染。` +
          '请通过 <SharedMount :module="..." /> 引用。',
      );
    },
  };
}
