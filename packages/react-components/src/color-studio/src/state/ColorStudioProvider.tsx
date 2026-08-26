// packages/react-components/src/color-studio/src/state/ColorStudioProvider.tsx
//
// 顶层 React context。挂载时从 KV load;doc 变化 600ms debounce 后 save。
// 严格不变量:palettes.colorIds 引用必须能在 colorEntries 找到。

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createColorStudioStore } from '../../../../../../apps/showcase/src/api/components/color-studio/createColorStudioStore';
import { subscribeJwtAuth, getJwtAuthSnapshot } from '../../../../../../apps/showcase/src/api/http/auth-store';
import type {
  ColorStudioDocument,
} from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import { emptyDoc } from '../../../../../../apps/showcase/src/api/components/color-studio/types';
import {
  ColorStudioContext,
  type ColorStudioAuthState,
  type StudioStatus,
} from './ColorStudioContext';

function isLoggedIn(jwtStatus: { jwtAuthState: string }): boolean {
  return jwtStatus.jwtAuthState === 'logged-in';
}

function assertInvariants(doc: ColorStudioDocument): void {
  const ids = new Set(doc.colorEntries.map((c) => c.id));
  for (const p of doc.palettes) {
    for (const cid of p.colorIds) {
      if (!ids.has(cid)) {
        throw new Error(
          `palette ${p.id} references missing colorEntry ${cid}; document is corrupt`,
        );
      }
    }
  }
  if (!doc.palettes.find((p) => p.id === doc.activePaletteId)) {
    throw new Error(`activePaletteId ${doc.activePaletteId} not in palettes`);
  }
}

export function ColorStudioProvider({ children }: { children: ReactNode }) {
  const [doc, setDocState] = useState<ColorStudioDocument>(() => emptyDoc());
  const [status, setStatus] = useState<StudioStatus>('loading');
  const [authState, setAuthState] = useState<ColorStudioAuthState>(
    isLoggedIn(getJwtAuthSnapshot()) ? 'logged-in' : 'logged-out',
  );
  const storeRef = useRef(createColorStudioStore());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  const forceReload = useCallback(async () => {
    setStatus('loading');
    try {
      const loaded = await storeRef.current.load();
      assertInvariants(loaded);
      setDocState(loaded);
      lastSavedJsonRef.current = JSON.stringify(loaded);
      setStatus('idle');
    } catch {
      setDocState(emptyDoc());
      setStatus('error');
    }
  }, []);

  // mount: load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await storeRef.current.load();
        if (cancelled) return;
        assertInvariants(loaded);
        setDocState(loaded);
        lastSavedJsonRef.current = JSON.stringify(loaded);
        setStatus('idle');
      } catch {
        if (cancelled) return;
        setDocState(emptyDoc());
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // subscribe to JWT auth state
  useEffect(() => {
    return subscribeJwtAuth(() => {
      setAuthState(isLoggedIn(getJwtAuthSnapshot()) ? 'logged-in' : 'logged-out');
    });
  }, []);

  // debounced save on doc change
  const setDoc = useCallback<Dispatch<SetStateAction<ColorStudioDocument>>>((updater) => {
    setDocState((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (d: ColorStudioDocument) => ColorStudioDocument)(prev)
        : updater;
      try { assertInvariants(next); } catch {
        setStatus('error');
        return prev;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
        const json = JSON.stringify(next);
        if (json === lastSavedJsonRef.current) {
          setStatus('synced');
          return;
        }
        try {
          await storeRef.current.save(next);
          lastSavedJsonRef.current = json;
          setStatus('synced');
        } catch {
          setStatus('error');
        }
      }, 600);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ doc, setDoc, status, authState, forceReload }),
    [doc, setDoc, status, authState, forceReload],
  );

  return <ColorStudioContext.Provider value={value}>{children}</ColorStudioContext.Provider>;
}
