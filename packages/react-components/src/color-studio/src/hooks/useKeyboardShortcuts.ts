// packages/react-components/src/color-studio/src/hooks/useKeyboardShortcuts.ts
//
// 全局快捷键:
//   P / E → Eyedropper(open → addPicked 上抛)
//   A / Enter → 把当前活动板 anchor 色复制一份入板末
//   C → copy current hex from active palette's anchor
//   X → 清空 history
// 在 INPUT/TEXTAREA 内不触发,避免抢输入焦点。

import { useEffect, useRef } from 'react';
import { useColorStudio } from '../state/ColorStudioProvider';
import { useEyedropper } from './useEyedropper';
import { writeClipboard } from '../utils/clipboard';
import { makeId } from '../utils/id';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface Options {
  onEyedropperPick?: (hex: Hex) => void;
}

export function useKeyboardShortcuts(opts: Options = {}) {
  const { doc, setDoc } = useColorStudio();
  const { open: openEyedropper, isSupported: eyeSupported } = useEyedropper();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if ((key === 'p' || key === 'e') && eyeSupported) {
        e.preventDefault();
        openEyedropper().then((hex) => {
          if (hex) optsRef.current.onEyedropperPick?.(hex);
        });
        return;
      }

      if (key === 'a' || key === 'enter') {
        e.preventDefault();
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        if (!palette || palette.colorIds.length === 0) return;
        const anchor = doc.colorEntries.find((c) => c.id === palette.colorIds[0]);
        if (!anchor) return;
        const hex = anchor.hex;
        const now = Date.now();
        const newId = makeId(now);
        setDoc((d) => ({
          ...d,
          colorEntries: [
            ...d.colorEntries,
            { id: newId, hex, weight: 1, locked: false, note: '', tags: [], createdAt: now, updatedAt: now },
          ],
          palettes: d.palettes.map((p) =>
            p.id === palette.id ? { ...p, colorIds: [...p.colorIds, newId], updatedAt: now } : p,
          ),
          pickHistory: [{ hex, source: 'shortcut', pickedAt: now }, ...d.pickHistory].slice(0, 12),
          meta: { ...d.meta, updatedAt: now },
        }));
        return;
      }

      if (key === 'c') {
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        const firstCid = palette?.colorIds[0];
        const anchor = firstCid
          ? doc.colorEntries.find((c) => c.id === firstCid)
          : null;
        if (anchor) writeClipboard(anchor.hex).catch(() => undefined);
        return;
      }

      if (key === 'x') {
        setDoc((d) => ({ ...d, pickHistory: [] }));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, setDoc, eyeSupported, openEyedropper]);
}
