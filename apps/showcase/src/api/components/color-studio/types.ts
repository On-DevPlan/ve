// apps/showcase/src/api/components/color-studio/types.ts
//
// 域类型(组件与服务之间的共享契约)。canonical 定义在这里,
// 组件包通过 '@api/components/color-studio/types' 引用。

import { makeId } from '../../../../../../packages/react-components/src/color-studio/src/utils/id';

export type Hex = string; // '#RRGGBB',uppercase,with #

export type HarmonyType =
  | 'complementary'
  | 'triadic'
  | 'split-complementary'
  | 'analogous'
  | 'monochromatic';

export interface ColorEntry {
  id: string;
  hex: Hex;
  weight: number;
  locked: boolean;
  note: string;
  tags: string[];
  /** v1.1.0:分组标签(自由文本),undefined = 未分组 */
  group?: string;
  derivedFrom?: { paletteId: string; rule: HarmonyType };
  createdAt: number;
  updatedAt: number;
}

export interface PaletteHarmony {
  type: HarmonyType;
  anchorColorId: string;
  autoFill: boolean;
}

export interface Palette {
  id: string;
  name: string;
  colorIds: string[];
  harmony: PaletteHarmony | null;
  sortBy: 'manual' | 'hue' | 'brightness' | 'saturation';
  createdAt: number;
  updatedAt: number;
}

export interface PickHistoryItem {
  hex: Hex;
  source: 'wheel' | 'eyedropper' | 'image' | 'paste' | 'shortcut';
  pickedAt: number;
}

export interface ColorStudioViewState {
  leftPane: 'palettes' | 'picker' | 'history';
  showHarmony: boolean;
  selectedHarmony: HarmonyType | null;
  brightness: number;
  /** v1.1.0:调色板列表平铺 / 按组折叠 */
  groupBy: 'none' | 'group';
}

export interface ColorStudioDocument {
  meta: {
    /** v1.1.0 为当前版本;load 时 1.0.0 旧文档由 docSchema 自动升级 */
    schemaVersion: '1.1.0';
    createdAt: number;
    updatedAt: number;
    authorEmail: string;
  };
  activePaletteId: string;
  palettes: Palette[];
  colorEntries: ColorEntry[];
  pickHistory: PickHistoryItem[];
  viewState: ColorStudioViewState;
}

/** Empty doc — used as load-fallback when KV missing or first-time user。 */
export function emptyDoc(authorEmail = '', now = Date.now()): ColorStudioDocument {
  const defaultPaletteId = makeId(now);
  const defaultAnchorId = makeId(now + 1);
  return {
    meta: {
      schemaVersion: '1.1.0',
      createdAt: now,
      updatedAt: now,
      authorEmail,
    },
    activePaletteId: defaultPaletteId,
    palettes: [
      {
        id: defaultPaletteId,
        name: '默认调色板',
        colorIds: [defaultAnchorId],
        harmony: null,
        sortBy: 'manual',
        createdAt: now,
        updatedAt: now,
      },
    ],
    colorEntries: [
      {
        id: defaultAnchorId,
        hex: '#3B82F6',
        weight: 1,
        locked: false,
        note: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    pickHistory: [],
    viewState: {
      leftPane: 'palettes',
      showHarmony: false,
      selectedHarmony: null,
      brightness: 100,
      groupBy: 'none',
    },
  };
}
