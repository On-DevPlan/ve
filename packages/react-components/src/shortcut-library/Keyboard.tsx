// Keyboard.tsx —— 简化的扁平键盘预览
// 接收 highlightedCodes 集合,把对应键渲染为"按下"状态
// 风格参考 zfrontier:flat,两态(浅色未按,深色按下)

interface Props {
  highlightedCodes: Set<string>;
}

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
    { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
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
    { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
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

export default function Keyboard({ highlightedCodes }: Props) {
  // 单元宽 56px,gap 4px
  const UNIT = 56;
  const GAP = 4;

  return (
    <div className="sl-sl-kb">
      {ROWS.map((row, ri) => (
        <div className="sl-sl-kb__row" key={ri} style={{ gap: GAP }}>
          {row.map((key) => {
            const isOn = highlightedCodes.has(key.code);
            const w = (key.w ?? 1) * UNIT + (key.w ? (key.w - 1) * GAP : 0);
            return (
              <div
                key={key.code}
                className={`sl-sl-kb__key ${isOn ? 'is-on' : ''}`}
                style={{ width: w, height: UNIT }}
                title={key.code}
              >
                {key.label && <span className="sl-sl-kb__label">{key.label}</span>}
                {isOn && <ModifierAlias code={key.code} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
