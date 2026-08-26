// packages/react-components/src/color-studio/src/utils/grouping.ts
//
// 分组聚合纯函数:PaletteSidebar 渲染时用。

import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export interface ColorGroup {
  /** 组名;undefined 表示未分组(渲染时放最后,标签固定"未分组") */
  name: string | undefined;
  entries: ColorEntry[];
}

/**
 * 按 entry.group 聚合,保持输入顺序稳定(同组按出现顺序)。
 * 未分组(undefined / '')统一收进 name=undefined 桶,排最后。
 */
export function groupByEntries(entries: ColorEntry[]): ColorGroup[] {
  const groups = new Map<string, ColorEntry[]>();
  const ungrouped: ColorEntry[] = [];
  for (const e of entries) {
    const g = (e.group ?? '').trim();
    if (!g) {
      ungrouped.push(e);
      continue;
    }
    const bucket = groups.get(g);
    if (bucket) bucket.push(e);
    else groups.set(g, [e]);
  }
  const named = Array.from(groups.entries())
    .map(([name, es]) => ({ name, entries: es }));
  if (ungrouped.length > 0) named.push({ name: undefined, entries: ungrouped });
  return named;
}

/** 列出当前文档所有非空 group 名(去重,保持出现顺序)。 */
export function listGroupNames(entries: ColorEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const g = (e.group ?? '').trim();
    if (g && !seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}
