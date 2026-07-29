// Keyboard.tsx —— 简化的扁平键盘预览
// 接收 highlightedCodes 集合,把对应键渲染为"按下"状态
// 风格参考 zfrontier:flat,两态(浅色未按,深色按下)
//
// 每个键是独立的 Key 子组件:
//   - 鼠标按住 ≥ LONG_PRESS_MS → 通过 onLongPress(code, rect) 让父组件弹 mapping popup
//   - onPointerLeave/Up/Cancel → 取消长按计时器
//   - 短按(< LONG_PRESS_MS)不触发任何回调 —— 视觉上已有的 flash 是父组件的全局 keydown 监听负责

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  highlightedCodes: Set<string>;
  hoveredCodes: Set<string>;
  flashCodes?: Set<string>;
  onLongPress?: (code: string, rect: DOMRect) => void;
}

// 长按阈值 —— 必须与父组件保持一致
const LONG_PRESS_MS = 250;

// 物理布局——按物理行而非逻辑 row(用户的 Ctrl 是 ControlLeft)
const ROWS: Array<Array<{ code: string; label: string; w?: number }>> = [
  [
    { code: 'Escape', label: 'Esc' },
    { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3' }, { code: 'F4', label: 'F4' },
    { code: 'F5', label: 'F5' }, { code: 'F6', label: 'F6' }, { code: 'F7', label: 'F7' }, { code: 'F8', label: 'F8' },
    { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' }, { code: 'F12', label: 'F12' },
  ],
  [
    { code: 'Backquote', label: '`' }, { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' },
    { code: 'Digit3', label: '3' }, { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' },
    { code: 'Digit6', label: '6' }, { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' },
    { code: 'Digit9', label: '9' }, { code: 'Digit0', label: '0' },
    { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' },
    { code: 'Backspace', label: '⌫', w: 1.5 },
  ],
  [
    { code: 'Tab', label: 'Tab', w: 1.5 },
    { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' }, { code: 'KeyP', label: 'P' },
    { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' },
    { code: 'Backslash', label: '\\', w: 1.25 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', w: 1.75 },
    { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
    { code: 'Enter', label: 'Enter', w: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', w: 2.25 },
    { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' }, { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
    { code: 'ShiftRight', label: 'Shift', w: 2.75 },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', w: 1.25 },
    { code: 'MetaLeft', label: '⌘', w: 1.25 },
    { code: 'AltLeft', label: 'Alt', w: 1.25 },
    { code: 'Space', label: '', w: 6.25 },
    { code: 'AltRight', label: 'Alt', w: 1.25 },
    { code: 'MetaRight', label: '⌘', w: 1.25 },
    { code: 'ControlRight', label: 'Ctrl', w: 1.25 },
  ],
  [
    { code: 'ArrowUp', label: '↑' },
    { code: 'ArrowDown', label: '↓' },
    { code: 'ArrowLeft', label: '←' },
    { code: 'ArrowRight', label: '→' },
  ],
];

function ModifierAlias({ code }: { code: string }) {
  // 左侧修饰键高亮时,右侧同名也亮
  if (code === 'ShiftLeft') return <span className="sl-sl-kb__alias">Shift</span>;
  if (code === 'ControlLeft') return <span className="sl-sl-kb__alias">Ctrl</span>;
  if (code === 'AltLeft') return <span className="sl-sl-kb__alias">Alt</span>;
  if (code === 'MetaLeft') return <span className="sl-sl-kb__alias">⌘</span>;
  return null;
}

// 单个键 —— 自带 long-press timer,鼠标按下 ≥ 250ms 触发 onLongPress。
// 用 pointer events 同时覆盖鼠标和触屏;键盘路径仍由父组件的全局 keydown 监听负责。
//
// 按下时立即进入稳定的 is-pressed 视觉态(短 transition,避免基态→按下态的 0.24s
// 颜色渐变造成"闪一下"的错觉),松开/移出/取消时清掉。
// long-press 命中后 popup 由父组件管理关闭,我们只清 timer。
interface KeyProps {
  code: string;
  label: string;
  width: number;
  height: number;
  isOn: boolean;
  isHover: boolean;
  isFlash: boolean;
  onLongPress?: (code: string, rect: DOMRect) => void;
}

function Key({ code, label, width, height, isOn, isHover, isFlash, onLongPress }: KeyProps) {
  const timerRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  // 鼠标按下中。Local state,不参与父组件重渲染,避免一次按键触发整树 reconcile。
  const [pressed, setPressed] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 卸载时清理 timer + 视觉态
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // 鼠标主键(或触屏)才触发;右键/中键忽略
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setPressed(true);
    if (!onLongPress) return;
    cancel();
    timerRef.current = window.setTimeout(() => {
      const el = elRef.current;
      if (!el) return;
      onLongPress(code, el.getBoundingClientRect());
    }, LONG_PRESS_MS);
  };

  const releasePressed = () => {
    cancel();
    setPressed(false);
  };

  return (
    <div
      ref={elRef}
      className={`sl-sl-kb__key ${isOn ? 'is-on' : ''} ${isHover ? 'is-hover' : ''} ${isFlash ? 'is-flash' : ''} ${pressed ? 'is-pressed' : ''}`}
      style={{ width, height }}
      title={code}
      onPointerDown={handlePointerDown}
      onPointerUp={releasePressed}
      onPointerLeave={releasePressed}
      onPointerCancel={releasePressed}
    >
      {label && <span className="sl-sl-kb__label">{label}</span>}
      {isOn && <ModifierAlias code={code} />}
    </div>
  );
}

export default function Keyboard({ highlightedCodes, hoveredCodes, flashCodes, onLongPress }: Props) {
  // 单元宽 56px,gap 4px
  const UNIT = 56;
  const GAP = 4;

  return (
    <div className="sl-sl-kb">
      {ROWS.map((row, ri) => (
        <div className="sl-sl-kb__row" key={ri} style={{ gap: GAP }}>
          {row.map((key) => {
            const isOn = highlightedCodes.has(key.code);
            const isHover = hoveredCodes.has(key.code);
            const isFlash = flashCodes?.has(key.code) ?? false;
            const w = (key.w ?? 1) * UNIT + (key.w ? (key.w - 1) * GAP : 0);
            return (
              <Key
                key={key.code}
                code={key.code}
                label={key.label}
                width={w}
                height={UNIT}
                isOn={isOn}
                isHover={isHover}
                isFlash={isFlash}
                onLongPress={onLongPress}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}