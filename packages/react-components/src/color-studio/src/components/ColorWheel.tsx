// packages/react-components/src/color-studio/src/components/ColorWheel.tsx
//
// 标准 HSB 圆盘(Canvas 渲染):
//   - 色相沿圆周(0-360°),饱和度沿半径(中心 0 → 边缘 100%),明度独立滑杆
//   - 指示点位置从 anchor hex 反推(受控):色盘/滑杆/外部改色 三方一致
//   - 拖拽用 rAF 节流;pointer capture 支持拖出圆盘继续调
//   - 和声规则叠加(HarmonyOverlay)+ autoFill 开关

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { useSelectedColor } from '../hooks/useSelectedColor';
import { fromHex, toHex } from '../engine/colorMath';
import { addEntryToActivePalette } from '../utils/paletteActions';
import { Btn } from './ui/Btn';
import { HarmonyOverlay } from './HarmonyOverlay';
import type { HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 4;

const HARMONY_OPTIONS: { value: HarmonyType | null; label: string }[] = [
  { value: null, label: '无' },
  { value: 'complementary', label: '互补' },
  { value: 'triadic', label: '三角' },
  { value: 'analogous', label: '类似' },
  { value: 'split-complementary', label: '分裂互补' },
  { value: 'monochromatic', label: '单色' },
];

/** hex → { h: 0..360, s: 0..1, v: 0..1 } */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { rgb } = fromHex(hex);
  const r = rgb.r, g = rgb.g, b = rgb.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** h/s/v(0..360, 0..1, 0..1)→ hex */
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return toHex({ mode: 'rgb', r: r + m, g: g + m, b: b + m });
}

