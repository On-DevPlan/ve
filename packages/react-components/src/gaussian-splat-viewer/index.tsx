// gaussian-splat-viewer — full-viewport 3D Gaussian splat viewer.
//
// Architecture (see spec):
//   - useGaussianScene appends renderer.domElement to containerRef.current,
//     which is a full-viewport positioned <div> (className sl-gsv-canvas-host,
//     z-index 0, pointer-events none). The three.js canvas therefore renders
//     behind every overlay (loading screen, progress bar, intro box).
//   - Captures window-level wheel + touch events; overrides body cursor
//     and overflow via document.head <style>.
//   - All side effects are reverted on unmount so re-mounting is clean.

import './index.css';
import { useRef, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useGaussianScene } from './src/useGaussianScene';
import { useScrollProgress } from './src/useScrollProgress';
import { defaultPath } from './src/cameraPath';
import { LoadingScreen } from './src/LoadingScreen';
import { ProgressBar } from './src/ProgressBar';
import { IntroBox } from './src/IntroBox';

const DEFAULT_PLY = '/splat/image.ply';
const DEFAULT_CURSOR = '/splat/1.ico';
const CURSOR_STYLE_ATTR = 'data-gsv-cursor';

export default function GaussianSplatViewer(
  props: { plyPath?: string; cursorUrl?: string } = {},
): JSX.Element {
  const plyPath = props.plyPath ?? DEFAULT_PLY;
  const cursorUrl = props.cursorUrl ?? DEFAULT_CURSOR;

  // host div — useGaussianScene appends renderer.domElement here. The div
  // itself is positioned full-viewport with z-index 0 and pointer-events
  // none so it never blocks overlay interactions.
  const containerRef = useRef<HTMLDivElement>(null);

  // body overflow + scroll state
  const previousOverflowRef = useRef<string>('');
  const cursorStyleRef = useRef<HTMLStyleElement | null>(null);
  const [showHint, setShowHint] = useState(true);

  const { camera, isLoaded, loadError, render } = useGaussianScene(containerRef, plyPath);
  const { progress } = useScrollProgress({
    sensitivity: 0.0012,
    smoothFactor: 0.06,
  });

  // 全视口光标 / overflow 副作用
  useEffect(() => {
    // 1. body 接管 overflow
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 2. 自定义光标(注入 document.head,而不是 ShadowRoot,因为光标生效范围
    //    超出组件容器)
    const style = document.createElement('style');
    style.setAttribute(CURSOR_STYLE_ATTR, 'true');
    style.textContent = `body, body * { cursor: url('${cursorUrl}'), default !important; }`;
    document.head.appendChild(style);
    cursorStyleRef.current = style;

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
      if (cursorStyleRef.current && document.head.contains(cursorStyleRef.current)) {
        document.head.removeChild(cursorStyleRef.current);
        cursorStyleRef.current = null;
      }
    };
  }, [cursorUrl]);

  // 滚动后隐藏 hint
  useEffect(() => {
    if (progress > 0.02) setShowHint(false);
  }, [progress]);

  // RAF 相机循环
  useEffect(() => {
    if (!isLoaded || !camera.current) return;

    let rafId = 0;
    const animate = () => {
      const position = defaultPath.getPosition(progress);
      const lookAt = defaultPath.getLookAt(progress);
      camera.current!.position.copy(position);
      camera.current!.lookAt(lookAt);
      render();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isLoaded, progress, camera, render]);

  // 错误 fallback
  if (loadError) {
    return (
      <div className="sl-gsv-error">
        无法加载高斯泼溅资产,请检查 {plyPath} 是否存在。
        <br />
        {loadError.message}
      </div>
    );
  }

  return (
    <>
      <LoadingScreen visible={!isLoaded} />
      {/* useGaussianScene 把 renderer.domElement append 到这个 div;
          div 自身 fixed + inset:0 + z-index:0 + pointer-events:none,
          视觉上是全视口底层背景,所有 overlay 在它之上 */}
      <div
        ref={containerRef}
        className="sl-gsv-canvas-host"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {isLoaded && <ProgressBar progress={progress} />}
      {isLoaded && showHint && (
        <div className="sl-gsv-hint">↓ SCROLL TO START ↓</div>
      )}
      {isLoaded && <IntroBox visible={progress >= 0.99} />}
    </>
  );
}
