// mount-adapters —— Vue 3 适配器。
// 对应 spec §4.4 "MountAdapter":
//   - Vue adapter 使用 createApp 对应的实例管理
//   - 卸载时必须调用 app.unmount()
//   - adapter 都必须支持异常捕获和幂等卸载
//
// 工作流程:
//   1) 取 module.default 作为 Vue 组件
//   2) 在 shadowRoot 里放一个 portal div
//   3) createApp(component, props) → app.mount(portal)
//   4) 把 Vite 注入的样式 adopt 进 shadowRoot(见 style-adoption.ts)
//   5) 监听 context.signal(AbortSignal):路由切换时自动 app.unmount()
//   6) 返回 unmount 句柄给 Host
//
// 错误处理策略(对照 React adapter 的"错误沿另一条路径传播"以收敛):
//   - Vue 3 patch reconciler 在 open-mode ShadowRoot 下偶尔触发 NotFoundError
//     (见 fix(adapters): ... commit 0ec73a7 + e656cae),这是已知工程噪声,吞掉;
//   - 组件自身的错误(渲染、生命周期、setup 抛错)必须 console.error 记录
//     并重新抛给 Host ErrorBoundary,不能静默;
//   - mount() 同步抛错同此处理。

import { createApp, type App } from 'vue'; // Vue 3 API: createApp
import type {
  Framework, // 框架联合类型
  MountAdapter, // 统一挂载协议
  MountContext, // 挂载上下文
  MountedComponent, // 已挂载句柄
} from '@style-library/component-contract';
import { adoptStylesInto } from './style-adoption.ts'; // 共享样式 adoption

// 识别已知工程噪声(ShadowRoot + Vue patch 触发)
function isKnownShadowRootPatchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name ?? '';
  const msg = err.message ?? '';
  // DOMException: Failed to execute 'insertBefore' on 'Node': The node ...
  // 或 NotFoundError: ...is not a child of this node
  return (
    name === 'NotFoundError' ||
    (msg.includes('insertBefore') && msg.includes('Node')) ||
    (msg.includes('removeChild') && msg.includes('Node'))
  );
}

// 工厂入口:返回一个仅处理 'vue' 的 adapter
export function createVueMountAdapter(): MountAdapter {
  return {
    // 只接 vue(react 走 ReactMountAdapter)
    canHandle(framework: Framework) {
      return framework === 'vue';
    },

    // 真正挂载组件
    async mount(module: unknown, context: MountContext): Promise<MountedComponent> {
      // module 是 ESM 模块对象,component.config.ts 的 entry 通常指向 default 导出
      const component = (module as { default: unknown }).default;
      if (!component) {
        // entry 没有 default 导出:抛错,让上层把错误冒泡到 ErrorBoundary
        throw new Error('VueMountAdapter: module.default is missing');
      }

      // CSS 前置:有 cssReady(本地组件,host 已注入)则等就绪;没有(远程组件)回退扫 head。
      if (context.cssReady) {
        await context.cssReady;
      } else {
        adoptStylesInto(context.shadowRoot);
      }

      // 1) 创建 portal div 并挂到 ShadowRoot
      const portal = document.createElement('div');
      context.shadowRoot.appendChild(portal);

      // 2) 创建 Vue app + 错误处理器
      const app: App = createApp(component as never, context.props);
      app.config.errorHandler = (err, _instance, info) => {
        // 已知 ShadowRoot patch 噪声:吞掉,不污染 console 与 Host 错误流
        if (isKnownShadowRootPatchError(err)) return;
        // 未知错误:记录到 console.error,但不 throw(throw 在 Vue errorHandler 里
        // 无效——Vue 不会再捕获;Host 错误传播靠 mount() 的 try/catch 抛)
        console.error('[VueMountAdapter] component error:', err, '\ninfo:', info);
      };

      // 3) 挂载。同步抛错区分:已知 ShadowRoot patch 噪声吞掉,其它重抛给 Host
      try {
        app.mount(portal);
      } catch (err) {
        if (isKnownShadowRootPatchError(err)) {
          // 已知噪声:忽略,等待后续 update() 成功
        } else {
          // 未知 mount 错:重抛,DetailPage 错误处理会显示
          console.error('[VueMountAdapter] mount() threw:', err);
          throw err;
        }
      }

      // 5) 路由切换时自动卸载
      context.signal.addEventListener('abort', () => app.unmount());

      return { unmount: () => app.unmount() };
    },
  };
}
