// host-react.tsx —— 函数组件,渲染 LoadingSkeleton 到挂载点,
// 通过 forwardRef 暴露 appear / fadeOut / destroy。

import * as React from 'react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

// * as React 引入是为了让 classic JSX 运行时 (`React.createElement`) 在
// showcase 的 .tsx 编译环境下找到 React —— showcase tsconfig 用 jsx: preserve
// 而非 react-jsx(esbuild 默认转 classic)。React 在内部不被代码直接引用,
// 但 JSX 编译后会在文件顶层读 `React.createElement`,所以 ESLint 不会报
// 未用局部(它知道这个 import 是给 JSX runtime 用的)。

export interface LoadingSkeletonRef {
  appear(): Promise<void>;
  fadeOut(onFaded?: () => void): Promise<void>;
  destroy(): void;
}

interface Props {
  className?: string;
}

export const LoadingSkeleton = forwardRef<LoadingSkeletonRef, Props>(function LoadingSkeleton(
  { className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [opacity, setOpacity] = useState(0);
  const destroyedRef = useRef(false);

  function setOp(target: 0 | 1): Promise<void> {
    return new Promise((resolve) => {
      const el = rootRef.current;
      if (!el) return resolve();
      // 强制 reflow,确保 transition 生效(连续 appear/fadeOut 不叠加)
      void el.offsetHeight;
      setOpacity(target);
      const onEnd = () => {
        el.removeEventListener('transitionend', onEnd);
        resolve();
      };
      el.addEventListener('transitionend', onEnd);
      // 兜底:transitionend 不触发(浏览器降级/disabled)时,650ms 后强制 resolve
      setTimeout(onEnd, 650);
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      appear(): Promise<void> {
        if (destroyedRef.current) return Promise.resolve();
        return setOp(1);
      },
      fadeOut(onFaded?: () => void): Promise<void> {
        if (destroyedRef.current) {
          onFaded?.();
          return Promise.resolve();
        }
        return setOp(0).then(() => {
          if (rootRef.current?.parentNode) rootRef.current.parentNode.removeChild(rootRef.current);
          destroyedRef.current = true;
          onFaded?.();
        });
      },
      destroy(): void {
        if (destroyedRef.current) return;
        destroyedRef.current = true;
        if (rootRef.current?.parentNode) rootRef.current.parentNode.removeChild(rootRef.current);
      },
    }),
    [],
  );

  return (
    <div
      ref={rootRef}
      className={className ?? 'sl-skel'}
      style={{ opacity, transition: 'opacity 600ms ease' }}
      role="status"
      aria-live="polite"
    >
      <div className="sl-skel__spinner" />
      <div className="sl-skel__text">加载中…</div>
      <div className="sl-skel__bars">
        <div className="sl-skel__bar sl-skel__bar--title" />
        <div className="sl-skel__bar" />
        <div className="sl-skel__bar" />
      </div>
    </div>
  );
});
