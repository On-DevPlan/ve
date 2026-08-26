// packages/react-components/src/color-studio/src/state/ColorStudioContext.ts
//
// 只放 Context 实例 + 类型,避免 Provider 文件混合导出 component + hook
// (触发 react-refresh/only-export-components)。

import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ColorStudioDocument } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export type StudioStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error';

export type ColorStudioAuthState = 'logged-out' | 'logged-in' | 'syncing' | 'error';

export interface ColorStudioContextValue {
  doc: ColorStudioDocument;
  setDoc: Dispatch<SetStateAction<ColorStudioDocument>>;
  status: StudioStatus;
  authState: ColorStudioAuthState;
  forceReload: () => Promise<void>;
}

export const ColorStudioContext = createContext<ColorStudioContextValue | null>(null);
