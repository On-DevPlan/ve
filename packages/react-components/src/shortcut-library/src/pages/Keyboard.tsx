// Keyboard.tsx —— ANSI 104 键 1:1 物理键盘预览
//
// 适用场景:挂在 shortcut-library 的 preview 面板里,展示按键状态。
// 不适用:host 想用任意键的 getBoundingClientRect(popup 定位)—— 它直接走
// shadow DOM 内 [data-shortcut-code] 查找,跟本组件无关。
//
// 三簇并列布局:main(主键) / nav(编辑+方向) / numpad(小键盘)。
// 数据与形状分离:键位定义见 src/data/keyboard-layout.ts,渲染只负责按
// 形状映射 DOM + 把状态(is-on / is-hover / has-binding)打到 className。
// pointer 状态由父组件完全持有(按下/释放/悬停/双击 4 个回调),渲染层
// 不维护自己的 ref,避免和父组件的 hold / hover 定时器竞争。
//
// 所有键保留 data-shortcut-code(物理键 keydown 走 e.code 直接命中,
// findKeyRect 也通过它定位 popup 位置)。
//
// 视觉态完全由 props 决定:
//   is-on / is-held  -> 父组件 heldKeys(物理键盘 / 鼠标长按中)
//   is-hover         -> 父组件 highlightedCodes(录入 3s) + hoveredCodes(表格行 hover)
//   has-binding      -> 可选 boundCodes,标记哪些键被某个 binding 占用,加细底线

import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MAIN_ROWS, NAV_ROWS, NUMPAD_KEYS, MAC_LABEL_OVERRIDES,
  type KeyDef, type NumpadKeyDef,
} from '../data/keyboard-layout';

interface Props {
  highlightedCodes: Set<string>;
  hoveredCodes: Set<string>;
  heldKeys: Set<string>;
  /** 鼠标 / 触屏按压回调。父组件维护 heldKeys + hold / hover 定时器 */
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
  /** 悬停(仅鼠标):进入 / 离开。父组件据此延迟弹 / 关 mapping popup */
  onKeyHoverEnter: (code: string, rect: DOMRect) => void;
  onKeyHoverLeave: (code: string) => void;
  /** 双击:父组件直接弹 popup 并 pin 住 */
  onDoubleClickKey: (code: string, rect: DOMRect) => void;
  /** 有绑定的键:加 has-binding 视觉标记,一眼看出哪些键被占用 */
  boundCodes?: Set<string>;
  /** Mac 修饰键改名(可选) */
  platform?: 'win' | 'mac';
  /** 是否显示小键盘(可选,默认 true) */
  showNumpad?: boolean;
}

export default function Keyboard({
  highlightedCodes, hoveredCodes, heldKeys,
  onPress, onRelease, onKeyHoverEnter, onKeyHoverLeave, onDoubleClickKey,
  boundCodes, platform = 'win', showNumpad = true,
}: Props) {
  const labelOf = (k: KeyDef): string =>
    (platform === 'mac' && MAC_LABEL_OVERRIDES[k.code]) || k.label;

  function renderKey(k: KeyDef, i: number, extraStyle?: CSSProperties) {
    if (k.spacer) {
      return (
        <span
          key={`sp-${i}`}
          className="sl-sl-kb__spacer"
          style={{ ['--sl-kb-w' as string]: String(k.w ?? 1) }}
          aria-hidden="true"
        />
      );
    }
    const cls = [
      'sl-sl-kb__key',
      heldKeys.has(k.code) ? 'is-on' : '',
      (hoveredCodes.has(k.code) || highlightedCodes.has(k.code)) ? 'is-hover' : '',
      boundCodes?.has(k.code) ? 'has-binding' : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        key={k.code}
        className={cls}
        data-shortcut-code={k.code}
        title={k.code}
        style={{
          '--sl-kb-w': k.w ?? 1,
          '--sl-kb-col': (extraStyle as Record<string, string> | undefined)?.['--sl-kb-col'],
          '--sl-kb-row': (extraStyle as Record<string, string> | undefined)?.['--sl-kb-row'],
          '--sl-kb-colspan': (extraStyle as Record<string, string> | undefined)?.['--sl-kb-colspan'],
          '--sl-kb-rowspan': (extraStyle as Record<string, string> | undefined)?.['--sl-kb-rowspan'],
        } as CSSProperties}
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          onPress(k.code);
        }}
        onPointerUp={(e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          onRelease(k.code);
        }}
        onPointerLeave={() => {
          onRelease(k.code);
          onKeyHoverLeave(k.code);
        }}
        onPointerOut={() => onRelease(k.code)}
        onPointerCancel={() => onRelease(k.code)}
        onMouseEnter={(e: ReactMouseEvent<HTMLDivElement>) =>
          onKeyHoverEnter(k.code, e.currentTarget.getBoundingClientRect())}
        onDoubleClick={(e: ReactMouseEvent<HTMLDivElement>) =>
          onDoubleClickKey(k.code, e.currentTarget.getBoundingClientRect())}
      >
        {k.sub && <span className="sl-sl-kb__sub">{k.sub}</span>}
        <span className="sl-sl-kb__label">{labelOf(k)}</span>
      </div>
    );
  }

  return (
    <div className="sl-sl-kb" role="group" aria-label="键盘预览">
      <div className="sl-sl-kb__cluster sl-sl-kb__cluster--main">
        {MAIN_ROWS.map((row, r) => (
          <div className="sl-sl-kb__row" key={`m${r}`}>{row.map(renderKey)}</div>
        ))}
      </div>

      <div className="sl-sl-kb__cluster sl-sl-kb__cluster--nav">
        {NAV_ROWS.map((row, r) => (
          <div className="sl-sl-kb__row" key={`n${r}`}>
            {row.length
              ? row.map(renderKey)
              : <span className="sl-sl-kb__spacer" style={{ ['--sl-kb-w' as string]: '3' }} />}
          </div>
        ))}
      </div>

      {showNumpad && (
        <div className="sl-sl-kb__cluster sl-sl-kb__cluster--numpad">
          {NUMPAD_KEYS.map((k: NumpadKeyDef, i) =>
            renderKey(k, i, {
              ['--sl-kb-col' as string]: String(k.col),
              ['--sl-kb-row' as string]: String(k.row),
              ['--sl-kb-colspan' as string]: String(k.colSpan ?? 1),
              ['--sl-kb-rowspan' as string]: String(k.rowSpan ?? 1),
            } as CSSProperties & Record<string, string>))}
        </div>
      )}
    </div>
  );
}