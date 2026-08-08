// FullscreenCanvas.tsx —— 全屏浮窗,把当前组的快捷键渲成可缩放可拖动的画布。
//
// 交互:
//   - 鼠标左键拖空白区 → 平移(tx,ty)
//   - 鼠标滚轮(在画布上)→ 以画布中心为锚缩放
//   - 顶部 +/- 按钮缩放(夹紧 [0.5, 3])
//   - 顶部 ⟲ 按钮重置
//   - ESC / × 关闭(onClose)
// 视觉:
//   - 节点 = 每个 Shortcut,卡片显示 combo(Kbd)+ description
//   - CSS Grid 自动排,不显式算坐标
//   - backdrop 半透明黑,画布居中
// 不依赖浏览器 Fullscreen API(组件本身只管"全屏浮窗"语义);
// 是否走浏览器原生 fullscreen 由父组件 useFullscreen 决定(可选高级能力)。

import {
  useCallback, useEffect, useRef, useState,
  type WheelEvent as ReactWheelEvent, type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { Shortcut } from '../types';

export interface FullscreenCanvasProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  groupName: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const WHEEL_FACTOR = 1.1;

export default function FullscreenCanvas({ open, onClose, shortcuts, groupName }: FullscreenCanvasProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; baseTx: number; baseTy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 滚轮缩放
  function onWheel(e: ReactWheelEvent<HTMLDivElement>): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * delta)));
  }

  // 拖动平移(空白区;节点上不拖)
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.sl-sl-canvas-node')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: tx, baseTy: ty };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const d = dragRef.current;
    if (!d) return;
    setTx(d.baseTx + (e.clientX - d.startX));
    setTy(d.baseTy + (e.clientY - d.startY));
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  if (!open) return null;
  const portalRoot =
    (typeof document !== 'undefined' &&
      document.querySelector('[data-sl-portal]')) ||
    (typeof document !== 'undefined' ? document.body : null);
  if (!portalRoot) return null;

  return createPortal(
    <div
      className="sl-sl-canvas-backdrop"
      role="dialog"
      aria-label={`${groupName} 全屏视图`}
    >
      <header className="sl-sl-canvas__head">
        <h3 className="sl-sl-canvas__title">{groupName} · 全屏视图</h3>
        <div className="sl-sl-canvas__ctrls">
          <button className="sl-sl-icon-btn" aria-label="缩小" onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.2))}>−</button>
          <span className="sl-sl-canvas__scale">{Math.round(scale * 100)}%</span>
          <button className="sl-sl-icon-btn" aria-label="放大" onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))}>+</button>
          <button className="sl-sl-icon-btn" aria-label="重置" onClick={reset}>⟲</button>
          <button className="sl-sl-icon-btn" aria-label="关闭" onClick={onClose}>×</button>
        </div>
      </header>
      <div
        ref={stageRef}
        className="sl-sl-canvas__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ touchAction: 'none' }}
      >
        <div
          className="sl-sl-canvas__world"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {shortcuts.map((s) => (
            <div key={s.id} className="sl-sl-canvas-node">
              <div className="sl-sl-canvas-node__combo">
                {s.combo.map((k, i) => (
                  <span key={`${k.code}-${i}`}>
                    {i > 0 && <span className="sl-sl-canvas-node__plus">+</span>}
                    <kbd className="sl-sl-chip">{k.label}</kbd>
                  </span>
                ))}
              </div>
              <div className="sl-sl-canvas-node__desc">{s.description || <span className="sl-sl-empty">未填写说明</span>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}