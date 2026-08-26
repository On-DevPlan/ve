// packages/react-components/src/color-studio/src/state/useColorStudio.ts
//
// useColorStudio — Consumer hook for ColorStudioProvider.
// 单独拆文件,避开 react-refresh/only-export-components 警告。
// Provider 在 .tsx 同名文件里。

import { useContext } from 'react';
import { ColorStudioContext } from './ColorStudioContext';

export function useColorStudio() {
  const v = useContext(ColorStudioContext);
  if (!v) throw new Error('useColorStudio must be called inside <ColorStudioProvider>');
  return v;
}
