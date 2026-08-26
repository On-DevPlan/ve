// packages/react-components/src/color-studio/src/components/KeyboardHints.tsx
//
// 静态文案列快捷键。

export function KeyboardHints() {
  return (
    <div className="sl-cs-kbds">
      <h4>快捷键</h4>
      <ul>
        <li><kbd>P</kbd> / <kbd>E</kbd> 屏幕取色</li>
        <li><kbd>A</kbd> / <kbd>Enter</kbd> 把当前色加入活动板</li>
        <li><kbd>C</kbd> 复制当前 hex</li>
        <li><kbd>X</kbd> 清空历史</li>
      </ul>
    </div>
  );
}
