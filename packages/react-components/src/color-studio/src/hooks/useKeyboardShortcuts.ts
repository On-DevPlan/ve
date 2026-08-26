// packages/react-components/src/color-studio/src/hooks/useKeyboardShortcuts.ts
//
// 全局快捷键(键位消费 useShortcutPrefs 的映射,支持自定义):
//   eyedropper(默认 p,e 为别名)→ EyeDropper
//   addColor(默认 a)→ 把当前活动板 anchor 色复制一份入板末
//   copy(默认 c)→ copy current hex
//   clearHistory(默认 x)→ 清空 history
// 在 INPUT/TEXTAREA 内不触发。

import { useEffect, useRef } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { useEyedropper } from './useEyedropper';
import { writeClipboard } from '../utils/clipboard';
import { makeId } from '../utils/id';
import { formatHexAs } from '../engine/colorMath';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import type { ShortcutMap } from '../../../../../../apps/showcase/src/api/components/color-studio/createShortcutPrefsStore';
import type { CopyableFormat } from '../engine/colorMath';

interface Options {
  shortcuts: ShortcutMap;
  /** C 键复制使用的格式(用户首选项) */
  copyFormat?: CopyableFormat;
  onEyedropperPick?: (hex: Hex) => void;
}

export function useKeyboardShortcuts(opts: Options) {
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
      const sc = optsRef.current.shortcuts;

      if ((key === sc.eyedropper || key === 'e') && eyeSupported) {
        e.preventDefault();
        openEyedropper().then((hex) => {
          if (hex) optsRef.current.onEyedropperPick?.(hex);
        });
        return;
      }

      if (key === sc.addColor || key === 'enter') {
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

      if (key === sc.copy) {
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        const firstCid = palette?.colorIds[0];
        const anchor = firstCid ? doc.colorEntries.find((c) => c.id === firstCid) : null;
        if (anchor) {
          const text = optsRef.current.copyFormat
            ? formatHexAs(anchor.hex, optsRef.current.copyFormat)
            : anchor.hex;
          writeClipboard(text).catch(() => undefined);
        }
        return;
      }

      if (key === sc.clearHistory) {
        setDoc((d) => ({ ...d, pickHistory: [] }));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, setDoc, eyeSupported, openEyedropper]);
}
