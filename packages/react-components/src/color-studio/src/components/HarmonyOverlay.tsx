// packages/react-components/src/color-studio/src/components/HarmonyOverlay.tsx
//
// SVG 几何叠加(互补线/三角框/类似 V 形/分裂互补/单色同心圆)绘在色盘上。

import type { Hex, HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface Props {
  size: number;
  centerX: number;
  centerY: number;
  radius: number;
  type: HarmonyType | null;
  sourceHex: Hex | null;
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function HarmonyOverlay({ centerX, centerY, radius, type, sourceHex }: Props) {
  if (!type || !sourceHex) return null;
  const stroke = sourceHex;

  switch (type) {
    case 'complementary': {
      const far = polar(centerX, centerY, radius, 180);
      return (
        <g>
          <line
            x1={centerX} y1={centerY}
            x2={far.x} y2={far.y}
            stroke={stroke} strokeWidth={2} strokeDasharray="4 3"
          />
          <circle cx={far.x} cy={far.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'triadic': {
      const a = polar(centerX, centerY, radius, 120);
      const b = polar(centerX, centerY, radius, 240);
      return (
        <g>
          <line x1={centerX} y1={centerY} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={centerX} y1={centerY} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'analogous': {
      const a = polar(centerX, centerY, radius, -30);
      const b = polar(centerX, centerY, radius, 30);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'split-complementary': {
      const a = polar(centerX, centerY, radius, 150);
      const b = polar(centerX, centerY, radius, 210);
      return (
        <g>
          <line x1={centerX} y1={centerY} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={centerX} y1={centerY} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'monochromatic':
      return (
        <g>
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <circle
              key={t}
              cx={centerX} cy={centerY}
              r={radius * t}
              fill="none"
              stroke={stroke} strokeWidth={1} strokeDasharray="2 4"
            />
          ))}
        </g>
      );
  }
  return null;
}
