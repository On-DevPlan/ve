// mount-adapters —— React 适配器。
// 对应 spec §4.4 "MountAdapter":
//   - React adapter 使用 createRoot
//   - 卸载时必须调用 root.unmount()
//   - adapter 都必须支持异常捕获和幂等卸载
//
// 工作流程:
//   1) 取 module.default 作为 React 组件
//   2) 把 Vite 注入的样式 adopt 进 shadowRoot(见 style-adoption.ts)
//   3) 在 shadowRoot 里放一个 portal div 作为 React 根节点
//   4) createRoot(portal) → root.render(createElement(component, props))
//   5) 监听 context.signal:路由切换时 root.unmount()
//   6) 返回 update / unmount 句柄给 Host

import { createRoot, type Root } from 'react-dom/client'; // React 18+ API:createRoot
import { createElement } from 'react'; // 用 createElement 而不是 JSX,因为本文件是 .ts
import type {
  Framework, // 框架联合类型
  MountAdapter, // 统一挂载协议
  MountContext, // 挂载上下文
  MountedComponent, // 已挂载句柄
} from '@style-library/component-contract';
import { adoptStylesInto } from './style-adoption.ts'; // 共享样式 adoption

// 工厂入口:返回一个仅处理 'react' 的 adapter
export function createReactMountAdapter(): MountAdapter {
  return {
    // 只接 react
    canHandle(framework: Framework) {
      return framework === 'react';
    },

    // 真正挂载组件
    async mount(module: unknown, context: MountContext): Promise<MountedComponent> {
      // entry 应当 default-export React 组件
      const component = (module as { default: unknown }).default;
      if (!component) {
        throw new Error('ReactMountAdapter: module.default is missing');
      }

      // CSS 前置:有 cssReady(本地组件,host 已注入)则等就绪;没有(远程组件)回退扫 head。
      if (context.cssReady) {
        await context.cssReady;
      } else {
        adoptStylesInto(context.shadowRoot);
      }

      // 在 ShadowRoot 里建 portal div 作为 React 根节点
      const portal = document.createElement('div');
      context.shadowRoot.appendChild(portal);

      // createRoot + render
      // props 作为第二参数传给组件(spec §4.4 MountContext.props)
      const root: Root = createRoot(portal);
      root.render(createElement(component as never, context.props));

      // 路由切换时自动卸载
      context.signal.addEventListener('abort', () => {
        root.unmount();
      });

      // 返回句柄
      //   - update:重新 render 一遍新 props(spec §4.4 MountedComponent.update)
      //   - unmount:幂等,可重复调用
      return {
        update(nextProps) {
          root.render(createElement(component as never, nextProps));
        },
        unmount() {
          root.unmount();
        },
      };
    },
  };
}
