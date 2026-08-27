// packages/react-components/src/color-studio/src/engine/importMerge.ts
//
// TOML 导入 → ColorStudioDocument 的增量合并(纯函数)。
// 策略(与 shortcut-library 的增量合并一致):
//   - 同名调色板:颜色追加到该板末尾(不覆盖已有色)
//   - 新调色板名:自动新建调色板,追加到 palettes 末尾
//   - 同一调色板内重复 hex:合并为一条(重复条被跳过,计入 droppedCount)
// 产出统计供 UI 展示;不写文档、不持久化(由顶层 debounce save 处理)。

import { makeId } from '../utils/id';
import type {
  ColorStudioDocument,
  ColorEntry,
} from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import type { ImportParseResult } from './importParser';

export interface ImportMergeStats {
  palettesAdded: number;
  palettesAppended: number;
  colorsAdded: number;
  colorsSkipped: number;
}

export function mergePalettesIntoDoc(
  doc: ColorStudioDocument,
  result: ImportParseResult,
  now: number = Date.now(),
): { doc: ColorStudioDocument; stats: ImportMergeStats } {
  const stats: ImportMergeStats = {
    palettesAdded: 0,
    palettesAppended: 0,
    colorsAdded: 0,
    colorsSkipped: 0,
  };

  // 用递增计数器生成唯一 id;meta.updatedAt 记录触发这次合并的时间点。
  let seq = 0;
  const nextId = () => makeId(now + seq++);
  const mergedAt = now;

  const nextEntries = [...doc.colorEntries];
  const palettes = doc.palettes.map((p) => ({ ...p }));

  for (const imp of result.palettes) {
    const existing = palettes.find((p) => p.name === imp.name);

    if (!existing) {
      // 新建调色板
      const paletteId = nextId();
      const colorIds: string[] = [];
      for (const c of imp.colors) {
        const id = nextId();
        nextEntries.push(makeEntry(id, c.hex, c.weight, c.note, c.tags, mergedAt));
        colorIds.push(id);
        stats.colorsAdded++;
      }
      palettes.push({
        id: paletteId,
        name: imp.name,
        colorIds,
        harmony: null,
        sortBy: 'manual',
        createdAt: mergedAt,
        updatedAt: mergedAt,
      });
      stats.palettesAdded++;
      continue;
    }

    // 追加到已有调色板(同 hex 合并去重)
    const existingHexes = new Set(
      existing.colorIds
        .map((cid) => nextEntries.find((e) => e.id === cid))
        .filter((e): e is ColorEntry => !!e)
        .map((e) => e.hex),
    );
    let appended = 0;
    for (const c of imp.colors) {
      if (existingHexes.has(c.hex)) {
        stats.colorsSkipped++;
        continue;
      }
      const id = nextId();
      nextEntries.push(makeEntry(id, c.hex, c.weight, c.note, c.tags, mergedAt));
      existing.colorIds.push(id);
      existingHexes.add(c.hex);
      appended++;
      stats.colorsAdded++;
    }
    if (appended > 0) {
      existing.updatedAt = mergedAt;
    }
    stats.palettesAppended++;
  }

  return {
    doc: {
      ...doc,
      colorEntries: nextEntries,
      palettes,
      meta: { ...doc.meta, updatedAt: mergedAt },
    },
    stats,
  };
}

function makeEntry(
  id: string,
  hex: ColorEntry['hex'],
  weight: number,
  note: string,
  tags: string[],
  now: number,
): ColorEntry {
  return {
    id,
    hex,
    weight,
    locked: false,
    note,
    tags,
    createdAt: now,
    updatedAt: now,
  };
}
