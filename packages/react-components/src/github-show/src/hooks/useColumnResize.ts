// src/hooks/useColumnResize.ts —— github-show 列宽拖拽 hook(v1.5.0)。
//
// 行为要点(参考 shortcut-library splitter):
//   - pointerdown 拿初始宽度(startWidth)与起始 X(startX);setPointerCapture 把事件锁在 handle 上
//   - pointermove 用 rAF 节流:写 CSS var (`--sl-gh-col-w-<id>`) 给编辑视图 CSS Grid 消费;
//     同时可选调 applyLive(colId, w) 让展示视图直接写该列 <col> 的 style.width
//     —— 两者并行不冲突,Grid 视图忽略 applyLive(无元素可写)
//   - pointerup 才调 onCommit 一次性写回 store(debounce save 自动接管)
//   - 拖拽期间 body.cursor=col-resize + body.classList 防文本选中 + 关闭 hover 高亮
//   - 键盘可达:focus handle 后 ArrowLeft/Right 步进 8px,Home/End 跳到 min/max
//   - enabled=false 时所有 handler 都是 no-op(公开分享模式 / 1fr 列)
//
// 与直接 setState 的区别:每个 pointermove 触发 setState 会让所有 cell 重渲染;
// 走 CSS 变量 + applyLive 写 DOM 只动一两个属性,React 看不见,UI 仍然实时。

import { useCallback, useEffect, useRef } from 'react';

export interface UseColumnResizeArgs {
  /**
   * 表格根 ref。
   * - 编辑视图(Grid):drag 时往 root.style 写 CSS var,所有 cell 跟随重排
   * - 展示视图(table):CSS var 无用,使用 applyLive 直接改被拖列 <col> 的 width
   */
  tableRef: React.RefObject<HTMLElement | null>;
  /**
   * 给定 colId,返回该列当前实际像素宽度(拖拽起点)。
   * 1fr 列无法从 CSS 直接读 px 值,所以调用方需在挂载时测量后写入内部 Map 提供此函数。
   */
  readWidth: (colId: string) => number;
  /**
   * 拖拽结束(或键盘 Arrow 步进)后调一次,通知调用方把 newPx 写进 doc.widths。
   * 由 useGithubShow.setColumnWidth 实现,内部走 mutate() + debounce save。
   */
  onCommit: (colId: string, widthPx: number) => void;
  /** false 时拖拽与键盘 handler 全部 no-op(公开模式 / 1fr 列) */
  enabled: boolean;
  /** 默认 80 */
  minWidth?: number;
  /**
   * 可选:拖拽过程中每帧调用,把当前 px 写到任意 DOM 节点。
   * 用途:展示视图是 `<table>`,CSS Grid 变量对它无效,直接改被拖列那个
   * `<col>` 的 style.width 最快(table-layout: fixed 下整列立即跟随)。
   * React 不会感知,无重渲。若调用方不提供,只写 CSS var(Grid 场景够用)。
   */
  applyLive?: (colId: string, widthPx: number) => void;
  /**
   * 可选:dragstart 通知(用于移除 th 上的持久 width style,让 applyLive 接管);
   * dragend 通知(用于把最终 width 写回 inline,避免 React 后续 props 与 inline 不一致)。
   * 编辑视图(Grid)不关心 —— CSS var 自带同步。
   */
  onDragStart?: (colId: string) => void;
  onDragEnd?: (colId: string, widthPx: number) => void;
}

export interface ResizeHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  role: 'separator';
  'aria-orientation': 'vertical';
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-disabled': boolean;
  tabIndex: number;
}

const DRAG_CLASS = 'is-dragging';

