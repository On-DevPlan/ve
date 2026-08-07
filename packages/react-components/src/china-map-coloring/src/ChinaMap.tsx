// src/ChinaMap.tsx —— 画布组件：数据加载、构建、渲染、事件
import { useEffect, useRef, useState } from 'react';
import type { ProvincePath } from './types';
import { buildProvinces } from './lib/geojson';
import { hitTest } from './lib/hitTest';
import { renderMap } from './lib/render';

interface ChinaMapProps {
  colorByProvince: Record<string, string>;
  onProvinceClick: (name: string) => void;
  debugMode: boolean;
}

const CANVAS_W = 1200;
const CANVAS_H = 900;

export default function ChinaMap({ colorByProvince, onProvinceClick, debugMode }: ChinaMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [provinces, setProvinces] = useState<ProvincePath[] | null>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);

  // 一次性加载 + 构建（画布逻辑尺寸固定，resize 由 CSS 缩放处理，无需重绘）
  useEffect(() => {
    let cancelled = false;
    fetch('/map/json/china.json', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((fc) => {
        if (cancelled) return;
        setProvinces(buildProvinces(fc, CANVAS_W, CANVAS_H));
      })
      .catch((err) => console.error('[china-map-coloring] load china.json failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // 依赖变化时重绘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !provinces) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMap(ctx, provinces, colorByProvince, hoverName, debugMode);
  }, [provinces, colorByProvince, hoverName, debugMode]);

  const handlePointer = (clientX: number, clientY: number, click: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || !provinces) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const name = hitTest(provinces, ctx, clientX, clientY);
    if (click) {
      if (name) onProvinceClick(name);
    } else {
      setHoverName(name);
      canvas.style.cursor = name ? 'pointer' : 'default';
    }
  };

  return (
    <div className="sl-cmc-map">
      {!provinces ? <div className="sl-cmc-skeleton" aria-hidden="true" /> : null}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={provinces ? 'sl-cmc-canvas' : 'sl-cmc-canvas sl-cmc-canvas--hidden'}
        role="img"
        aria-label="中国地图"
        onPointerDown={(e) => handlePointer(e.clientX, e.clientY, true)}
        onPointerMove={(e) => handlePointer(e.clientX, e.clientY, false)}
        onPointerLeave={() => {
          setHoverName(null);
          if (canvasRef.current) canvasRef.current.style.cursor = 'default';
        }}
      />
      {hoverName ? <div className="sl-cmc-bubble">{hoverName}</div> : null}
    </div>
  );
}
