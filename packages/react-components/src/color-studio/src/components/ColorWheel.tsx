// packages/react-components/src/color-studio/src/components/ColorWheel.tsx
//
// HSB 圆盘(SVG) + V 滑杆。点击/拖拽 → 极坐标 → HSB → hex → setDoc。

import { useCallback, useMemo, useRef } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { fromHex, toHex } from '../engine/colorMath';
import { HarmonyOverlay } from './HarmonyOverlay';
import type { HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const SIZE = 280;
const RADIUS = SIZE / 2 - 8;
const CENTER = SIZE / 2;

const HARMONY_OPTIONS: { value: HarmonyType | null; label: string }[] = [
  { value: null, label: '无' },
  { value: 'complementary', label: '互补' },
  { value: 'triadic', label: '三角' },
  { value: 'analogous', label: '类似' },
  { value: 'split-complementary', label: '分裂互补' },
  { value: 'monochromatic', label: '单色' },
];

/** HSB → hex。
 *  H: 0..360, S: 0..1, V: 0..1
 *  使用标准 HSL 转换再经 culori 序列化。 */
function hsbToHex(h: number, s: number, v: number): string {
  const l = v * (2 - s) / 2;
  let sNorm: number;
  if (l === 0 || l === 1) {
    sNorm = 0;
  } else {
    sNorm = (v * s) / (1 - Math.abs(2 * l - 1));
  }
  return toHex({ mode: 'hsl', h, s: Math.max(0, Math.min(1, sNorm)) * 100, l: l * 100 });
}

export function ColorWheel() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.colorIds[0];
  const anchorHex = useMemo(
    () => doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? '#000000',
    [doc.colorEntries, anchorId],
  );
  const initialHsl = useMemo(() => fromHex(anchorHex).hsl, [anchorHex]);
  const v = doc.viewState.brightness / 100;

  const dragRef = useRef<{
    active: boolean;
    pendingHue: number;
    pendingSat: number;
    rafId: number | null;
  }>({ active: false, pendingHue: 0, pendingSat: 0, rafId: null });
  const hueRef = useRef<number>(initialHsl.h ?? 0);
  const satRef = useRef<number>(initialHsl.s ?? 0);

  const commitColor = useCallback((hex: string) => {
    if (!anchorId) return;
    const now = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === anchorId ? { ...c, hex, updatedAt: now } : c,
      ),
      pickHistory: [{ hex, source: 'wheel', pickedAt: now }, ...d.pickHistory].slice(0, 12),
      meta: { ...d.meta, updatedAt: now },
    }));
  }, [anchorId, setDoc]);

  const handlePointer = useCallback((evt: React.PointerEvent<SVGSVGElement>) => {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * SIZE - CENTER;
    const y = ((evt.clientY - rect.top) / rect.height) * SIZE - CENTER;
    const r = Math.min(Math.sqrt(x * x + y * y) / RADIUS, 1);
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    const h = (angle + 360) % 360;
    hueRef.current = h;
    satRef.current = r;
    const hex = hsbToHex(h, r, v);
    commitColor(hex);
  }, [commitColor, v]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current.active = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    handlePointer(e);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const indicatorX = CENTER + satRef.current * RADIUS * Math.cos((hueRef.current * Math.PI) / 180);
  const indicatorY = CENTER + satRef.current * RADIUS * Math.sin((hueRef.current * Math.PI) / 180);

  return (
    <div className="sl-cw">
      <svg
        className="sl-cw__disk"
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="sl-cw-saturation" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0, 0%, 100%)" />
            <stop offset="100%" stopColor="hsl(0, 0%, 100%)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g>
          {Array.from({ length: 360 }, (_, i) => {
            const a = (i * Math.PI) / 180;
            const x1 = CENTER + RADIUS * Math.cos(a);
            const y1 = CENTER + RADIUS * Math.sin(a);
            const x2 = CENTER + (RADIUS - 16) * Math.cos(a);
            const y2 = CENTER + (RADIUS - 16) * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke={`hsl(${i}, 100%, 50%)`}
                strokeWidth={1.2}
              />
            );
          })}
        </g>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#sl-cw-saturation)" />
        <circle
          cx={indicatorX} cy={indicatorY}
          r={6}
          fill="none" stroke="#FFFFFF" strokeWidth={2}
        />
        <HarmonyOverlay
          size={SIZE}
          centerX={CENTER}
          centerY={CENTER}
          radius={RADIUS}
          type={doc.viewState.selectedHarmony}
          sourceHex={anchorHex}
        />
      </svg>
      <div className="sl-cw__controls">
        <label className="sl-cw__slider">
          <span>V (明度)</span>
          <input
            type="range"
            min={0} max={100}
            value={doc.viewState.brightness}
            onChange={(e) => {
              const newV = Number(e.target.value);
              setDoc((d) => ({
                ...d,
                viewState: { ...d.viewState, brightness: newV },
                meta: { ...d.meta, updatedAt: Date.now() },
              }));
              // 重新调用 applyColor 反映 V 变化后的 hex
              commitColor(hsbToHex(hueRef.current, satRef.current, newV / 100));
            }}
          />
          <span className="sl-cw__vlabel">{doc.viewState.brightness}</span>
        </label>
        <div className="sl-cw__harmony">
          {HARMONY_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`sl-cw__harmony-btn ${doc.viewState.selectedHarmony === opt.value ? 'is-active' : ''}`}
              onClick={() => setDoc((d) => ({
                ...d,
                viewState: {
                  ...d.viewState,
                  selectedHarmony: opt.value,
                  showHarmony: opt.value != null,
                },
                meta: { ...d.meta, updatedAt: Date.now() },
              }))}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
