// packages/react-components/src/color-studio/src/components/PickerPanel.tsx
//
// EyeDropper 入口 + 图像取色器入口。

import { useColorStudio } from '../state/useColorStudio';
import { useEyedropper } from '../hooks/useEyedropper';
import { addEntryToActivePalette } from '../utils/paletteActions';
import { Btn } from './ui/Btn';
import { ImageColorPicker } from './ImageColorPicker';

interface Props {
  onPicked?: (hex: string) => void;
}

export function PickerPanel({ onPicked }: Props) {
  const { setDoc } = useColorStudio();
  const { isSupported, open } = useEyedropper();

  const addPicked = (hex: string) => {
    if (!hex) return;
    setDoc((d) => addEntryToActivePalette(d, hex, 'eyedropper'));
    onPicked?.(hex);
  };

  return (
    <div className="sl-cs-picker">
      <Btn
        variant="secondary"
        icon="eyedropper"
        disabled={!isSupported}
        onClick={() => open().then((h) => h && addPicked(h))}
        title={isSupported ? '浏览器原生屏幕取色' : '当前浏览器不支持 EyeDropper API'}
        aria-label="屏幕取色"
      >
        {isSupported ? '屏幕取色' : '不支持取色器'}
      </Btn>
      <ImageColorPicker onPick={addPicked} />
    </div>
  );
}
