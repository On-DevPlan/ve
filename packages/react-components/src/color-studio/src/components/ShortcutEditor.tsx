// packages/react-components/src/color-studio/src/components/ShortcutEditor.tsx
//
// 快捷键编辑面板:每个动作一行,点键位徽章进入捕获态,按新键即绑定。
// 冲突时显示提示(不写入)。重置按钮恢复默认。

import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';
import type { ShortcutAction } from '../hooks/useShortcutPrefs';
import { shortcutActionLabel } from '../hooks/useShortcutPrefs';
import { DEFAULT_SHORTCUTS } from '../../../../../../apps/showcase/src/api/components/color-studio/createShortcutPrefsStore';
import type { ShortcutPrefs } from '../../../../../../apps/showcase/src/api/components/color-studio/createShortcutPrefsStore';

interface Props {
  prefs: ShortcutPrefs;
  ready: boolean;
  setKey: (action: ShortcutAction, key: string) => string | null;
  resetAll: () => void;
}

const ACTIONS: ShortcutAction[] = ['eyedropper', 'addColor', 'copy', 'clearHistory'];

export function ShortcutEditor({ prefs, ready, setKey, resetAll }: Props) {
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);

  // 捕获态:全局监听一次按键
  useEffect(() => {
    if (!capturing) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(null);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const err = setKey(capturing, e.key);
        if (err) setConflictMsg(`"${e.key.toLowerCase()}" 已被「${err}」占用`);
        else setConflictMsg(null);
      }
      setCapturing(null);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [capturing, setKey]);

  return (
    <div className="sl-cs-kbds" ref={captureRef}>
      <div className="sl-cs-kbds__head">
        <h4><Icon name="keyboard" size={14} /> 快捷键</h4>
        <Btn variant="ghost" size="sm" icon="sync" onClick={resetAll} title="恢复默认键位">
          重置
        </Btn>
      </div>
      <ul>
        {ACTIONS.map((action) => {
          const key = prefs.shortcuts[action];
          const isDefault = key === DEFAULT_SHORTCUTS[action];
          return (
            <li key={action}>
              <span className="sl-cs-kbds__label">{shortcutActionLabel(action)}</span>
              <button
                type="button"
                className={`sl-cs-kbds__keybtn ${capturing === action ? 'is-capturing' : ''}`}
                onClick={() => { setCapturing(action); setConflictMsg(null); }}
                aria-label={`修改 ${shortcutActionLabel(action)} 键位`}
                title="点击后按新键"
              >
                {capturing === action ? '按新键…' : key.toUpperCase()}
              </button>
              {!isDefault && <span className="sl-cs-kbds__custom" title="自定义">·</span>}
            </li>
          );
        })}
      </ul>
      {!ready && <p className="sl-cs-kbds__loading">键位加载中…</p>}
      {conflictMsg && <p className="sl-cs-kbds__conflict">{conflictMsg}</p>}
    </div>
  );
}
