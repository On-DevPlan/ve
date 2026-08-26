// packages/react-components/src/color-studio/src/components/BrushCanvas.tsx
//
// 叠加笔刷画布(原生 Canvas 2D,零新依赖):
//   - 笔刷色 = 当前活动板 anchor 色
//   - 混合模式 = Canvas globalCompositeOperation(multiply/screen/overlay/soft-light/normal)
//   - 参数:大小 / 不透明度;撤销栈(位图快照,上限 20);清空
//   - 画布像素可反向取色(Alt+点击 或 取色按钮)→ onPickColor
// 画布内容不持久化(MVP:会话级;spec 已登记 IndexedDB 为后续)。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { toHex } from '../engine/colorMath';
import { Btn } from './ui/Btn';
import { Icon } from './ui/Icon';

type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: '正常' },
  { value: 'multiply', label: '正片叠底' },
  { value: 'screen', label: '滤色' },
  { value: 'overlay', label: '叠加' },
  { value: 'soft-light', label: '柔光' },
];

const CANVAS_W = 560;
const CANVAS_H = 360;
const MAX_UNDO = 20;

export function BrushCanvas({ onPickColor }: { onPickColor?: (hex: string) => void }) {
  const { doc } = useColorStudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const [blend, setBlend] = useState<BlendMode>('multiply');
  const [size, setSize] = useState(16);
  const [opacity, setOpacity] = useState(80);
  const [pickMode, setPickMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [hoverHex, setHoverHex] = useState<string | null>(null);

  // 笔刷色:活动板 anchor
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const brushHex = useMemo(() => {
    const anchorId = palette?.colorIds[0];
    return doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? '#000000';
  }, [doc.colorEntries, palette]);

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stack = undoStackRef.current;
    stack.push(canvas.toDataURL());
    if (stack.length > MAX_UNDO) stack.shift();
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const context = ctx();
    const snap = undoStackRef.current.pop();
    if (!canvas || !context || !snap) return;
    const img = new Image();
    img.onload = () => {
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
    img.src = snap;
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = ctx();
    if (!canvas || !context) return;
    pushUndo();
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, [pushUndo]);

  const toCanvasXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const strokeTo = (x: number, y: number) => {
    const context = ctx();
    if (!context) return;
    context.globalCompositeOperation = blend;
    context.globalAlpha = opacity / 100;
    context.strokeStyle = brushHex;
    context.lineWidth = size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const last = lastPtRef.current;
    context.beginPath();
    if (last) {
      context.moveTo(last.x, last.y);
    } else {
      // 单点:画一个极短线段保证 round cap 出点
      context.moveTo(x - 0.01, y);
    }
    context.lineTo(x, y);
    context.stroke();
    lastPtRef.current = { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toCanvasXY(e);
    if (pickMode || e.altKey) {
      // 反向取色
      const context = ctx()!;
      const px = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      const hex = toHex({ mode: 'rgb', r: px[0] / 255, g: px[1] / 255, b: px[2] / 255 });
      onPickColor?.(hex);
      return;
    }
    pushUndo();
    drawingRef.current = true;
    lastPtRef.current = null;
    strokeTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvasXY(e);
    if (pickMode) {
      const context = ctx();
      if (context) {
        const px = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        setHoverHex(toHex({ mode: 'rgb', r: px[0] / 255, g: px[1] / 255, b: px[2] / 255 }));
      }
      return;
    }
    if (!drawingRef.current) return;
    strokeTo(x, y);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPtRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // 初始化白底
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = ctx();
    if (!canvas || !context) return;
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="sl-cs-brush">
      <div className="sl-cs-brush__toolbar">
        <div className="sl-cs-brush__modes">
          {BLEND_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${blend === m.value ? 'is-active' : ''}`}
              onClick={() => setBlend(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="sl-cs-brush__param">
          <span>大小</span>
          <input type="range" min={2} max={64} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          <code>{size}</code>
        </label>
        <label className="sl-cs-brush__param">
          <span>不透明度</span>
          <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
          <code>{opacity}%</code>
        </label>
        <span className="sl-cs-brush__color">
          <span className="sl-cs-brush__chip" style={{ backgroundColor: brushHex }} />
          <code>{brushHex}</code>
        </span>
        <div className="sl-cs-brush__actions">
          <Btn
            variant={pickMode ? 'primary' : 'secondary'}
            size="sm"
            icon="eyedropper"
            onClick={() => setPickMode((v) => !v)}
            title="从画布取色(或按住 Alt 点击)"
          >
            取色
          </Btn>
          <Btn variant="secondary" size="sm" icon="undo" disabled={!canUndo} onClick={undo} title="撤销">
            撤销
          </Btn>
          <Btn variant="danger" size="sm" icon="trash" onClick={clear} title="清空画布">
            清空
          </Btn>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={`sl-cs-brush__canvas ${pickMode ? 'is-picking' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { setHoverHex(null); }}
        aria-label="笔刷画布"
      />
      <p className="sl-cs-brush__hint">
        <Icon name="brush" size={11} />
        {pickMode
          ? (hoverHex ? `取色:${hoverHex}` : '点击画布取色')
          : `笔刷色跟随活动板首色;按住 Alt 点击画布可反向取色${hoverHex ? ` · ${hoverHex}` : ''}`}
      </p>
    </div>
  );
}
