// packages/react-components/src/color-studio/src/engine/autoFill.ts
//
// 和声 autoFill 纯逻辑:anchor 色变化时,把派生 hex 写回 derivedFrom 匹配
// 的 colorEntries;缺的补,多余的删,顺序跟派生输出一致。

import type { ColorStudioDocument } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { deriveHarmony } from './harmony';
import { makeId } from '../utils/id';

export function applyAutoFill(doc: ColorStudioDocument, paletteId: string): ColorStudioDocument {
  const palette = doc.palettes.find((p) => p.id === paletteId);
  if (!palette?.harmony || !palette.harmony.autoFill) return doc;
  const { type, anchorColorId } = palette.harmony;
  const anchor = doc.colorEntries.find((c) => c.id === anchorColorId);
  if (!anchor) return doc;

  const derived = deriveHarmony(anchor.hex, type); // 含 anchor 本身(第 0 个)
  const now = Date.now();

  // 派生输出里去掉 anchor 本身,剩下的是要写回的派生色
  const derivedOnly = derived.slice(1);

  // 现有派生条目(属于本 palette、derivedFrom.rule === type、非 anchor)
  const existingDerived = palette.colorIds
    .map((cid) => doc.colorEntries.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> =>
      !!c && c.id !== anchor.id && c.derivedFrom?.paletteId === paletteId && c.derivedFrom?.rule === type);

  const nextEntries = [...doc.colorEntries];
  const newIds: string[] = [];

  for (let i = 0; i < derivedOnly.length; i++) {
    const hex = derivedOnly[i] as string;
    const existing = existingDerived[i];
    if (existing) {
      // 更新既有条目色值
      const idx = nextEntries.findIndex((e) => e.id === existing.id);
      if (idx >= 0) nextEntries[idx] = { ...nextEntries[idx] as typeof existing, hex, updatedAt: now };
      newIds.push(existing.id);
    } else {
      // 新增派生条目
      const id = makeId(now + i);
      nextEntries.push({
        id,
        hex,
        weight: 1,
        locked: false,
        note: '',
        tags: [],
        derivedFrom: { paletteId, rule: type },
        createdAt: now,
        updatedAt: now,
      });
      newIds.push(id);
    }
  }

  // 多余的旧派生条目:从 palette 移除(条目留在 colorEntries 池里,避免跨 palette 引用断裂)
  const keepIds = new Set(newIds);
  const removedIds = new Set(existingDerived.slice(derivedOnly.length).map((e) => e.id));

  return {
    ...doc,
    colorEntries: nextEntries,
    palettes: doc.palettes.map((p) => {
      if (p.id !== paletteId) return p;
      // 重排:非派生条目保持原相对顺序,派生条目追加到末尾
      const nonDerived = p.colorIds.filter((cid) => !removedIds.has(cid) && !keepIds.has(cid));
      return { ...p, colorIds: [...nonDerived, ...newIds], updatedAt: now };
    }),
    meta: { ...doc.meta, updatedAt: now },
  };
}