/** 画标准 HSB 圆盘:逐像素 ImageData(300×300 一次性 ~9 万像素,可接受)。 */
function paintWheel(ctx: CanvasRenderingContext2D, v: number) {
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CENTER;
      const dy = y - CENTER;
      const r = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * SIZE + x) * 4;
      if (r > RADIUS) {
        data[idx + 3] = 0;
        continue;
      }
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const h = (angle + 360) % 360;
      const s = Math.min(r / RADIUS, 1);
      // HSV → RGB
      const c = v * s;
      const hp = h / 60;
      const xx = c * (1 - Math.abs((hp % 2) - 1));
      let rr = 0, gg = 0, bb = 0;
      if (hp >= 0 && hp < 1) { rr = c; gg = xx; }
      else if (hp < 2) { rr = xx; gg = c; }
      else if (hp < 3) { gg = c; bb = xx; }
      else if (hp < 4) { gg = xx; bb = c; }
      else if (hp < 5) { rr = xx; bb = c; }
      else { rr = c; bb = xx; }
      const m = v - c;
      data[idx] = Math.round((rr + m) * 255);
      data[idx + 1] = Math.round((gg + m) * 255);
      data[idx + 2] = Math.round((bb + m) * 255);
      // 边缘 2px 抗锯齿
      data[idx + 3] = r > RADIUS - 2 ? Math.round(255 * (RADIUS - r) / 2) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function ColorWheel() {
  const { doc, setDoc } = useColorStudio();
  const { entry: selected, effectiveId: anchorId } = useSelectedColor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [cursor, setCursor] = useState<{ h: number; s: number } | null>(null);

  const anchorHex = selected?.hex ?? '#000000';
  const v = doc.viewState.brightness / 100;

  // 受控:anchor hex 反推指示点(色盘点击 / 滑杆 / 外部改色 都会流经这里)
  const hsv = useMemo(() => hexToHsv(anchorHex), [anchorHex]);
  const indicator = cursor ?? { h: hsv.h, s: hsv.s };

  const commitHex = useCallback((h: number, s: number, vv: number) => {
    if (!anchorId) return;
    const hex = hsvToHex(h, s, vv);
    const now = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === anchorId ? { ...c, hex, updatedAt: now } : c,
      ),
      meta: { ...d.meta, updatedAt: now },
    }));
  }, [anchorId, setDoc]);

  // 明度变化 → 重画圆盘
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paintWheel(ctx, v);
  }, [v]);

  const handlePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CENTER;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CENTER;
    const r = Math.sqrt(x * x + y * y);
    const s = Math.min(r / RADIUS, 1);
    const h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    setCursor({ h, s });
    // rAF 节流 commit
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      commitHex(h, s, v);
      rafRef.current = null;
    });
  }, [commitHex, v]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    handlePointer(e);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    setCursor(null); // 回到受控态
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const indX = CENTER + indicator.s * RADIUS * Math.cos((indicator.h * Math.PI) / 180);
  const indY = CENTER + indicator.s * RADIUS * Math.sin((indicator.h * Math.PI) / 180);

  return (
    <div className="sl-cw">
      <div className="sl-cw__diskwrap">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="sl-cw__disk"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="HSB 色盘:色相沿圆周,饱和度沿半径"
        />
        {/* 指示点叠加层(SVG,不参与重绘) */}
        <svg className="sl-cw__overlay" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={indX} cy={indY}
            r={7}
            fill={anchorHex}
            stroke="#FFFFFF" strokeWidth={2.5}
            style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.5))', pointerEvents: 'none' }}
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
      </div>
      <div className="sl-cw__controls">
        {/* 快速落子:当前正在调的颜色一键存为新色卡(快捷键 A) */}
        <div className="sl-cw__quickrow">
          <span className="sl-cw__quickrow-hex" style={{ backgroundColor: anchorHex }} title={anchorHex} />
          <code className="sl-cw__quickrow-value">{anchorHex}</code>
          <Btn
            variant="primary"
            icon="plus"
            onClick={() => setDoc((d) => addEntryToActivePalette(d, anchorHex, 'wheel'))}
            title="把当前正在生成的颜色存为新色卡(快捷键 A)"
          >
            加入调色板
          </Btn>
          <span className="sl-cw__quickrow-kbd">A</span>
        </div>
        <label className="sl-cw__slider">
          <span>B (明度)</span>
          <input
            type="range"
            min={0} max={100}
            value={doc.viewState.brightness}
            onChange={(e) => {
              const newV = Number(e.target.value);
              setDoc((d) => ({
                ...d,
                // 明度滑杆同时改 viewState(记忆)与 anchor hex(实时反馈)
                viewState: { ...d.viewState, brightness: newV },
                colorEntries: d.colorEntries.map((c) =>
                  c.id === anchorId
                    ? { ...c, hex: hsvToHex(indicator.h, indicator.s, newV / 100), updatedAt: Date.now() }
                    : c,
                ),
                meta: { ...d.meta, updatedAt: Date.now() },
              }));
            }}
          />
          <span className="sl-cw__vlabel">{doc.viewState.brightness}</span>
        </label>
        <div className="sl-cw__harmony">
          {HARMONY_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${doc.viewState.selectedHarmony === opt.value ? 'is-active' : ''}`}
              onClick={() => setDoc((d) => ({
                ...d,
                palettes: d.palettes.map((p) => p.id === d.activePaletteId && opt.value
                  ? {
                      ...p,
                      harmony: {
                        type: opt.value,
                        // 和声锚点 = 当前选中的色卡(而非固定首色)
                        anchorColorId: anchorId ?? p.colorIds[0] ?? '',
                        autoFill: p.harmony?.autoFill ?? false,
                      },
                      updatedAt: Date.now(),
                    }
                  : p),
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
        {(() => {
          const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
          if (!p || !p.harmony) return null;
          return (
            <label className="sl-cw__autofill">
              <input
                type="checkbox"
                checked={p.harmony.autoFill}
                onChange={(e) => setDoc((d) => ({
                  ...d,
                  palettes: d.palettes.map((x) => x.id === p.id && x.harmony
                    ? { ...x, harmony: { ...x.harmony, autoFill: e.target.checked }, updatedAt: Date.now() }
                    : x),
                  meta: { ...d.meta, updatedAt: Date.now() },
                }))}
              />
              <span>锚色变化自动重派生</span>
            </label>
          );
        })()}
      </div>
    </div>
  );
}
