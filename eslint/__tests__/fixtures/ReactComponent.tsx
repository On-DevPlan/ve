// 测试 fixture:被 ESLint 当作"已正确写的 React 组件样例"使用。
// 它的存在目的是确保仓库里的 React + react-refresh 规则,
// 对一段最简组件不会误报。
// 任何对 React 规则的调整,都应该顺便回归这个文件。

import { useState } from 'react'; // React 内置 Hooks

// 默认导出一个最小的 counter 组件
// 故意写成一行 return,只为让"自闭合规则"等保持清洁
export function Counter(): JSX.Element {
  const [count, setCount] = useState(0); // 解构出 state / setter
  // 点击时自增,渲染当前计数值
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}