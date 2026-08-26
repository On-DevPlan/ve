// packages/react-components/src/color-studio/src/components/PickerPanel.tsx
//
// EyeDropper 入口 + 图像取色器入口。

import { useColorStudio } from '../state/useColorStudio';
import { useEyedropper } from '../hooks/useEyedropper';
import { makeId } from '../utils/id';
import { ImageColorPicker } from './ImageColorPicker';

interface Props {
  onPicked?: (hex: string) => void;
}

export function PickerPanel({ onPicked }: Props) {
  const { doc, setDoc } = useColorStudio();
  const { isSupported, open } = useEyedropper();
  const { activePaletteId } = doc;

  const addPicked = (hex: string) => {
    if (!hex) return;
    const id = makeId();
    const ts = Date.now();
    setDoc((d) => ({
      ...d,
      colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
      palettes: d.palettes.map((p) => p.id === activePaletteId
        ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts }
        : p),
      pickHistory: [{ hex, source: 'eyedropper', pickedAt: ts }, ...d.pickHistory].slice(0, 12),
      meta: { ...d.meta, updatedAt: ts },
    }));
    onPicked?.(hex);
  };

  return (
    <div className="sl-cs-picker">
      <button
        type="button"
        className="sl-cs-picker__eyedropper"
        disabled={!isSupported}
        onClick={() => open().then((h) => h && addPicked(h))}
      >
        {isSupported ? '🎯 屏幕取色 (P)' : '🎯 当前浏览器不支持取色器'}
      </button>
      <ImageColorPicker onPick={addPicked} />
    </div>
  );
}
