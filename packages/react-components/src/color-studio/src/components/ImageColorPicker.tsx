// packages/react-components/src/color-studio/src/components/ImageColorPicker.tsx
//
// 上传图片 → 缩放 max 256 → canvas hover 取色 + K-means 主色按钮。

import { useCallback, useRef, useState } from 'react';
import { extractDominantColors } from '../engine/colorExtraction';
import { toHex } from '../engine/colorMath';

interface Props { onPick: (hex: string) => void; }

const MAX_SIDE = 256;

export function ImageColorPicker({ onPick }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hoverHex, setHoverHex] = useState<string | null>(null);

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(MAX_SIDE / img.width, MAX_SIDE / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = canvasRef.current!;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
  }, []);

  const onHover = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((evt.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((evt.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d')!;
    const px = ctx.getImageData(x, y, 1, 1).data;
    const r = Math.round((px[0] ?? 0));
    const g = Math.round((px[1] ?? 0));
    const b = Math.round((px[2] ?? 0));
    setHoverHex(toHex({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 }));
  }, []);

  const onClick = useCallback(() => {
    if (hoverHex) onPick(hoverHex);
  }, [hoverHex, onPick]);

  const extractDominant = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = extractDominantColors(data, 6);
    palette.slice(0, 5).forEach(onPick);
  }, [onPick]);

  return (
    <div className="sl-cs-imagepicker">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: 'none' }}
        aria-label="选择取色图片"
      />
      <button type="button" onClick={() => fileRef.current?.click()}>上传图片取色</button>
      {imageUrl && (
        <div className="sl-cs-imagepicker__preview">
          <canvas
            ref={canvasRef}
            onMouseMove={onHover}
            onMouseLeave={() => setHoverHex(null)}
            onClick={onClick}
            style={{ maxWidth: '100%', cursor: 'crosshair' }}
          />
          {hoverHex && (
            <div className="sl-cs-imagepicker__hover">
              <span
                className="sl-cs-imagepicker__chip"
                style={{ backgroundColor: hoverHex }}
              />
              <code>{hoverHex}</code>
              <button type="button" onClick={onClick}>加入</button>
            </div>
          )}
          <button type="button" onClick={extractDominant}>提取 5 主色</button>
        </div>
      )}
    </div>
  );
}
