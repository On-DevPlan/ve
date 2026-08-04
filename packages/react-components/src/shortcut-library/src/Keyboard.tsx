// Keyboard.tsx —— 简化的扁平键盘预览
// 接收 highlightedCodes 集合,把对应键渲染为"按下"状态
// 风格参考 zfrontier:flat,两态(浅色未按,深色按下)
//
// 三种"显示该键快捷键"的入口,视觉态相同,差别只在触发方式(由父组件统一管):
//   - 悬停 (mouse):           mouseenter → 父组件延迟 HOVER_OPEN_DELAY 弹 popup(非 pin)
//   - 长按 (mouse / 物理键):   pointerdown → 父组件 KEY_HOLD_MS(400ms) hold timer → 弹 popup(非 pin)
//   - 双击 (mouse):           dblclick → 父组件直接弹 popup 并 pin 住
// 父组件持有唯一的 popup state,三种入口都往里写;新触发覆盖旧 popup。
// 本组件只负责上报事件 + 渲染视觉态。

import { type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

interface Props {
  highlightedCodes: Set<string>;
  hoveredCodes: Set<string>;
  heldKeys?: Set<string>;
  onPress?: (code: string) => void;
  onRelease?: (code: string) => void;
  // 悬停(仅鼠标):进入 / 离开一个键。父组件据此延迟弹 / 关 mapping popup。
  onKeyHoverEnter?: (code: string, rect: DOMRect) => void;
  onKeyHoverLeave?: (code: string) => void;
  // 双击:父组件直接弹 popup 并 pin 住。
  onDoubleClickKey?: (code: string, rect: DOMRect) => void;
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
  // 导航簇:Insert/Home/PageUp 上排,Delete/End/PageDown 下排(标准 2×3 布局)
  [
    { code: 'Insert', label: 'Ins' },
    { code: 'Home', label: 'Home' },
    { code: 'PageUp', label: 'PgUp' },
  ],
  [
    { code: 'Delete', label: 'Del' },
    { code: 'End', label: 'End' },
    { code: 'PageDown', label: 'PgDn' },
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

// 单个键 —— 视觉态完全由 props 决定:
//   isOn:     来自父组件的 highlightedCodes(录入 3s 高亮)
//   isHeld:   来自父组件的 heldKeys(物理键盘 / 鼠标长按中,键被按住)
//   isHover:  来自父组件的 hoveredCodes(表格行 hover 高亮)
//
// 鼠标 / 触屏按压交给父组件:pointerdown 调 onPress、pointerup / leave / cancel
// 调 onRelease。悬停 / 双击同理上报,mouseenter / leave 只认鼠标(触屏不会触发,
// 避免点触误弹 hover popup)。父组件维护 heldKeys + hold / hover 定时器 + popup。
interface KeyProps {
  code: string;
  label: string;
  width: number;
  height: number;
  isOn: boolean;
  isHover: boolean;
  isHeld: boolean;
  onPress?: (code: string) => void;
  onRelease?: (code: string) => void;
  onHoverEnter?: (code: string, rect: DOMRect) => void;
  onHoverLeave?: (code: string) => void;
  onDblClick?: (code: string, rect: DOMRect) => void;
}

function Key({
  code, label, width, height, isOn, isHover, isHeld,
  onPress, onRelease, onHoverEnter, onHoverLeave, onDblClick,
}: KeyProps) {
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // 鼠标主键(或触屏)才触发;右键/中键忽略
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!onPress) return;
    onPress(code);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    // 只在主键释放时通知父组件;右键/中键释放直接忽略
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!onRelease) return;
    onRelease(code);
  };

  // pointerleave / pointercancel:放弃本次按压
  // 注:pointerleave 不冒泡,React 17+ 在 document 监听时可能收不到,
  // 我们改用 onPointerOut(pointerout 是冒泡版本)同时挂两个保险。
  const handleCancel = () => {
    if (!onRelease) return;
    onRelease(code);
  };

  // 悬停只认鼠标(mouseenter / leave 在触屏上不触发,避免点触连发 hover popup)。
  // rect 用 currentTarget 当前的布局位置(hover 是瞬时的,进入那一刻的位置足够)。
  const handleMouseEnter = (e: ReactMouseEvent<HTMLDivElement>) => {
    onHoverEnter?.(code, e.currentTarget.getBoundingClientRect());
  };
  const handleMouseLeave = () => {
    onHoverLeave?.(code);
  };
  // 双击:rect 同样取当前布局位置。可能残留的 hold / hover 定时器由父组件清。
  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    onDblClick?.(code, e.currentTarget.getBoundingClientRect());
  };

  return (
    <div
      className={`sl-sl-kb__key ${isOn || isHeld ? 'is-on' : ''} ${isHover ? 'is-hover' : ''}`}
      style={{ width, height }}
      title={code}
      data-shortcut-code={code}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handleCancel}
      onPointerOut={handleCancel}
      onPointerCancel={handleCancel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
    >
      {label && <span className="sl-sl-kb__label">{label}</span>}
      {(isOn || isHeld) && <ModifierAlias code={code} />}
    </div>
  );
}

export default function Keyboard({
  highlightedCodes, hoveredCodes, heldKeys,
  onPress, onRelease, onKeyHoverEnter, onKeyHoverLeave, onDoubleClickKey,
}: Props) {
  // 单元宽 56px,gap 4px
  const UNIT = 56;
  const GAP = 4;
  const heldSet = heldKeys ?? new Set<string>();

  return (
    <div className="sl-sl-kb">
      {ROWS.map((row, ri) => (
        <div className="sl-sl-kb__row" key={ri} style={{ gap: GAP }}>
          {row.map((key) => {
            const isOn = highlightedCodes.has(key.code);
            const isHover = hoveredCodes.has(key.code);
            const isHeld = heldSet.has(key.code);
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
                isHeld={isHeld}
                onPress={onPress}
                onRelease={onRelease}
                onHoverEnter={onKeyHoverEnter}
                onHoverLeave={onKeyHoverLeave}
                onDblClick={onDoubleClickKey}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