export function useColumnResize({
  tableRef,
  readWidth,
  onCommit,
  enabled,
  minWidth = 80,
  applyLive,
  onDragStart,
  onDragEnd,
}: UseColumnResizeArgs): { bind: (colId: string, currentWidth: number, label: string) => ResizeHandleProps & { 'aria-label': string } } {
  // 拖拽中的 colId(startX/startWidth/pointerId),挂在 ref 而非 state 以避免每帧重渲
  const dragRef = useRef<{
    colId: string;
    startX: number;
    startWidth: number;
    pointerId: number;
    lastWidth: number;
    rafId: number | null;
  } | null>(null);

  const writeVar = useCallback((colId: string, px: number) => {
    const root = tableRef.current;
    if (!root) return;
    root.style.setProperty(`--sl-gh-col-w-${colId}`, `${Math.round(px)}px`);
  }, [tableRef]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.rafId != null) cancelAnimationFrame(drag.rafId);
    document.body.style.removeProperty('cursor');
    document.body.classList.remove(DRAG_CLASS);
    tableRef.current?.classList.remove(DRAG_CLASS);
    if (onDragEnd) onDragEnd(drag.colId, drag.lastWidth);
    onCommit(drag.colId, drag.lastWidth);
    dragRef.current = null;
  }, [onCommit, onDragEnd, tableRef]);

  // 注销 window 级 handler,组件卸载或下一次 drag 重新挂
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      const next = Math.max(minWidth, drag.startWidth + dx);
      drag.lastWidth = next;
      if (drag.rafId != null) return; // 已在等下一帧
      drag.rafId = requestAnimationFrame(() => {
        if (dragRef.current) {
          const w = dragRef.current.lastWidth;
          writeVar(drag.colId, w);
          if (applyLive) applyLive(drag.colId, w);
        }
        if (dragRef.current) dragRef.current.rafId = null;
      });
    }
    function onUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      // 最后再写一次确保 final width 落定
      if (drag.rafId != null) {
        cancelAnimationFrame(drag.rafId);
        drag.rafId = null;
      }
      writeVar(drag.colId, drag.lastWidth);
      if (applyLive) applyLive(drag.colId, drag.lastWidth);
      finishDrag();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [writeVar, finishDrag, applyLive, minWidth]);

  const bind = useCallback(
    (colId: string, currentWidth: number, label: string) => {
      const ariaDisabled = !enabled;
      const handleProps: ResizeHandleProps & { 'aria-label': string } = {
        onPointerDown: (e) => {
          if (!enabled) return;
          if (e.button !== 0) return; // 仅左键
          e.preventDefault();
          const startW = readWidth(colId) || currentWidth;
          dragRef.current = {
            colId,
            startX: e.clientX,
            startWidth: startW,
            pointerId: e.pointerId,
            lastWidth: startW,
            rafId: null,
          };
          // 当前预览宽度同步到 CSS var,后续 pointermove 在它之上加 dx
          writeVar(colId, startW);
          if (applyLive) applyLive(colId, startW);
          if (onDragStart) onDragStart(colId);
          document.body.style.cursor = 'col-resize';
          document.body.classList.add(DRAG_CLASS);
          tableRef.current?.classList.add(DRAG_CLASS);
          // capture 之后后续 move/up 都到 handle,不再需要全局监听(但保留以兼容 Safari)
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 某些环境不支持,无视 */ }
        },
        onKeyDown: (e) => {
          if (!enabled) return;
          const cur = readWidth(colId) || currentWidth;
          let next = cur;
          let handled = true;
          if (e.key === 'ArrowLeft') next = Math.max(minWidth, cur - 8);
          else if (e.key === 'ArrowRight') next = cur + 8;
          else if (e.key === 'Home') next = minWidth;
          else if (e.key === 'End') next = cur + 240; // 增长一截,不强制 max(允许表格横向滚动)
          else handled = false;
          if (!handled) return;
          e.preventDefault();
          writeVar(colId, next);
          if (applyLive) applyLive(colId, next);
          onCommit(colId, next);
        },
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-valuenow': Math.round(currentWidth),
        'aria-valuemin': minWidth,
        'aria-valuemax': Math.round(currentWidth) + 1000,
        'aria-disabled': ariaDisabled,
        tabIndex: enabled ? 0 : -1,
        'aria-label': `拖动调节 ${label} 列宽度`,
      };
      return handleProps;
    },
    [enabled, readWidth, writeVar, applyLive, onDragStart, onCommit, tableRef, minWidth],
  );

  return { bind };
}
