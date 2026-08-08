// useFullscreen.ts —— 包装浏览器 Fullscreen API。
//
// 用途:让组件可以切换浏览器原生全屏(viewport 模式)。
// 注意:FullscreenCanvas 组件本身只是"全屏浮窗"(portal + fixed inset:0),
// 不依赖浏览器 API;浏览器原生全屏是可选高级能力,父组件按需接入。
//
// 行为:
//   - targetRef: 容器元素;document.fullscreenElement 变化时同步到 isFullscreen
//   - ESC 自动退出(浏览器原生,但组件层面也响应 fullscreenchange)
//   - 错误一律吞掉(权限拒绝 / 不支持),UI 通过 isFullscreen 反映失败
import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface UseFullscreenReturn {
  isFullscreen: boolean;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
}

export function useFullscreen(targetRef: RefObject<Element | null>): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  useEffect(() => {
    function onChange(): void {
      setIsFullscreen(typeof document !== 'undefined' && !!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(async (): Promise<void> => {
    const el = targetRef.current;
    if (!el || !document.fullscreenEnabled) return;
    try {
      await el.requestFullscreen();
    } catch {
      /* 权限拒绝 / iOS 不支持,ignore */
    }
  }, [targetRef]);

  const exit = useCallback(async (): Promise<void> => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(async (): Promise<void> => {
    if (document.fullscreenElement) await exit();
    else await enter();
  }, [enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}