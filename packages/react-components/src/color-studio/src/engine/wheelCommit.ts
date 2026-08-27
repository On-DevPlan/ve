// packages/react-components/src/color-studio/src/engine/wheelCommit.ts
//
// 色盘编辑目标的纯逻辑。
// v2 简化:色盘只负责"编辑当前色卡"。新建统一走调色板添加(空输入→白色),
// 色盘不再承担取新色/落子职责(移除原 create 分支与「加入调色板」按钮)。
//
// 判定规则:有选中色卡或板首色可编辑 → 编辑模式;空调色板 → 无编辑目标。

import type { ColorStudioDocument, Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { addEntryToActivePalette } from '../utils/paletteActions';
import type { PickHistoryItem } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export interface WheelCommitMode {
  /** 'edit' 有可编辑色卡;'empty' 空调色板无编辑目标 */
  mode: 'edit' | 'empty';
  /** 编辑模式的锚点色卡 id;empty 模式为 null */
  anchorColorId: string | null;
}

/**
 * 决定色盘当前编辑目标。
 * - 有 anchor(选中色卡或板首色)→ 编辑模式,anchor 为编辑目标;
 * - 空调色板(无任何色卡)→ empty,色盘提示先添加。
 */
export function pickWheelCommitMode(
  doc: ColorStudioDocument,
  effectiveColorId: string | null,
): WheelCommitMode {
  const anchorId = effectiveColorId ?? doc.palettes.find((p) => p.id === doc.activePaletteId)?.colorIds[0] ?? null;
  if (anchorId) {
    const exists = doc.colorEntries.some((c) => c.id === anchorId);
    if (exists) return { mode: 'edit', anchorColorId: anchorId };
  }
  return { mode: 'empty', anchorColorId: null };
}

/**
 * 色盘编辑:更新 anchor 色卡的 hex。anchor 为空(空板)时原样返回。
 */
export function commitWheelColor(
  doc: ColorStudioDocument,
  anchorColorId: string | null,
  hex: Hex,
  now: number = Date.now(),
): ColorStudioDocument {
  if (!anchorColorId) return doc;
  return {
    ...doc,
    colorEntries: doc.colorEntries.map((c) =>
      c.id === anchorColorId ? { ...c, hex, updatedAt: now } : c,
    ),
    meta: { ...doc.meta, updatedAt: now },
  };
}

/**
 * 新建色卡到活动板并选中(侧栏「新建颜色」/「输入创建」共用)。
 * 空调色板也能新增(白色画布 → 首色)。复用 addEntryToActivePalette 的
 * 入板 + history 逻辑,再补选中。
 */
export function addColorEntryAndSelect(
  doc: ColorStudioDocument,
  hex: Hex,
  source: PickHistoryItem['source'],
  now: number = Date.now(),
): ColorStudioDocument {
  const next = addEntryToActivePalette(doc, hex, source, now);
  const newId = next.palettes.find((p) => p.id === doc.activePaletteId)?.colorIds.at(-1);
  return {
    ...next,
    viewState: { ...next.viewState, selectedColorId: newId ?? null },
  };
}
