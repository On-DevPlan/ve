// shared/utils.ts —— 跨平台 / 跨运行时小工具。
//
// 作用:
//   - hasWindow / isBrowser:在 SSR(无 window)与 CSR 之间分流,
//     让 store / request / window-bus 这类必须访问浏览器全局的代码
//     能在 import 时不崩,运行时不串号。
//   - 这两个常量是纯函数式判定,没有副作用,可以放在其他模块顶层。

/**
 * 是否处于浏览器/客户端 SSR-with-window 上下文。
 *
 * 在 Node 服务端(无 window)直接 import 走到的代码——例如 registry/apiGateway
 * ——不会自动调用这个;只有需要真的碰 window/localStorage 的代码会在调用点判一次。
 *
 * @returns {boolean} true 表示存在全局 `window` 对象。
 */
export const hasWindow = (): boolean => typeof window !== 'undefined';
