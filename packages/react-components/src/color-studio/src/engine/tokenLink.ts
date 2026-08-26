// packages/react-components/src/color-studio/src/engine/tokenLink.ts
//
// 全局 Token 联动纯逻辑:
//   - promoteToToken:把一个 colorEntry 提升为全局 token(同 hex 复用已有 token)
//   - unlinkToken:解除条目的 tokenId 引用
//   - syncTokenLinks:token hex 变化时同步所有引用条目(改源头全联动)

import type {
  ColorStudioDocument,
  GlobalToken,
} from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { makeId } from '../utils/id';

/** 提升/链接:返回 tokenId。同 hex 已有 token 时复用,否则新建。 */
export function promoteToToken(doc: ColorStudioDocument, entryId: string, name: string): { doc: ColorStudioDocument; tokenId: string } {
  const entry = doc.colorEntries.find((c) => c.id === entryId);
  if (!entry) return { doc, tokenId: '' };
  const now = Date.now();
  const existing = doc.globalTokens.find((t) => t.hex === entry.hex);
  let tokenId: string;
  let tokens = [...doc.globalTokens];
  if (existing) {
    tokenId = existing.id;
  } else {
    tokenId = makeId(now);
    const token: GlobalToken = {
      id: tokenId,
      name: name.trim() || `Token ${doc.globalTokens.length + 1}`,
      hex: entry.hex,
      createdAt: now,
      updatedAt: now,
    };
    tokens = [...tokens, token];
  }
  return {
    doc: {
      ...doc,
      globalTokens: tokens,
      colorEntries: doc.colorEntries.map((c) =>
        c.id === entryId ? { ...c, tokenId, updatedAt: now } : c,
      ),
      meta: { ...doc.meta, updatedAt: now },
    },
    tokenId,
  };
}

/** 解除条目引用(不动 token 本体)。 */
export function unlinkToken(doc: ColorStudioDocument, entryId: string): ColorStudioDocument {
  const now = Date.now();
  return {
    ...doc,
    colorEntries: doc.colorEntries.map((c) => {
      if (c.id !== entryId) return c;
      const rest = { ...c };
      delete rest.tokenId;
      return { ...rest, updatedAt: now };
    }),
    meta: { ...doc.meta, updatedAt: now },
  };
}

/** token hex 变化 → 同步所有引用条目。返回 null 表示无变化。 */
export function syncTokenLinks(doc: ColorStudioDocument, tokenId: string, newHex: string): ColorStudioDocument | null {
  const now = Date.now();
  const linked = doc.colorEntries.some((c) => c.tokenId === tokenId && c.hex !== newHex);
  if (!linked) return null;
  return {
    ...doc,
    colorEntries: doc.colorEntries.map((c) =>
      c.tokenId === tokenId ? { ...c, hex: newHex, updatedAt: now } : c,
    ),
    meta: { ...doc.meta, updatedAt: now },
  };
}
