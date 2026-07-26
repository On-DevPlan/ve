import { useState, useEffect, useRef, useCallback } from 'react';

export function useScrollProgress({
  sensitivity = 0.0012,
  touchSensitivity = 0.002,
  smoothFactor = 0.06,
}: {
  sensitivity?: number;
  touchSensitivity?: number;
  smoothFactor?: number;
} = {}) {
  const targetRef = useRef(0);
  const smoothRef = useRef(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // 滚轮事件
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetRef.current += e.deltaY * sensitivity;
      targetRef.current = Math.max(0, Math.min(1, targetRef.current));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [sensitivity]);

  // 触摸事件
  useEffect(() => {
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      targetRef.current += deltaY * touchSensitivity;
      targetRef.current = Math.max(0, Math.min(1, targetRef.current));
    };
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [touchSensitivity]);

  // 平滑动画循环
  useEffect(() => {
    const tick = () => {
      smoothRef.current += (targetRef.current - smoothRef.current) * smoothFactor;
      setSmoothProgress(smoothRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [smoothFactor]);

  const reset = useCallback(() => {
    targetRef.current = 0;
    smoothRef.current = 0;
    setSmoothProgress(0);
  }, []);

  return { progress: smoothProgress, reset };
}
