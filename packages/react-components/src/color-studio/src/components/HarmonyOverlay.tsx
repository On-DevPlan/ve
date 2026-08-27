// packages/react-components/src/color-studio/src/components/HarmonyOverlay.tsx
//
// SVG 几何叠加(互补线/三角框/类似 V 形/分裂互补/单色同心圆)绘在色盘上。
// 小点/连线角度相对 anchor 色相角偏移(经 harmonyMarkerAngles),
// 使标记跟随当前选择的颜色,而非固定在色盘地理方位。

import type { Hex, HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { fromHex } from '../engine/colorMath';
import {
  harmonyMarkerAngles,
  harmonyMarkerRadiusFactor,
} from '../engine/harmony';

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

  // anchor 色相角:标记角度相对它偏移,小点随所选颜色移动
  const anchorHue = fromHex(sourceHex).hsl.h ?? 0;
  // anchor HSV 饱和度:色盘半径 = 饱和度,派生点画在与 anchor 相同深度处
  const anchorSaturation = fromHex(sourceHex).hsv.s ?? 0;
  const factors = harmonyMarkerRadiusFactor(type, anchorSaturation);
  // anchor 本身在色盘上的位置(连线从这里出发,而非圆心)
  const anchorPos = polar(centerX, centerY, radius * anchorSaturation, anchorHue);

  switch (type) {
    case 'complementary': {
      const [farDeg] = harmonyMarkerAngles(anchorHue, type);
      const [farF] = factors;
      const far = polar(centerX, centerY, radius * farF, farDeg);
      return (
        <g>
          <line
            x1={anchorPos.x} y1={anchorPos.y}
            x2={far.x} y2={far.y}
            stroke={stroke} strokeWidth={2} strokeDasharray="4 3"
          />
          <circle cx={far.x} cy={far.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'triadic': {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return (
        <g>
          <line x1={anchorPos.x} y1={anchorPos.y} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={anchorPos.x} y1={anchorPos.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'analogous': {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'split-complementary': {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return (
        <g>
          <line x1={anchorPos.x} y1={anchorPos.y} x2={a.x} y2={a.y} stroke={stroke} strokeWidth={2} />
          <line x1={anchorPos.x} y1={anchorPos.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} />
          <circle cx={a.x} cy={a.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={6} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      );
    }
    case 'monochromatic': {
      return (
        <g>
          {factors.map((t) => (
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
  }
  return null;
}
