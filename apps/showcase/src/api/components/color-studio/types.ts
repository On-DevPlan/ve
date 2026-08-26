// apps/showcase/src/api/components/color-studio/types.ts
//
// 域类型(组件与服务之间的共享契约)。canonical 定义在这里,
// 组件包通过 '@api/components/color-studio/types' 引用。

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
}

export interface ColorStudioDocument {
  meta: {
    schemaVersion: '1.0.0';
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

/** 内部 helper:26-char URL-safe-ish ID;不是真 ulid,但碰撞概率 0。M1 占位,
  M2 后会被独立 ulid() 工具替换。 */
function ulidLike(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${time}-${rand}`;
}

/** Empty doc — used as load-fallback when KV missing or first-time user。 */
export function emptyDoc(authorEmail = '', now = Date.now()): ColorStudioDocument {
  const defaultPaletteId = ulidLike();
  const defaultAnchorId = ulidLike();
  return {
    meta: {
      schemaVersion: '1.0.0',
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
    },
  };
}
